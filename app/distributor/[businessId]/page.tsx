import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { requireBusinessPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Distributor dashboard" };

type PageParams = Promise<{ businessId: string }>;

interface DistributorBusiness {
  business_id: string;
  business_name: string;
  business_type: string;
  business_status: string;
}

export default async function DistributorDashboardPage({
  params,
}: {
  params: PageParams;
}) {
  const { businessId } = await params;
  const { supabase } = await requireBusinessPermission(
    businessId,
    "distributors.access.manage",
  );
  const [{ data: businesses }, { data: accessRequests, error }] =
    await Promise.all([
      supabase.rpc("list_my_businesses"),
      supabase.rpc("list_distributor_access_requests", {
        p_distributor_business_id: businessId,
      }),
    ]);
  const { data: canManageBilling } = await supabase.rpc(
    "has_business_permission",
    { p_business_id: businessId, p_permission_key: "payments.manage" },
  );
  const business = ((businesses ?? []) as DistributorBusiness[]).find(
    (item) => item.business_id === businessId,
  );
  if (!business)
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title="Distributor access unavailable"
            description="This business is not in your active permissions."
          />
        </div>
      </main>
    );
  const pendingCount = ((accessRequests ?? []) as { status: string }[]).filter(
    (item) => item.status === "pending",
  ).length;
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <div className="flex gap-2">
            {canManageBilling === true && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/partner/${businessId}/billing`}>Billing</Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link href="/partner">Businesses</Link>
            </Button>
          </div>
        </header>
        <section className="rounded-3xl bg-[linear-gradient(120deg,_#0f5557_0%,_#13876e_100%)] p-6 text-white sm:p-9">
          <p className="text-sm font-medium text-teal-50">
            Distributor / stockist
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {business.business_name}
          </h1>
          <p className="mt-2 text-sm text-teal-50">
            Your inventory is visible only to authorized, verified partner
            businesses.
          </p>
        </section>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Distributor access requests are temporarily unavailable.
          </p>
        )}
        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Partner access requests</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-slate-950">
                {pendingCount}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Review requests from approved pharmacy, clinic, and nursing-home
                businesses.
              </p>
              <Button asChild className="mt-4">
                <Link href={`/distributor/${businessId}/access`}>
                  Manage access
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Distributor inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-slate-600">
                Add medicines and update partner-reported stock. Distributor
                inventory never appears in public search.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link href={`/partner/${businessId}/inventory`}>
                  Manage stock
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
