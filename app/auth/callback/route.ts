import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const emailOtpTypes = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

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
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const tokenType = request.nextUrl.searchParams.get("type");
  const next = safePath(request.nextUrl.searchParams.get("next"));
  const callbackError = request.nextUrl.searchParams.get("error");
  const loginPath = next === "/admin" ? "/admin/login" : "/login";

  if (callbackError) {
    return NextResponse.redirect(
      new URL(`${loginPath}?error=link`, request.url),
    );
  }

  if (code || (tokenHash && tokenType && emailOtpTypes.has(tokenType))) {
    const supabase = await createSupabaseServerClient();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({
          token_hash: tokenHash!,
          type: tokenType as
            | "signup"
            | "invite"
            | "magiclink"
            | "recovery"
            | "email_change"
            | "email",
        });
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
          new URL(`${loginPath}?error=security`, request.url),
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

  return NextResponse.redirect(new URL(`${loginPath}?error=link`, request.url));
}
