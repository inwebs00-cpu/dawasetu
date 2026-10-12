"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function MfaChallengeForm({
  factorId,
  nextPath,
}: {
  factorId: string;
  nextPath: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setPending(true);
    setError("");
    const supabase = createSupabaseBrowserClient();
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setPending(false);
      setError("The verification request could not be started. Try again.");
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    setPending(false);
    if (verifyError) {
      setError("That code is not valid. Check your authenticator and retry.");
      return;
    }
    router.replace(nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={verifyCode} className="grid gap-4">
      <label className="grid gap-2 text-sm font-medium text-slate-800">
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
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900"
        >
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Verifying…" : "Verify and continue"}
      </Button>
    </form>
  );
}
