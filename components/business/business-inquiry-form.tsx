"use client";

import { useActionState } from "react";

import { submitBusinessInquiryAction } from "@/app/pharmacies/actions";
import { Button } from "@/components/ui/button";
import type { PublicBusinessMedicine } from "@/services/business-directory";
import type { AuthActionState } from "@/types/auth";

export function BusinessInquiryForm({
  businessId,
  businessSlug,
  medicines,
}: {
  businessId: string;
  businessSlug: string;
  medicines: PublicBusinessMedicine[];
}) {
  const [state, formAction, pending] = useActionState<
    AuthActionState,
    FormData
  >(submitBusinessInquiryAction, {});

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="business_id" value={businessId} />
      <input type="hidden" name="business_slug" value={businessSlug} />
      <label className="grid gap-1 text-sm font-medium text-slate-800">
        Medicine (optional)
        <select
          name="medicine_id"
          defaultValue=""
          className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
        >
          <option value="">General inquiry</option>
          {medicines.map((medicine) => (
            <option key={medicine.medicine_id} value={medicine.medicine_id}>
              {medicine.product_name} · {medicine.strength}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-800">
        Your message
        <textarea
          name="message"
          required
          minLength={1}
          maxLength={1000}
          rows={4}
          placeholder="Ask the pharmacy about availability or visiting hours."
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900"
        />
      </label>
      <p className="text-xs leading-5 text-slate-500">
        The pharmacy can reply in DawaSetu. Do not include sensitive health or
        payment information.
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send inquiry"}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-rose-800">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-sm text-teal-900">
          {state.message}
        </p>
      )}
    </form>
  );
}
