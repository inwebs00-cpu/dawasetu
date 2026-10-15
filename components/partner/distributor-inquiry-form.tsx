"use client";

import { useActionState } from "react";

import { createDistributorInquiryAction } from "@/app/distributor/[businessId]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthActionState } from "@/types/auth";

export function DistributorInquiryForm({
  partnerBusinessId,
  distributorBusinessId,
  medicineId,
}: {
  partnerBusinessId: string;
  distributorBusinessId: string;
  medicineId: string;
}) {
  const action = createDistributorInquiryAction.bind(
    null,
    partnerBusinessId,
    distributorBusinessId,
    medicineId,
  );
  const [state, formAction, pending] = useActionState<
    AuthActionState,
    FormData
  >(action, {});

  return (
    <form
      action={formAction}
      className="mt-4 grid gap-3 rounded-xl bg-teal-50 p-4"
    >
      <p className="text-sm font-semibold text-teal-950">
        Ask the distributor to confirm this stock
      </p>
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Quantity requested
        <Input
          name="requested_quantity"
          type="number"
          min={1}
          max={1000000}
          defaultValue={1}
          required
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Note (optional)
        <textarea
          name="message"
          maxLength={1000}
          rows={2}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
          placeholder="Share a delivery or pack-size question"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-rose-800">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-sm text-emerald-900">
          {state.message}
        </p>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Sending…" : "Send B2B inquiry"}
      </Button>
    </form>
  );
}
