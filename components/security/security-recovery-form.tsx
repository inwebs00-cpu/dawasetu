"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  requestSecurityPinOtpAction,
  verifySecurityPinOtpAction,
} from "@/app/security/recover/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SecurityRecoveryOtpState } from "@/types/security";

function Feedback({ state }: { state: SecurityRecoveryOtpState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900"
      >
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p
        role="status"
        className="rounded-xl bg-teal-50 p-3 text-sm text-teal-950"
      >
        {state.message}
      </p>
    );
  }
  return null;
}

export function SecurityRecoveryForm() {
  const [requestState, requestAction, requesting] = useActionState(
    requestSecurityPinOtpAction,
    {},
  );
  const [verifyState, verifyAction, verifying] = useActionState(
    verifySecurityPinOtpAction,
    {},
  );
  const state = verifyState.step ? verifyState : requestState;

  return (
    <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-sm font-semibold text-teal-800">Security recovery</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
        Reset your security PIN
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Verify an email or mobile number already confirmed on your DawaSetu
        account. You will also complete your authenticator check if MFA is on.
      </p>
      {state.step === "verify" && state.channel && state.identifier ? (
        <form action={verifyAction} className="mt-6 grid gap-4">
          <input type="hidden" name="channel" value={state.channel} />
          <input type="hidden" name="identifier" value={state.identifier} />
          <label className="grid gap-2 text-sm font-medium text-slate-800">
            One-time code
            <Input
              name="token"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,12}"
              minLength={6}
              maxLength={12}
              required
            />
          </label>
          <Feedback state={state} />
          <Button type="submit" disabled={verifying}>
            {verifying ? "Verifying…" : "Verify and continue"}
          </Button>
          <p className="text-xs leading-5 text-slate-500">
            Didn’t receive a code? Start again with the same verified contact.
          </p>
          <Button asChild type="button" variant="ghost">
            <Link href="/security/recover">Request another code</Link>
          </Button>
        </form>
      ) : (
        <form action={requestAction} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-800">
            Account email or mobile number
            <Input
              name="identifier"
              type="text"
              autoComplete="username"
              maxLength={254}
              placeholder="name@example.in or +919876543210"
              required
            />
          </label>
          <Feedback state={state} />
          <Button type="submit" disabled={requesting}>
            {requesting ? "Sending…" : "Send one-time code"}
          </Button>
        </form>
      )}
      <div className="mt-6 border-t border-slate-100 pt-5 text-sm text-slate-600">
        <Link
          className="font-semibold text-teal-800 hover:underline"
          href="/login"
        >
          Back to sign in
        </Link>
      </div>
    </section>
  );
}
