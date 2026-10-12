"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { syncMyMfaSettingAction } from "@/app/admin/security/actions";

interface VerifiedFactor {
  id: string;
  friendly_name: string | null;
}

interface Enrollment {
  id: string;
  qrCode: string;
  secret: string;
}

export function SecurityMfaCard({
  verifiedFactors,
}: {
  verifiedFactors: VerifiedFactor[];
}) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const supabase = createSupabaseBrowserClient();

  async function beginEnrollment() {
    setPending(true);
    setError("");
    setNotice("");
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "DawaSetu admin authenticator",
    });
    setPending(false);
    if (enrollError || !data?.totp) {
      setError("Authenticator setup could not start. Please try again.");
      return;
    }
    setEnrollment({
      id: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
  }

  async function cancelEnrollment() {
    if (!enrollment) return;
    setPending(true);
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: enrollment.id,
    });
    setPending(false);
    if (unenrollError) {
      setError("The unfinished authenticator could not be removed.");
      return;
    }
    setEnrollment(null);
    setCode("");
    setNotice("Authenticator setup was cancelled.");
  }

  async function verifyEnrollment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment || !/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setPending(true);
    setError("");
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: enrollment.id });
    if (challengeError || !challenge) {
      setPending(false);
      setError("The authenticator code could not be checked. Try again.");
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrollment.id,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      setPending(false);
      setError("That code is not valid. Check your authenticator and retry.");
      return;
    }
    const result = await syncMyMfaSettingAction(true);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEnrollment(null);
    setCode("");
    setNotice(result.message ?? "MFA is enabled.");
    router.refresh();
  }

  async function disableFactor(factorId: string) {
    setPending(true);
    setError("");
    setNotice("");
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId,
    });
    if (unenrollError) {
      setPending(false);
      setError(
        "Complete an authenticator challenge before removing this factor.",
      );
      return;
    }
    const result = await syncMyMfaSettingAction(false);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNotice(result.message ?? "MFA is disabled.");
    router.refresh();
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Administrator multi-factor authentication</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm leading-6 text-slate-600">
          Add an authenticator app to require a one-time code at sign-in. When
          enabled, database-enforced admin permissions require a verified MFA
          session.
        </p>
        {verifiedFactors.length > 0 ? (
          <div className="grid gap-3">
            {verifiedFactors.map((factor) => (
              <div
                key={factor.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"
              >
                <div>
                  <p className="font-medium text-emerald-950">
                    Authenticator verified
                  </p>
                  <p className="text-sm text-emerald-900">
                    {factor.friendly_name || "TOTP authenticator"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => void disableFactor(factor.id)}
                >
                  {pending ? "Working…" : "Remove authenticator"}
                </Button>
              </div>
            ))}
          </div>
        ) : enrollment ? (
          <form onSubmit={verifyEnrollment} className="grid gap-4">
            <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[auto_1fr] sm:items-center">
              <img
                src={enrollment.qrCode}
                alt="QR code for DawaSetu authenticator setup"
                className="h-48 w-48 rounded-lg border border-slate-200 bg-white p-2"
              />
              <div>
                <h3 className="font-semibold text-slate-950">
                  Scan with your authenticator app
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  If you cannot scan the code, add the setup key manually. Keep
                  this key private.
                </p>
                <code className="mt-3 block rounded-lg bg-slate-100 p-3 text-sm break-all text-slate-900">
                  {enrollment.secret}
                </code>
              </div>
            </div>
            <label className="grid max-w-sm gap-2 text-sm font-medium text-slate-800">
              6-digit authenticator code
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-base tracking-[0.25em] text-slate-900"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Verifying…" : "Verify and enable MFA"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => void cancelEnrollment()}
              >
                Cancel setup
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            disabled={pending}
            onClick={() => void beginEnrollment()}
            className="justify-self-start"
          >
            {pending ? "Starting setup…" : "Set up authenticator"}
          </Button>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"
          >
            {notice}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
