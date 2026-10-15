import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { DistributorInquiryForm } from "@/components/partner/distributor-inquiry-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireBusinessPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Authorized distributor availability",
};

type PageParams = Promise<{ businessId: string; distributorId: string }>;
type SearchParams = Promise<{ q?: string }>;

interface NetworkRow {
  distributor_business_id: string;
  distributor_name: string;
  distributor_area: string | null;
  access_status: string;
}

interface StockRow {
  medicine_id: string;
  product_name: string;
  brand_name: string | null;
  composition: string | null;
  strength: string;
  manufacturer_name: string | null;
  inventory_status: string;
  quantity: number | null;
  last_updated_at: string;
}

export default async function DistributorAvailabilityPage({
  params,
  searchParams,
}: {
  params: PageParams;
  searchParams: SearchParams;
}) {
  const { businessId, distributorId } = await params;
  const query = ((await searchParams).q ?? "").trim().slice(0, 120);
  if (!/^[0-9a-f-]{36}$/i.test(distributorId))
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title="Distributor not found"
            description="This distributor identifier is invalid."
          />
        </div>
      </main>
    );
  const { supabase } = await requireBusinessPermission(
    businessId,
    "distributors.view",
  );
  const { data: network, error: networkError } = await supabase.rpc(
    "list_distributor_network",
    { p_partner_business_id: businessId },
  );
  const distributor = ((network ?? []) as NetworkRow[]).find(
    (item) => item.distributor_business_id === distributorId,
  );
  let stock: StockRow[] = [];
  let stockError = false;
  if (distributor?.access_status === "approved") {
    const result = await supabase.rpc(
      "list_distributor_inventory_for_partner",
      {
        p_partner_business_id: businessId,
        p_distributor_business_id: distributorId,
        p_query: query || null,
      },
    );
    stockError = Boolean(result.error);
    stock = (result.data ?? []) as StockRow[];
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href={`/partner/${businessId}/distributors`}>
              Distributor network
            </Link>
          </Button>
        </header>
        {networkError || !distributor ? (
          <Card>
            <CardContent className="p-6">
              <EmptyState
                title="Distributor access unavailable"
                description="The distributor is not available or this business has not been authorized to view its inventory."
              />
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-sm font-semibold text-teal-800">
              B2B-only availability
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
              {distributor.distributor_name}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Authorized partner inventory. This stock is private and is never
              part of public medicine search.
            </p>
            {distributor.access_status !== "approved" ? (
              <Card className="mt-6">
                <CardContent className="p-6">
                  <EmptyState
                    title="Access not approved"
                    description="Request access from the distributor before viewing availability."
                  />
                  <div className="mt-4 text-center">
                    <Button asChild variant="outline">
                      <Link href={`/partner/${businessId}/distributors`}>
                        Back to network
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <form
                  method="get"
                  className="mt-6 grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto]"
                >
                  <label className="grid gap-1 text-xs font-medium text-slate-700">
                    Search medicine, composition, strength, or manufacturer
                    <input
                      name="q"
                      defaultValue={query}
                      maxLength={120}
                      className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal text-slate-900"
                    />
                  </label>
                  <div className="flex items-end">
                    <Button type="submit" variant="secondary">
                      Search availability
                    </Button>
                  </div>
                </form>
                {stockError && (
                  <p
                    role="alert"
                    className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
                  >
                    Authorized inventory is temporarily unavailable.
                  </p>
                )}
                {!stockError && stock.length === 0 && (
                  <Card className="mt-5">
                    <CardContent className="p-6">
                      <EmptyState
                        title="No matching availability"
                        description="The distributor has not reported available stock for this search."
                      />
                    </CardContent>
                  </Card>
                )}
                {!stockError && (
                  <section className="mt-5 grid gap-3 sm:grid-cols-2">
                    {stock.map((item) => (
                      <Card key={item.medicine_id}>
                        <CardContent className="p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <h2 className="font-semibold text-slate-950">
                              {item.product_name}
                            </h2>
                            <StatusBadge status={item.inventory_status} />
                          </div>
                          <p className="mt-1 text-sm text-slate-600">
                            {item.brand_name ? `${item.brand_name} · ` : ""}
                            {item.strength}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {item.composition ?? "Composition not supplied"}
                            {item.manufacturer_name
                              ? ` · ${item.manufacturer_name}`
                              : ""}
                          </p>
                          <p className="mt-3 text-xs text-slate-500">
                            Reported{" "}
                            {new Date(item.last_updated_at).toLocaleString(
                              "en-IN",
                              { dateStyle: "medium", timeStyle: "short" },
                            )}
                            {item.quantity !== null
                              ? ` · Quantity ${item.quantity}`
                              : ""}
                          </p>
                          <DistributorInquiryForm
                            partnerBusinessId={businessId}
                            distributorBusinessId={distributorId}
                            medicineId={item.medicine_id}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
