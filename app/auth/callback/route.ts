import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function safePath(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/account";
  }
  return value;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safePath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      let destination = next;
      if (next === "/admin") {
        const { data: canAccessAdmin, error: permissionError } =
          await supabase.rpc("can_access_admin_portal");
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (permissionError || canAccessAdmin !== true || userError || !user) {
          await supabase.auth.signOut();
          return NextResponse.redirect(
            new URL("/admin/login?error=access", request.url),
          );
        }
        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("password_change_required")
          .eq("id", user.id)
          .maybeSingle();
        if (profileError || !profile) {
          await supabase.auth.signOut();
          return NextResponse.redirect(
            new URL("/admin/login?error=access", request.url),
          );
        }
        if (profile.password_change_required) {
          destination = "/change-password?next=%2Fadmin";
        }
      }

      const [
        { data: factors, error: factorsError },
        { data: assurance, error: assuranceError },
      ] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      if (factorsError || assuranceError) {
        await supabase.auth.signOut();
        return NextResponse.redirect(
          new URL("/login?error=security", request.url),
        );
      }
      const hasVerifiedFactor = factors.all.some(
        (factor) => factor.status === "verified",
      );
      if (hasVerifiedFactor && assurance.currentLevel !== "aal2") {
        return NextResponse.redirect(
          new URL(`/mfa?next=${encodeURIComponent(destination)}`, request.url),
        );
      }
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
