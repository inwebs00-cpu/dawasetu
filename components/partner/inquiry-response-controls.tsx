"use client";

import { useActionState } from "react";

import { respondToPartnerInquiryAction } from "@/app/partner/[businessId]/orders/actions";
import { Button } from "@/components/ui/button";
import type { AuthActionState } from "@/types/auth";

export function InquiryResponseControls({
  businessId,
  inquiryId,
  status,
  responseMessage,
}: {
  businessId: string;
  inquiryId: string;
  status: string;
  responseMessage: string | null;
}) {
  const action = respondToPartnerInquiryAction.bind(
    null,
    businessId,
    inquiryId,
  );
  const [state, formAction, pending] = useActionState<
    AuthActionState,
    FormData
  >(action, {});

  if (status === "responded") {
    return (
      <div className="rounded-xl bg-teal-50 p-4">
        <p className="text-xs font-semibold text-teal-900">Reply sent</p>
        <p className="mt-1 text-sm leading-6 whitespace-pre-wrap text-teal-950">
          {responseMessage}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-2">
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Reply to customer
        <textarea
          name="response_message"
          required
          minLength={1}
          maxLength={1000}
          rows={3}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900"
          placeholder="Share availability details or ask them to call the pharmacy."
        />
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Sending…" : "Send reply"}
      </Button>
      {state.error && (
        <p role="alert" className="text-xs leading-5 text-rose-800">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-xs leading-5 text-teal-900">
          {state.message}
        </p>
      )}
    </form>
  );
}
