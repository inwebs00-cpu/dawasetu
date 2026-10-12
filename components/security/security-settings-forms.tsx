"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  saveSecurityRecoveryContactsAction,
  saveSecurityPinAction,
} from "@/app/account/security/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SecuritySettingsActionState } from "@/types/security";

function Feedback({ state }: { state: SecuritySettingsActionState }) {
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

export function SecuritySettingsForms({
  email,
  phone,
  emailVerified,
  phoneVerified,
  recoveryEmail,
  recoveryPhone,
  hasPin,
  resetPin,
}: {
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  recoveryEmail: string | null;
  recoveryPhone: string | null;
  hasPin: boolean;
  resetPin: boolean;
}) {
  const [contactsState, contactsAction, savingContacts] = useActionState(
    saveSecurityRecoveryContactsAction,
    {},
  );
  const [pinState, pinAction, savingPin] = useActionState(
    saveSecurityPinAction,
    {},
  );

  return (
    <div className="mt-6 grid gap-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <p className="text-sm font-medium text-teal-800">Recovery methods</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">
          Recovery email and mobile
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Only verified contacts on your Supabase Auth account can be selected.
          Email codes require the project email template to send a numeric OTP;
          mobile codes require phone authentication and an SMS provider.
        </p>
        <form action={contactsAction} className="mt-5 grid gap-4">
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm">
            <input
              name="use_email"
              type="checkbox"
              value="yes"
              defaultChecked={Boolean(recoveryEmail)}
              disabled={!emailVerified || !email}
              className="mt-1 size-4 accent-teal-700"
            />
            <span>
              <span className="block font-medium text-slate-900">
                Recovery email
              </span>
              <span className="mt-1 block text-slate-600">
                {emailVerified
                  ? email
                  : "Add and verify an email in your account first."}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm">
            <input
              name="use_phone"
              type="checkbox"
              value="yes"
              defaultChecked={Boolean(recoveryPhone)}
              disabled={!phoneVerified || !phone}
              className="mt-1 size-4 accent-teal-700"
            />
            <span>
              <span className="block font-medium text-slate-900">
                Recovery mobile
              </span>
              <span className="mt-1 block text-slate-600">
                {phoneVerified
                  ? phone
                  : "Add and verify a mobile number in your account first."}
              </span>
            </span>
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-800 sm:max-w-sm">
            Current password
            <Input
              name="current_password"
              type="password"
              autoComplete="current-password"
              minLength={12}
              maxLength={128}
            />
          </label>
          {hasPin && (
            <label className="grid gap-2 text-sm font-medium text-slate-800 sm:max-w-sm">
              Current security PIN (optional)
              <Input
                name="current_security_pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                autoComplete="off"
              />
            </label>
          )}
          <p className="text-xs leading-5 text-slate-500">
            You can also save after a fresh one-time-code sign-in. Admins with
            MFA must complete their authenticator check.
          </p>
          <Feedback state={contactsState} />
          <div>
            <Button type="submit" disabled={savingContacts}>
              {savingContacts ? "Saving…" : "Save recovery methods"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <p className="text-sm font-medium text-teal-800">Sensitive actions</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">
          {hasPin ? "Change security PIN" : "Set a security PIN"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Choose six digits. DawaSetu stores a salted scrypt hash and never
          stores or displays the PIN itself.
        </p>
        {resetPin ? (
          <p className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950">
            Your one-time code was verified. Set a new PIN below; your
            authenticator check is still required when MFA is enabled.
          </p>
        ) : null}
        {!resetPin && (
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Confirm your password{hasPin ? " or current PIN" : ""}, or sign in
            with a fresh one-time code. Admins with MFA must complete their
            authenticator check.
          </p>
        )}
        <form action={pinAction} className="mt-5 grid gap-4 sm:max-w-md">
          {resetPin && <input type="hidden" name="recovery_mode" value="yes" />}
          <label className="grid gap-2 text-sm font-medium text-slate-800">
            New six-digit PIN
            <Input
              name="security_pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-800">
            Confirm PIN
            <Input
              name="confirm_security_pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
            />
          </label>
          {!resetPin && (
            <>
              <label className="grid gap-2 text-sm font-medium text-slate-800">
                Current password
                <Input
                  name="current_password"
                  type="password"
                  autoComplete="current-password"
                  minLength={12}
                  maxLength={128}
                />
              </label>
              {hasPin && (
                <label className="grid gap-2 text-sm font-medium text-slate-800">
                  Current security PIN
                  <Input
                    name="current_security_pin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    autoComplete="off"
                  />
                </label>
              )}
            </>
          )}
          <Feedback state={pinState} />
          <div>
            <Button type="submit" disabled={savingPin}>
              {savingPin ? "Saving…" : hasPin ? "Update PIN" : "Set PIN"}
            </Button>
          </div>
        </form>
        <Link
          href="/security/recover"
          className="mt-4 inline-block text-sm font-semibold text-teal-800 hover:underline"
        >
          Forgot security PIN? Verify by email or mobile
        </Link>
      </section>
    </div>
  );
}
