import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { MfaChallengeForm } from "@/components/auth/mfa-challenge-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify your identity" };

type SearchParams = Promise<{ next?: string }>;

function safeNextPath(value: string | undefined) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/mfa") ||
    value.includes("\\")
  ) {
    return "/account";
  }
  return value;
}

export default async function MfaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const nextPath = safeNextPath(query.next);
  const { supabase } = await requireAuthenticatedUser();
  const [{ data: factors, error }, { data: assurance }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  if (assurance?.currentLevel === "aal2") redirect(nextPath);
  const verifiedFactor = factors?.totp.find(
    (factor) => factor.status === "verified",
  );
  if (!error && !verifiedFactor) redirect("/account");

  return (
    <Card className="w-full max-w-md border-white/80 bg-white/95 shadow-xl shadow-slate-900/5">
      <CardHeader>
        <p className="text-sm font-semibold text-teal-800">One more step</p>
        <CardTitle className="text-2xl">Verify your identity</CardTitle>
        <p className="text-sm leading-6 text-slate-600">
          Enter the current code from your authenticator app to continue.
        </p>
      </CardHeader>
      <CardContent>
        {error || !verifiedFactor ? (
          <p
            role="alert"
            className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900"
          >
            Your authenticator could not be loaded. Return to sign in and try
            again.
          </p>
        ) : (
          <MfaChallengeForm factorId={verifiedFactor.id} nextPath={nextPath} />
        )}
      </CardContent>
    </Card>
  );
}
