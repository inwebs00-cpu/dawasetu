import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { InquiryResponseControls } from "@/components/partner/inquiry-response-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireBusinessPermission } from "@/lib/auth/authorization";
import { updatePartnerOrderStatusAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Orders and inquiries" };

type PageParams = Promise<{ businessId: string }>;
type SearchParams = Promise<{ updated?: string; error?: string }>;

interface BusinessSummary {
  business_id: string;
  business_name: string;
}

interface OrderRow {
  id: string;
  status: string;
  customer_note: string | null;
  partner_note: string | null;
  created_at: string;
}

interface InquiryRow {
  id: string;
  medicine_id: string | null;
  message: string;
  status: string;
  response_message: string | null;
  created_at: string;
}

const transitions: Record<string, { value: string; label: string }[]> = {
  inquiry: [
    { value: "pending_confirmation", label: "Move to pending confirmation" },
    { value: "cancelled", label: "Cancel" },
  ],
  pending_confirmation: [
    { value: "confirmed", label: "Confirm" },
    { value: "cancelled", label: "Cancel" },
  ],
  confirmed: [
    { value: "completed", label: "Mark completed" },
    { value: "cancelled", label: "Cancel" },
  ],
  completed: [],
  cancelled: [],
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export default async function PartnerOrdersPage({
  params,
  searchParams,
}: {
  params: PageParams;
  searchParams: SearchParams;
}) {
  const [{ businessId }, query] = await Promise.all([params, searchParams]);
  const { supabase } = await requireBusinessPermission(
    businessId,
    "requests.view",
  );
  const [businessesResult, ordersResult, inquiriesResult, responsePermission] =
    await Promise.all([
      supabase.rpc("list_my_businesses"),
      supabase
        .from("orders")
        .select("id, status, customer_note, partner_note, created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("inquiries")
        .select(
          "id, medicine_id, message, status, response_message, created_at",
        )
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.rpc("has_business_permission", {
        p_business_id: businessId,
        p_permission_key: "requests.respond",
      }),
    ]);
  const business = ((businessesResult.data ?? []) as BusinessSummary[]).find(
    (item) => item.business_id === businessId,
  );
  if (!business) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title="Business access is unavailable"
            description="This business is not in your active permissions."
          />
        </div>
      </main>
    );
  }
  const orders = (ordersResult.data ?? []) as OrderRow[];
  const inquiries = (inquiriesResult.data ?? []) as InquiryRow[];
  const canRespond = responsePermission.data === true;
  const hasError = Boolean(ordersResult.error || inquiriesResult.error);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/partner/${businessId}`}>Dashboard</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/account">Account</Link>
            </Button>
          </div>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          {business.business_name}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Orders and inquiries
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Reply to customer messages inside DawaSetu and update order progress.
          Customer contact details stay private.
        </p>
        {query.updated === "order" && (
          <p
            role="status"
            className="mt-5 rounded-xl bg-teal-50 p-4 text-sm text-teal-950"
          >
            Order status updated.
          </p>
        )}
        {query.error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            The requested update could not be saved. Refresh the page and try
            again.
          </p>
        )}
        {hasError && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Some records are temporarily unavailable.
          </p>
        )}

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Customer inquiries</CardTitle>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {inquiries.filter((item) => item.status === "open").length}{" "}
                  open
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {inquiries.length === 0 ? (
                <EmptyState
                  title="No customer inquiries yet"
                  description="Messages sent from your public pharmacy profile will appear here."
                />
              ) : (
                inquiries.map((inquiry) => (
                  <article
                    key={inquiry.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge status={inquiry.status} />
                      <time className="text-xs text-slate-500">
                        {formatDate(inquiry.created_at)}
                      </time>
                    </div>
                    <p className="mt-3 text-sm leading-6 whitespace-pre-wrap text-slate-800">
                      {inquiry.message}
                    </p>
                    {inquiry.response_message ? (
                      <div className="mt-4 rounded-lg bg-teal-50 p-3">
                        <p className="text-xs font-semibold text-teal-900">
                          Your reply
                        </p>
                        <p className="mt-1 text-sm leading-6 whitespace-pre-wrap text-teal-950">
                          {inquiry.response_message}
                        </p>
                      </div>
                    ) : canRespond ? (
                      <div className="mt-4">
                        <InquiryResponseControls
                          businessId={businessId}
                          inquiryId={inquiry.id}
                          status={inquiry.status}
                          responseMessage={inquiry.response_message}
                        />
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-slate-500">
                        You have read-only access to this inquiry.
                      </p>
                    )}
                  </article>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Orders and visit requests</CardTitle>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {
                    orders.filter((item) =>
                      ["inquiry", "pending_confirmation"].includes(item.status),
                    ).length
                  }{" "}
                  to confirm
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {orders.length === 0 ? (
                <EmptyState
                  title="No order records yet"
                  description="Customer confirmations routed to this business will appear here. DawaSetu does not process medicine sales or payments."
                />
              ) : (
                orders.map((order) => (
                  <article
                    key={order.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge status={order.status} />
                      <time className="text-xs text-slate-500">
                        {formatDate(order.created_at)}
                      </time>
                    </div>
                    {order.customer_note && (
                      <p className="mt-3 text-sm leading-6 whitespace-pre-wrap text-slate-700">
                        {order.customer_note}
                      </p>
                    )}
                    {order.partner_note && (
                      <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-slate-600">
                        Partner note: {order.partner_note}
                      </p>
                    )}
                    {canRespond && transitions[order.status]?.length > 0 && (
                      <form
                        action={updatePartnerOrderStatusAction}
                        className="mt-4 flex flex-wrap items-center gap-2"
                      >
                        <input
                          type="hidden"
                          name="business_id"
                          value={businessId}
                        />
                        <input type="hidden" name="order_id" value={order.id} />
                        <label
                          className="sr-only"
                          htmlFor={`order-status-${order.id}`}
                        >
                          Update order status
                        </label>
                        <select
                          id={`order-status-${order.id}`}
                          name="status"
                          defaultValue={transitions[order.status][0].value}
                          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                        >
                          {transitions[order.status].map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" size="sm" variant="outline">
                          Save status
                        </Button>
                      </form>
                    )}
                  </article>
                ))
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
