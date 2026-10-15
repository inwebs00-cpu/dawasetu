"use client";

import { useActionState } from "react";

import { respondToDistributorInquiryAction } from "@/app/distributor/[businessId]/actions";
import { Button } from "@/components/ui/button";
import type { AuthActionState } from "@/types/auth";

export function DistributorInquiryResponseControls({
  distributorBusinessId,
  inquiryId,
}: {
  distributorBusinessId: string;
  inquiryId: string;
}) {
  const action = respondToDistributorInquiryAction.bind(
    null,
    distributorBusinessId,
    inquiryId,
  );
  const [state, formAction, pending] = useActionState<
    AuthActionState,
    FormData
  >(action, {});

  return (
    <form
      action={formAction}
      className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_auto]"
    >
      <div className="grid gap-3">
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Response
          <select
            name="decision"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          >
            <option value="responded">Can supply / confirm availability</option>
            <option value="unavailable">Cannot supply currently</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Note for the partner
          <textarea
            name="response_message"
            required
            minLength={2}
            maxLength={1000}
            rows={2}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
            placeholder="Confirm reported quantity, pack size, and contact method"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Reply to partner"}
        </Button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-rose-800 sm:col-span-2">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-sm text-emerald-900 sm:col-span-2">
          {state.message}
        </p>
      )}
    </form>
  );
}
