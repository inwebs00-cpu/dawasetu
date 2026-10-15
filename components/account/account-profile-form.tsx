"use client";

import { useActionState } from "react";

import { updateAccountProfileAction } from "@/app/account/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AccountProfileForm({
  fullName,
  phone,
  preferredLanguage,
}: {
  fullName: string;
  phone: string;
  preferredLanguage: string;
}) {
  const displayPhone = phone.startsWith("+91") ? phone.slice(3) : phone;
  const [state, formAction, pending] = useActionState(
    updateAccountProfileAction,
    {},
  );

  return (
    <>
      <form
        action={formAction}
        className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Full name
          <Input
            name="full_name"
            required
            minLength={1}
            maxLength={160}
            defaultValue={fullName}
            autoComplete="name"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Mobile number
          <Input
            name="phone"
            type="tel"
            inputMode="numeric"
            pattern="[6-9][0-9]{9}"
            maxLength={10}
            defaultValue={displayPhone}
            placeholder="9876543210"
            autoComplete="tel"
            aria-describedby="account-phone-help"
          />
          <span
            id="account-phone-help"
            className="text-[11px] font-normal text-slate-500"
          >
            Enter 10 digits. You do not need to type +91.
          </span>
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Preferred language
          <Input
            name="preferred_language"
            required
            minLength={2}
            maxLength={12}
            defaultValue={preferredLanguage}
            placeholder="en"
          />
        </label>
        <div className="flex items-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving profile…" : "Save profile"}
          </Button>
        </div>
      </form>
      {state.error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          role="status"
          className="mt-3 rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-900"
        >
          {state.message}
        </p>
      )}
    </>
  );
}
