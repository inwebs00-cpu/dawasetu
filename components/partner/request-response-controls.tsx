"use client";

import { useActionState } from "react";

import { respondToMedicineRequestAction } from "@/app/partner/[businessId]/requests/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthActionState } from "@/types/auth";

function ResponseForm({
  businessId,
  requestId,
  response,
}: {
  businessId: string;
  requestId: string;
  response: "available" | "unavailable";
}) {
  const action = respondToMedicineRequestAction.bind(
    null,
    businessId,
    requestId,
    response,
  );
  const [state, formAction, pending] = useActionState<
    AuthActionState,
    FormData
  >(action, {});
  return (
    <form action={formAction} className="grid gap-2">
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Optional note to the customer
        <Input
          name="message"
          maxLength={1000}
          className="h-9"
          placeholder="For example: please call before visiting"
        />
      </label>
      <Button
        type="submit"
        variant={response === "available" ? "primary" : "outline"}
        size="sm"
        disabled={pending}
      >
        {pending
          ? "Saving…"
          : response === "available"
            ? "I have it"
            : "Can’t help"}
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

export function RequestResponseControls({
  businessId,
  requestId,
  response,
}: {
  businessId: string;
  requestId: string;
  response: string | null;
}) {
  if (response)
    return (
      <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
        Your response:{" "}
        <span className="font-medium">
          {response === "available" ? "I have it" : "Can’t help"}
        </span>
      </p>
    );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ResponseForm
        businessId={businessId}
        requestId={requestId}
        response="available"
      />
      <ResponseForm
        businessId={businessId}
        requestId={requestId}
        response="unavailable"
      />
    </div>
  );
}
