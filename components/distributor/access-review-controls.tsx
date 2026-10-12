"use client";

import { useActionState } from "react";

import { reviewDistributorAccessAction } from "@/app/distributor/[businessId]/access/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthActionState } from "@/types/auth";

function AccessDecisionForm({
  distributorBusinessId,
  partnerBusinessId,
  decision,
}: {
  distributorBusinessId: string;
  partnerBusinessId: string;
  decision: "approved" | "rejected" | "revoked";
}) {
  const action = reviewDistributorAccessAction.bind(
    null,
    distributorBusinessId,
    partnerBusinessId,
    decision,
  );
  const [state, formAction, pending] = useActionState<
    AuthActionState,
    FormData
  >(action, {});
  return (
    <form action={formAction} className="grid gap-2">
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Note (optional)
        <Input name="review_note" maxLength={1000} className="h-9" />
      </label>
      <Button
        type="submit"
        size="sm"
        variant={
          decision === "approved"
            ? "primary"
            : decision === "revoked"
              ? "destructive"
              : "outline"
        }
        disabled={pending}
      >
        {pending
          ? "Saving…"
          : decision === "approved"
            ? "Approve access"
            : decision === "revoked"
              ? "Revoke access"
              : "Reject"}
      </Button>
      {state.error && (
        <p role="alert" className="text-xs text-rose-800">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-xs text-teal-900">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function DistributorAccessReviewControls({
  distributorBusinessId,
  partnerBusinessId,
  status,
}: {
  distributorBusinessId: string;
  partnerBusinessId: string;
  status: string;
}) {
  if (status === "approved")
    return (
      <AccessDecisionForm
        distributorBusinessId={distributorBusinessId}
        partnerBusinessId={partnerBusinessId}
        decision="revoked"
      />
    );
  if (!["pending", "rejected", "revoked"].includes(status)) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <AccessDecisionForm
        distributorBusinessId={distributorBusinessId}
        partnerBusinessId={partnerBusinessId}
        decision="approved"
      />
      <AccessDecisionForm
        distributorBusinessId={distributorBusinessId}
        partnerBusinessId={partnerBusinessId}
        decision="rejected"
      />
    </div>
  );
}
