import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePlatformPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Orders and inquiries" };

interface OrderRow {
  id: string;
  business_id: string;
  status: string;
  created_at: string;
}

interface InquiryRow {
  id: string;
  business_id: string;
  message: string;
  status: string;
  created_at: string;
}

interface AvailabilityRequestRow {
  id: string;
  requested_medicine_name: string;
  composition_text: string | null;
  strength: string | null;
  quantity: number;
  status: string;
  expires_at: string;
  created_at: string;
}

interface BusinessRow {
  id: string;
  business_name: string;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export default async function AdminFulfillmentPage() {
  const { supabase } = await requirePlatformPermission("requests.view");
  const [
    ordersResult,
    inquiriesResult,
    availabilityRequestsResult,
    partnerPermission,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id, business_id, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("inquiries")
      .select("id, business_id, message, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("medicine_requests")
      .select(
        "id, requested_medicine_name, composition_text, strength, quantity, status, expires_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.rpc("has_platform_permission", {
      p_permission_key: "partners.view",
    }),
  ]);
  const orders = (ordersResult.data ?? []) as OrderRow[];
  const inquiries = (inquiriesResult.data ?? []) as InquiryRow[];
  const availabilityRequests = (availabilityRequestsResult.data ??
    []) as AvailabilityRequestRow[];
  const businessIds = [
    ...new Set([
      ...orders.map((item) => item.business_id),
      ...inquiries.map((item) => item.business_id),
    ]),
  ];
  const businessesResult =
    partnerPermission.data === true && businessIds.length > 0
      ? await supabase
          .from("businesses")
          .select("id, business_name")
          .in("id", businessIds)
      : { data: [], error: null };
  const businesses = (businessesResult.data ?? []) as BusinessRow[];
  const businessNames = new Map(
    businesses.map((item) => [item.id, item.business_name]),
  );
  const loadError = Boolean(
    ordersResult.error ||
    inquiriesResult.error ||
    availabilityRequestsResult.error,
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin">Dashboard</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Network operations
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Fulfillment and availability requests
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Review medicine availability requests, customer inquiries, and
          partner-confirmation records. Exact customer coordinates and phone
          fields are not queried by this view.
        </p>
        {loadError && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Some fulfillment records are temporarily unavailable.
          </p>
        )}
        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              "Open availability requests",
              availabilityRequests.filter((item) =>
                ["open", "partially_fulfilled"].includes(item.status),
              ).length,
            ],
            [
              "Open inquiries",
              inquiries.filter((item) => item.status === "open").length,
            ],
            [
              "Orders to confirm",
              orders.filter((item) =>
                ["inquiry", "pending_confirmation"].includes(item.status),
              ).length,
            ],
            [
              "Confirmed or completed",
              orders.filter((item) =>
                ["confirmed", "completed"].includes(item.status),
              ).length,
            ],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardContent className="p-5">
                <p className="text-sm text-slate-600">{label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  {Number(value).toLocaleString("en-IN")}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>
        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Recent medicine requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {availabilityRequests.length === 0 ? (
                <EmptyState
                  title="No availability requests recorded"
                  description="Customer requests for nearby medicines will appear here."
                />
              ) : (
                availabilityRequests.slice(0, 10).map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge status={item.status} />
                      <time className="text-xs text-slate-500">
                        {formatDate(item.created_at)}
                      </time>
                    </div>
                    <p className="mt-2 font-medium text-slate-900">
                      {item.requested_medicine_name}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.composition_text ?? "Composition not supplied"}
                      {item.strength ? ` · ${item.strength}` : ""} · Qty{" "}
                      {item.quantity}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Expires {formatDate(item.expires_at)}
                    </p>
                  </article>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent inquiries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {inquiries.length === 0 ? (
                <EmptyState
                  title="No inquiries recorded"
                  description="Customer messages to public partner profiles will appear here."
                />
              ) : (
                inquiries.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge status={item.status} />
                      <time className="text-xs text-slate-500">
                        {formatDate(item.created_at)}
                      </time>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {businessNames.get(item.business_id) ??
                        `Business ${item.business_id.slice(0, 8)}`}
                    </p>
                    <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-slate-800">
                      {item.message}
                    </p>
                  </article>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent orders</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {orders.length === 0 ? (
                <EmptyState
                  title="No order records"
                  description="The network does not process medicine sales or payments. Partner-confirmation records will appear here."
                />
              ) : (
                orders.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge status={item.status} />
                      <time className="text-xs text-slate-500">
                        {formatDate(item.created_at)}
                      </time>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {businessNames.get(item.business_id) ??
                        `Business ${item.business_id.slice(0, 8)}`}
                    </p>
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
