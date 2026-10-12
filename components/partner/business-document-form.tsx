"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { uploadBusinessDocumentAction } from "@/app/partner/[businessId]/documents/actions";

export function BusinessDocumentForm({ businessId }: { businessId: string }) {
  const [state, action, pending] = useActionState(
    uploadBusinessDocumentAction,
    {},
  );
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="business_id" value={businessId} />
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Document type
        <select
          name="document_type"
          required
          defaultValue="license"
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
        >
          <option value="license">Pharmacy or operating license</option>
          <option value="registration">Business registration</option>
          <option value="insurance">Insurance</option>
          <option value="other">Other verification document</option>
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Document file
        <input
          name="attachment"
          type="file"
          required
          accept="application/pdf,image/jpeg,image/png"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-teal-900"
        />
      </label>
      <p className="text-xs leading-5 text-slate-500">
        Files are private to this business and authorized partner reviewers.
        PDF, JPEG, and PNG files up to 768 KB are accepted.
      </p>
      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Uploading…" : "Upload for verification"}
      </Button>
    </form>
  );
}
