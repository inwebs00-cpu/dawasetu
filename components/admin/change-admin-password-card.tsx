"use client";

import { useActionState } from "react";

import { changeAdminPasswordAction } from "@/app/admin/security/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AuthActionState } from "@/types/auth";

function PasswordField({
  id,
  name,
  label,
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
}) {
  return (
    <label
      htmlFor={id}
      className="grid gap-2 text-sm font-medium text-slate-800"
    >
      {label}
      <Input
        id={id}
        name={name}
        type="password"
        autoComplete={autoComplete}
        minLength={12}
        maxLength={128}
        required
      />
    </label>
  );
}

export function ChangeAdminPasswordCard() {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(
    changeAdminPasswordAction,
    {},
  );

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Change admin password</CardTitle>
        <p className="text-sm leading-6 text-slate-600">
          Confirm your current password, then choose a new password with at
          least 12 characters. Passwords are sent only to Supabase Auth and
          never written to the audit log.
        </p>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <PasswordField
            id="admin-current-password"
            name="current_password"
            label="Current password"
            autoComplete="current-password"
          />
          <span aria-hidden="true" className="hidden sm:block" />
          <PasswordField
            id="admin-new-password"
            name="new_password"
            label="New password"
            autoComplete="new-password"
          />
          <PasswordField
            id="admin-confirm-password"
            name="confirm_password"
            label="Confirm new password"
            autoComplete="new-password"
          />
          <div className="sm:col-span-2">
            {state.error && (
              <p
                role="alert"
                className="mb-3 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
              >
                {state.error}
              </p>
            )}
            {state.message && (
              <p
                role="status"
                className="mb-3 rounded-xl bg-teal-50 px-3.5 py-3 text-sm text-teal-900"
              >
                {state.message}
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Changing password…" : "Change password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
