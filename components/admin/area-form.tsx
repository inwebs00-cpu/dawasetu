"use client";

import { useActionState } from "react";

import { saveAreaAction } from "@/app/admin/locations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthActionState } from "@/types/auth";

export function AreaForm() {
  const [state, formAction, pending] = useActionState<
    AuthActionState,
    FormData
  >(saveAreaAction, {});
  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 sm:p-6"
    >
      <h2 className="text-lg font-semibold text-slate-950 sm:col-span-2">
        Add or activate a locality
      </h2>
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        State / Union Territory
        <Input name="state_name" required maxLength={100} />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        State code
        <Input name="state_code" required maxLength={6} placeholder="MH" />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        District
        <Input name="district_name" required maxLength={100} />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        Area / locality
        <Input name="area_name" required maxLength={100} />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        PIN code (optional)
        <Input name="postal_code" inputMode="numeric" maxLength={6} />
      </label>
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save locality"}
        </Button>
      </div>
      <p className="text-xs leading-5 text-slate-500 sm:col-span-2">
        DawaSetu uses the locality to route requests; the pharmacy sees the area
        name, not the customer’s exact address.
      </p>
      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 sm:col-span-2"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          role="status"
          className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900 sm:col-span-2"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
