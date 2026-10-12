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
          new URL(`/mfa?next=${encodeURIComponent(next)}`, request.url),
        );
      }
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
