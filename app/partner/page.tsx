import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Partner businesses" };

interface BusinessSummary {
  business_id: string;
  business_name: string;
  business_slug: string;
  business_type: string;
  business_status: string;
  public_availability_enabled: boolean;
}

export default async function PartnerHomePage() {
  const { supabase, profile } = await requireAuthenticatedUser();
  const { data, error } = await supabase.rpc("list_my_businesses");
  const businesses = error ? [] : ((data ?? []) as BusinessSummary[]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/account">Account</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/">Public site</Link>
            </Button>
          </nav>
        </header>
        <p className="text-sm font-semibold text-teal-800">Partner network</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Your businesses
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Signed in as {profile.full_name}. Business access depends on approval
          and assigned permissions.
        </p>
        {businesses.length === 0 ? (
          <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <EmptyState
              title="No partner business is linked to this account"
              description="Register a pharmacy, clinic pharmacy or nursing-home pharmacy for DawaSetu review."
            />
            <Card>
              <CardHeader>
                <CardTitle>Join the network</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">
                  Your registration is kept private while pending. Public
                  listing and inventory visibility are enabled only after
                  review.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/partner/register">Register a business</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            {businesses.map((business) => {
              const isDistributor = business.business_type
                .toLowerCase()
                .includes("distributor");
              return (
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
                    <p className="text-sm leading-6 text-slate-600">
                      {isDistributor
                        ? "Public inventory:"
                        : "Public availability:"}{" "}
                      <span className="font-medium text-slate-800">
                        {isDistributor
                          ? "Never"
                          : business.public_availability_enabled
                            ? "On"
                            : "Off"}
                      </span>
                    </p>
                    {business.business_status === "pending" && (
                      <p className="mt-2 text-sm leading-6 text-amber-800">
                        Your business is awaiting review. Inventory changes are
                        private until approval.
                      </p>
                    )}
                    <Button asChild variant="outline" className="mt-4">
                      <Link
                        href={
                          isDistributor
                            ? `/distributor/${business.business_id}`
                            : `/partner/${business.business_id}`
                        }
                      >
                        Open dashboard
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
