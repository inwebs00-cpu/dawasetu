"use client";

import { useActionState } from "react";

import { requestDistributorAccessAction } from "@/app/partner/[businessId]/distributors/actions";
import { Button } from "@/components/ui/button";
import type { AuthActionState } from "@/types/auth";

export function DistributorAccessRequest({
  partnerBusinessId,
  distributorBusinessId,
  status,
}: {
  partnerBusinessId: string;
  distributorBusinessId: string;
  status: string;
}) {
  const action = requestDistributorAccessAction.bind(
    null,
    partnerBusinessId,
    distributorBusinessId,
  );
  const [state, formAction, pending] = useActionState<
    AuthActionState,
    FormData
  >(action, {});
  if (status === "approved")
    return (
      <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
        Access approved
      </p>
    );
  return (
    <form action={formAction} className="grid gap-2">
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pending || status === "pending"}
      >
        {pending
          ? "Sending…"
          : status === "pending"
            ? "Request pending"
            : status === "rejected"
              ? "Request access again"
              : status === "revoked"
                ? "Request access again"
                : "Request access"}
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
