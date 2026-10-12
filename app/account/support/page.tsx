import Link from "next/link";
import type { Metadata } from "next";

import { SupportTicketReplyForm } from "@/components/support/support-ticket-reply-form";
import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { downloadSupportAttachmentAction } from "@/app/support/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My support tickets" };

interface SupportTicket {
  id: string;
  ticket_number: number;
  subject: string;
  category: string;
  description: string;
  attachment_path: string | null;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface SupportMessage {
  id: string;
  ticket_id: string;
  author_user_id: string;
  message: string;
  created_at: string;
}

export default async function AccountSupportPage() {
  const { supabase, user } = await requireAuthenticatedUser();
  const { data: ticketData, error } = await supabase
    .from("support_tickets")
    .select(
      "id, ticket_number, subject, category, description, attachment_path, status, priority, created_at, updated_at",
    )
    .eq("requester_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const tickets = (ticketData ?? []) as SupportTicket[];
  const ticketIds = tickets.map((ticket) => ticket.id);
  const messagesResult = ticketIds.length
    ? await supabase
        .from("support_ticket_messages")
        .select("id, ticket_id, author_user_id, message, created_at")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: true })
    : { data: [], error: null };
  const messages = (messagesResult.data ?? []) as SupportMessage[];
  const messagesByTicket = new Map<string, SupportMessage[]>();
  for (const message of messages) {
    const current = messagesByTicket.get(message.ticket_id) ?? [];
    current.push(message);
    messagesByTicket.set(message.ticket_id, current);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/account">Account</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/contact">New support ticket</Link>
            </Button>
          </div>
        </header>
        <p className="text-sm font-semibold text-teal-800">Customer care</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          My support tickets
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Follow up with DawaSetu support. Only you and authorized support staff
          can read these conversations.
        </p>
        {error || messagesResult.error ? (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Support conversations are temporarily unavailable.
          </p>
        ) : tickets.length === 0 ? (
          <Card className="mt-6">
            <CardContent className="p-6">
              <EmptyState
                title="No support tickets yet"
                description="When you contact DawaSetu support, your private ticket and replies will appear here."
              />
            </CardContent>
          </Card>
        ) : (
          <section className="mt-6 grid gap-4">
            {tickets.map((ticket) => (
              <Card key={ticket.id}>
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
                        {ticket.category.replaceAll("_", " ")} · Submitted{" "}
                        {new Date(ticket.created_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
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
                      <input type="hidden" name="ticket_id" value={ticket.id} />
                      <input type="hidden" name="return_to" value="account" />
                      <Button type="submit" variant="outline" size="sm">
                        Download private attachment
                      </Button>
                    </form>
                  )}
                  {(messagesByTicket.get(ticket.id) ?? []).length > 0 && (
                    <div className="mt-4 grid gap-2" aria-label="Conversation">
                      {(messagesByTicket.get(ticket.id) ?? []).map(
                        (message) => (
                          <article
                            key={message.id}
                            className={`rounded-xl border p-3 ${message.author_user_id === user.id ? "border-teal-100 bg-teal-50/60" : "border-slate-200 bg-white"}`}
                          >
                            <p className="text-xs font-semibold text-slate-700">
                              {message.author_user_id === user.id
                                ? "You"
                                : "DawaSetu Support"}{" "}
                              ·{" "}
                              {new Date(message.created_at).toLocaleString(
                                "en-IN",
                                { dateStyle: "medium", timeStyle: "short" },
                              )}
                            </p>
                            <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-slate-700">
                              {message.message}
                            </p>
                          </article>
                        ),
                      )}
                    </div>
                  )}
                  {ticket.status !== "resolved" &&
                  ticket.status !== "closed" ? (
                    <div className="mt-4">
                      <SupportTicketReplyForm ticketId={ticket.id} />
                    </div>
                  ) : (
                    <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">
                      This ticket is closed. Create a new ticket if you need
                      more help.
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
