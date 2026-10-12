"use client";

import { useActionState } from "react";

import { replyToSupportTicketAction } from "@/app/account/support-actions";
import { Button } from "@/components/ui/button";

export function SupportTicketReplyForm({ ticketId }: { ticketId: string }) {
  const [state, action, pending] = useActionState(
    replyToSupportTicketAction,
    {},
  );
  return (
    <form action={action} className="grid gap-3 border-t border-slate-100 pt-4">
      <input type="hidden" name="ticket_id" value={ticketId} />
      <label className="grid gap-1 text-sm font-medium text-slate-800">
        Reply to support
        <textarea
          name="message"
          required
          minLength={1}
          maxLength={5000}
          rows={3}
          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
        />
      </label>
      {state.error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          role="status"
          className="rounded-xl bg-teal-50 p-3 text-sm text-teal-900"
        >
          {state.message}
        </p>
      )}
      <Button
        type="submit"
        size="sm"
        className="justify-self-start"
        disabled={pending}
      >
        {pending ? "Sending…" : "Send reply"}
      </Button>
    </form>
  );
}
