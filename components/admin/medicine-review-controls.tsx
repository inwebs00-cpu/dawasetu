"use client";

import { useActionState } from "react";

import { reviewAdminMedicineAction } from "@/app/admin/medicines/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthActionState } from "@/types/auth";

function ReviewDecisionForm({
  medicineId,
  decision,
}: {
  medicineId: string;
  decision: "approved" | "rejected";
}) {
  const action = reviewAdminMedicineAction.bind(null, medicineId, decision);
  const [state, formAction, pending] = useActionState<
    AuthActionState,
    FormData
  >(action, {});
  return (
    <form action={formAction} className="grid gap-2">
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Review note (optional)
        <Input name="review_note" maxLength={1000} className="h-9" />
      </label>
      <Button
        type="submit"
        size="sm"
        variant={decision === "approved" ? "primary" : "outline"}
        disabled={pending}
      >
        {pending ? "Saving…" : decision === "approved" ? "Approve" : "Reject"}
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

export function MedicineReviewControls({
  medicineId,
  status,
}: {
  medicineId: string;
  status: string;
}) {
  if (status === "approved") return null;
  return (
    <div className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
      <ReviewDecisionForm medicineId={medicineId} decision="approved" />
      <ReviewDecisionForm medicineId={medicineId} decision="rejected" />
    </div>
  );
}
