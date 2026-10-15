import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Distributor businesses" };

interface DistributorSummary {
  business_id: string;
  business_name: string;
  business_type: string;
  business_status: string;
}

export default async function DistributorHomePage() {
  const { profile, supabase } = await requireAuthenticatedUser();
  const { data, error } = await supabase.rpc("list_my_businesses");
  const distributors = ((data ?? []) as DistributorSummary[]).filter((item) =>
    item.business_type.toLowerCase().includes("distributor"),
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/partner">Businesses</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/account">Account</Link>
            </Button>
          </nav>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Private B2B network
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Distributor businesses
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Signed in as {profile.full_name}. Only distributor businesses linked
          to your account appear here.
        </p>
        {error ? (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
          >
            Distributor access could not be loaded. Please refresh and try
            again.
          </p>
        ) : distributors.length === 0 ? (
          <div className="mt-7">
            <EmptyState
              title="No distributor business is linked to this account"
              description="Distributor workspaces are assigned after business verification by the DawaSetu team. Public sign-up does not grant access to private stock."
            />
          </div>
        ) : (
          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            {distributors.map((business) => (
              <Card key={business.business_id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{business.business_name}</CardTitle>
                      <p className="mt-1 text-sm text-slate-600">
                        {business.business_type}
                      </p>
                    </div>
                    <StatusBadge status={business.business_status} />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">
                    Stock is visible only to authorized, verified partners.
                  </p>
                  <Button asChild variant="outline" className="mt-4">
                    <Link href={`/distributor/${business.business_id}`}>
                      Open distributor dashboard
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
