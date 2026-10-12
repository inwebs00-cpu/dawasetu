import Link from "next/link";
import type { Metadata } from "next";

import { DistributorAccessReviewControls } from "@/components/distributor/access-review-controls";
import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireBusinessPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Partner access requests" };

type PageParams = Promise<{ businessId: string }>;

interface AccessRequest {
  access_id: string;
  partner_business_id: string;
  partner_name: string;
  partner_area: string | null;
  partner_type: string;
  status: string;
  requested_at: string;
  review_note: string | null;
}

export default async function DistributorAccessPage({
  params,
}: {
  params: PageParams;
}) {
  const { businessId } = await params;
  const { supabase } = await requireBusinessPermission(
    businessId,
    "distributors.access.manage",
  );
  const { data, error } = await supabase.rpc(
    "list_distributor_access_requests",
    { p_distributor_business_id: businessId },
  );
  const requests = (data ?? []) as AccessRequest[];
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href={`/distributor/${businessId}`}>Dashboard</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Distributor controls
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Partner access
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Approving a business grants its authorized team access to your
          reported in-stock inventory. You can revoke access at any time.
        </p>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Access requests are temporarily unavailable.
          </p>
        )}
        {!error && requests.length === 0 && (
          <Card className="mt-6">
            <CardContent className="p-6">
              <EmptyState
                title="No partner access requests"
                description="Verified partners may request access through their DawaSetu business account."
              />
            </CardContent>
          </Card>
        )}
        {!error && (
          <section className="mt-6 grid gap-4">
            {requests.map((request) => (
              <Card key={request.access_id}>
                <CardContent className="grid gap-4 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-slate-950">
                          {request.partner_name}
                        </h2>
                        <StatusBadge status={request.status} />
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {request.partner_type}
                        {request.partner_area
                          ? ` · ${request.partner_area}`
                          : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Requested{" "}
                        {new Date(request.requested_at).toLocaleString(
                          "en-IN",
                          { dateStyle: "medium", timeStyle: "short" },
                        )}
                      </p>
                      {request.review_note && (
                        <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                          Note: {request.review_note}
                        </p>
                      )}
                    </div>
                  </div>
                  {["pending", "approved", "rejected", "revoked"].includes(
                    request.status,
                  ) && (
                    <DistributorAccessReviewControls
                      distributorBusinessId={businessId}
                      partnerBusinessId={request.partner_business_id}
                      status={request.status}
                    />
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
