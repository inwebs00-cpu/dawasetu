import Link from "next/link";
import type { Metadata } from "next";

import { RequestResponseControls } from "@/components/partner/request-response-controls";
import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireBusinessPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nearby medicine requests" };

type PageParams = Promise<{ businessId: string }>;

interface MedicineRequest {
  request_id: string;
  requested_medicine_name: string;
  composition_text: string | null;
  strength: string | null;
  quantity: number;
  approximate_area: string | null;
  request_time: string;
  expires_at: string;
  status: string;
  response: string | null;
}

interface BusinessAccess {
  business_id: string;
  business_name: string;
}

export default async function PartnerRequestsPage({
  params,
}: {
  params: PageParams;
}) {
  const { businessId } = await params;
  const { supabase } = await requireBusinessPermission(
    businessId,
    "requests.view",
  );
  const [{ data: businesses }, { data, error }] = await Promise.all([
    supabase.rpc("list_my_businesses"),
    supabase.rpc("list_business_medicine_requests", {
      p_business_id: businessId,
    }),
  ]);
  const business = ((businesses ?? []) as BusinessAccess[]).find(
    (item) => item.business_id === businessId,
  );
  if (!business)
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title="Business access is unavailable"
            description="This business is not in your active permissions."
          />
          <div className="mt-5 text-center">
            <Button asChild variant="outline">
              <Link href="/partner">Your businesses</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  const requests = (error ? [] : (data ?? [])) as MedicineRequest[];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href={`/partner/${businessId}`}>Dashboard</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          {business.business_name}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Nearby medicine requests
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Requests are matched to your mapped area and expire after 24 hours.
          You see an approximate area only; customer phone and exact location
          stay private.
        </p>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900"
          >
            Requests are temporarily unavailable. Please try again later.
          </p>
        )}
        {!error && requests.length === 0 && (
          <Card className="mt-6">
            <CardContent className="p-6">
              <EmptyState
                title="No nearby requests right now"
                description="New requests from your mapped area will appear here while they are active."
              />
            </CardContent>
          </Card>
        )}
        <div className="mt-6 grid gap-4">
          {requests.map((request) => (
            <Card key={request.request_id}>
              <CardContent className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:p-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-950">
                      {request.requested_medicine_name}
                    </h2>
                    <StatusBadge status={request.response ?? request.status} />
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    {request.composition_text ?? "Composition not supplied"}
                    {request.strength ? ` · ${request.strength}` : ""}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Quantity: {request.quantity} · Approximate area:{" "}
                    {request.approximate_area ?? "Mapped area"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Requested{" "}
                    {new Date(request.request_time).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    · Expires{" "}
                    {new Date(request.expires_at).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <div className="sm:w-72">
                  <RequestResponseControls
                    businessId={businessId}
                    requestId={request.request_id}
                    response={request.response}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
