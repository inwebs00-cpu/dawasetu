"use client";

import { useActionState } from "react";

import { createSupportTicketAction } from "@/app/contact/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SupportTicketForm() {
  const [state, action, pending] = useActionState(
    createSupportTicketAction,
    {},
  );
  return (
    <form action={action} className="grid gap-4">
      <label
        className="grid gap-2 text-sm font-medium text-slate-800"
        htmlFor="ticket-subject"
      >
        Subject
        <Input
          id="ticket-subject"
          name="subject"
          minLength={3}
          maxLength={200}
          required
        />
      </label>
      <label
        className="grid gap-2 text-sm font-medium text-slate-800"
        htmlFor="ticket-category"
      >
        Category
        <select
          id="ticket-category"
          name="category"
          required
          className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
        >
          <option value="">Choose a category</option>
          <option value="account">Account</option>
          <option value="partner onboarding">Partner onboarding</option>
          <option value="medicine availability">Medicine availability</option>
          <option value="privacy or safety">Privacy or safety</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label
        className="grid gap-2 text-sm font-medium text-slate-800"
        htmlFor="ticket-description"
      >
        Description
        <textarea
          id="ticket-description"
          name="description"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
        />
      </label>
      <label
        className="grid gap-2 text-sm font-medium text-slate-800"
        htmlFor="ticket-attachment"
      >
        Attachment (optional)
        <input
          id="ticket-attachment"
          name="attachment"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-teal-900"
        />
      </label>
      {state.error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          role="status"
          className="rounded-xl bg-teal-50 px-3.5 py-3 text-sm text-teal-900"
        >
          {state.message}
        </p>
      )}
      <p className="text-xs leading-5 text-slate-500">
        Attach only files needed to describe the support issue. Do not include
        prescriptions, diagnosis details, or patient medical records.
      </p>
      <p className="text-xs leading-5 text-slate-500">
        Private attachments: PDF, JPEG, or PNG, up to 768 KB.
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit support ticket"}
      </Button>
    </form>
  );
}
