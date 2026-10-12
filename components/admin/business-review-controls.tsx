"use client";

import { useActionState } from "react";

import { reviewBusinessAction } from "@/app/admin/partners/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthActionState } from "@/types/auth";

function BusinessReviewForm({
  businessId,
  decision,
}: {
  businessId: string;
  decision: "approved" | "rejected" | "suspended";
}) {
  const action = reviewBusinessAction.bind(null, businessId, decision);
  const [state, formAction, pending] = useActionState<
    AuthActionState,
    FormData
  >(action, {});
  return (
    <form action={formAction} className="grid gap-2">
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Internal review note
        <Input name="review_note" maxLength={1000} className="h-9" />
      </label>
      <Button
        type="submit"
        size="sm"
        variant={
          decision === "approved"
            ? "primary"
            : decision === "suspended"
              ? "destructive"
              : "outline"
        }
        disabled={pending}
      >
        {pending
          ? "Saving…"
          : decision === "approved"
            ? "Approve"
            : decision === "suspended"
              ? "Suspend"
              : "Reject"}
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

export function BusinessReviewControls({
  businessId,
  status,
}: {
  businessId: string;
  status: string;
}) {
  if (status === "approved")
    return (
      <div className="max-w-sm">
        <BusinessReviewForm businessId={businessId} decision="suspended" />
      </div>
    );
  if (!["pending", "rejected", "suspended"].includes(status)) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <BusinessReviewForm businessId={businessId} decision="approved" />
      <BusinessReviewForm businessId={businessId} decision="rejected" />
    </div>
  );
}
