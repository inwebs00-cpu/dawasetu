import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePlatformPermission } from "@/lib/auth/authorization";
import { downloadSupportAttachmentAction } from "@/app/support/actions";

import {
  assignSupportTicketAction,
  updateSupportTicketAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Support tickets" };

type TicketMessage = {
  message_id: string;
  author_name: string;
  message: string;
  is_internal: boolean;
  created_at: string;
};

interface SupportAssignee {
  user_id: string;
  full_name: string;
  email: string;
}

interface SupportTicket {
  ticket_id: string;
  ticket_number: number;
  requester_name: string;
  requester_phone: string | null;
  business_name: string | null;
  category: string;
  subject: string;
  description: string;
  attachment_path: string | null;
  priority: string;
  status: string;
  assigned_to: string | null;
  assigned_name: string | null;
  created_at: string;
  updated_at: string;
  messages: TicketMessage[];
}

type SearchParams = Promise<{
  status?: string;
  updated?: string;
  error?: string;
}>;
const ticketStatuses = ["open", "in_progress", "waiting", "resolved", "closed"];
const priorities = ["low", "normal", "high", "urgent"];

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const selectedStatus = ticketStatuses.includes(params.status ?? "")
    ? params.status!
    : null;
  const { supabase } = await requirePlatformPermission("support.manage");
  const [ticketsResult, assigneesResult] = await Promise.all([
    supabase.rpc("admin_list_support_tickets", {
      p_status: selectedStatus,
      p_limit: 50,
      p_offset: 0,
    }),
    supabase.rpc("admin_list_support_assignees"),
  ]);
  const { data, error } = ticketsResult;
  const assignees = (assigneesResult.data ?? []) as SupportAssignee[];
  const tickets = (data ?? []) as SupportTicket[];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin">Dashboard</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">Customer care</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Support tickets
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Assign cases, update their status and priority, and send public
          replies or private internal notes.
        </p>

        <form
          method="get"
          className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto]"
        >
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Status
            <select
              name="status"
              defaultValue={selectedStatus ?? ""}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
            >
              <option value="">All statuses</option>
              {ticketStatuses.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <Button type="submit" variant="secondary">
              Filter tickets
            </Button>
          </div>
        </form>
        {params.updated && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"
          >
            {params.updated === "assigned"
              ? "Ticket assignment saved."
              : "Ticket updated."}
          </p>
        )}
        {params.error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-900"
          >
            {params.error === "attachment"
              ? "The private attachment is unavailable or you are not allowed to access it."
              : "The ticket could not be updated. Check the fields and try again."}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Support tickets are temporarily unavailable.
          </p>
        )}
        {!error && tickets.length === 0 && (
          <Card className="mt-5">
            <CardContent className="p-6">
              <EmptyState
                title="No tickets in this view"
                description="New customer and partner support requests will appear here."
              />
            </CardContent>
          </Card>
        )}

        {!error && (
          <section className="mt-5 grid gap-4">
            {tickets.map((ticket) => (
              <Card key={ticket.ticket_id}>
                <CardContent className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-slate-950">
                          #{ticket.ticket_number} · {ticket.subject}
                        </h2>
                        <StatusBadge status={ticket.status} />
                        <StatusBadge status={ticket.priority} />
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {ticket.category.replaceAll("_", " ")}
                        {ticket.business_name
                          ? ` · ${ticket.business_name}`
                          : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {ticket.requester_name}
                        {ticket.requester_phone
                          ? ` · ${ticket.requester_phone}`
                          : ""}{" "}
                        · Submitted{" "}
                        {new Date(ticket.created_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Assigned to {ticket.assigned_name ?? "No one"}
                      </p>
                      <form
                        action={assignSupportTicketAction}
                        className="mt-3 flex flex-wrap items-end gap-2"
                      >
                        <input
                          type="hidden"
                          name="ticket_id"
                          value={ticket.ticket_id}
                        />
                        <label className="grid w-full max-w-md gap-1 text-xs font-medium text-slate-700">
                          Assign to support team member
                          <select
                            name="assigned_to"
                            defaultValue={ticket.assigned_to ?? ""}
                            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                          >
                            <option value="">Unassigned</option>
                            {assignees.map((assignee) => (
                              <option
                                key={assignee.user_id}
                                value={assignee.user_id}
                              >
                                {assignee.full_name} · {assignee.email}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Button type="submit" size="sm" variant="outline">
                          Save assignment
                        </Button>
                      </form>
                    </div>
                  </div>
                  <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 whitespace-pre-wrap text-slate-700">
                    {ticket.description}
                  </p>
                  {ticket.attachment_path && (
                    <form
                      action={downloadSupportAttachmentAction}
                      className="mt-3"
                    >
                      <input
                        type="hidden"
                        name="ticket_id"
                        value={ticket.ticket_id}
                      />
                      <input type="hidden" name="return_to" value="admin" />
                      <Button type="submit" variant="outline" size="sm">
                        Download private attachment
                      </Button>
                    </form>
                  )}
                  {ticket.messages.length > 0 && (
                    <div
                      className="mt-4 grid gap-2"
                      aria-label="Ticket replies and notes"
                    >
                      {ticket.messages.map((message) => (
                        <article
                          key={message.message_id}
                          className={`rounded-xl border p-3 ${message.is_internal ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}
                        >
                          <p className="text-xs font-semibold text-slate-700">
                            {message.is_internal ? "Internal note" : "Reply"} ·{" "}
                            {message.author_name} ·{" "}
                            {new Date(message.created_at).toLocaleString(
                              "en-IN",
                              { dateStyle: "medium", timeStyle: "short" },
                            )}
                          </p>
                          <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-slate-700">
                            {message.message}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                  <form
                    action={updateSupportTicketAction}
                    className="mt-4 grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2"
                  >
                    <input
                      type="hidden"
                      name="ticket_id"
                      value={ticket.ticket_id}
                    />
                    <label className="grid gap-1 text-xs font-medium text-slate-700">
                      Status
                      <select
                        name="status"
                        defaultValue={ticket.status}
                        className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                      >
                        {ticketStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-slate-700">
                      Priority
                      <select
                        name="priority"
                        defaultValue={ticket.priority}
                        className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                      >
                        {priorities.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-slate-700 sm:col-span-2">
                      Reply or note
                      <textarea
                        name="message"
                        maxLength={5000}
                        rows={3}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900"
                        placeholder="Leave blank to update status only."
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        name="internal"
                        className="size-4 accent-teal-700"
                      />
                      Keep this as an internal note
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        name="assign_to_me"
                        className="size-4 accent-teal-700"
                      />
                      Assign to me
                    </label>
                    <div className="sm:col-span-2">
                      <Button type="submit">Save ticket</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
