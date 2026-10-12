import Link from "next/link";
import type { Metadata } from "next";

import { DistributorAccessRequest } from "@/components/partner/distributor-access-request";
import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { requireBusinessPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Distributor network" };

type PageParams = Promise<{ businessId: string }>;

interface DistributorRow {
  distributor_business_id: string;
  distributor_name: string;
  distributor_area: string | null;
  access_status: string;
  requested_at: string | null;
}

export default async function PartnerDistributorNetworkPage({
  params,
}: {
  params: PageParams;
}) {
  const { businessId } = await params;
  const { supabase } = await requireBusinessPermission(
    businessId,
    "distributors.view",
  );
  const [businessesResult, networkResult] = await Promise.all([
    supabase.rpc("list_my_businesses"),
    supabase.rpc("list_distributor_network", {
      p_partner_business_id: businessId,
    }),
  ]);
  const businesses = (businessesResult.data ?? []) as {
    business_id: string;
    business_name: string;
  }[];
  const business = businesses.find((item) => item.business_id === businessId);
  if (!business)
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
  const distributors = (networkResult.data ?? []) as DistributorRow[];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href={`/partner/${businessId}`}>Dashboard</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Verified partner network
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Distributors and stockists
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Request access from a verified distributor. Their stock remains
          private until they approve your business.
        </p>
        {networkResult.error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Your business needs approval before it can access the distributor
            network.
          </p>
        )}
        {!networkResult.error && distributors.length === 0 && (
          <Card className="mt-6">
            <CardContent className="p-6">
              <EmptyState
                title="No verified distributors are listed"
                description="Approved distributor businesses will appear here when they join the network."
              />
            </CardContent>
          </Card>
        )}
        {!networkResult.error && (
          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            {distributors.map((distributor) => (
              <Card key={distributor.distributor_business_id}>
                <CardContent className="grid gap-4 p-5">
                  <div>
                    <h2 className="font-semibold text-slate-950">
                      {distributor.distributor_name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {distributor.distributor_area ?? "Location not listed"}
                    </p>
                  </div>
                  {distributor.access_status === "approved" ? (
                    <Button asChild size="sm">
                      <Link
                        href={`/partner/${businessId}/distributors/${distributor.distributor_business_id}`}
                      >
                        View authorized availability
                      </Link>
                    </Button>
                  ) : (
                    <DistributorAccessRequest
                      partnerBusinessId={businessId}
                      distributorBusinessId={
                        distributor.distributor_business_id
                      }
                      status={distributor.access_status}
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
