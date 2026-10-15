import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { BusinessDirectoryCard } from "@/components/business/business-directory-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { listPublicBusinesses } from "@/services/business-directory";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Nearby pharmacies and clinics",
  description:
    "Find approved pharmacies, clinic pharmacies and nursing home pharmacies in India with public medicine availability on DawaSetu.",
  keywords: [
    "nearby pharmacies India",
    "pharmacy medicine availability",
    "find local pharmacy",
    "approved pharmacy directory",
  ],
  alternates: { canonical: "/pharmacies" },
  openGraph: {
    title: "Nearby Pharmacies | DawaSetu",
    description:
      "Browse approved local pharmacies reporting public medicine availability.",
    url: "/pharmacies",
    type: "website",
  },
};

export default async function PharmaciesPage() {
  const directory = await listPublicBusinesses();
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/medicines">Find medicine</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/account">Account</Link>
            </Button>
          </nav>
        </header>
        <section>
          <p className="text-sm font-semibold text-teal-800">
            DawaSetu network
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Pharmacies and care partners
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            These are approved non-distributor businesses that have enabled
            public visibility and reported at least one available medicine.
          </p>
        </section>
        <div className="mt-7">
          {directory.status === "unconfigured" ? (
            <EmptyState
              title="The live directory is not connected"
              description="Configure Supabase and apply the DawaSetu migrations to list verified partners."
            />
          ) : directory.status === "error" ? (
            <EmptyState
              title="The directory is temporarily unavailable"
              description="Please try again shortly."
            />
          ) : directory.rows.length === 0 ? (
            <EmptyState
              title="No public partner listings yet"
              description="Approved partner businesses will appear here after they enable public availability and report current medicine stock."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {directory.rows.map((business) => (
                <BusinessDirectoryCard
                  key={business.business_id}
                  business={business}
                />
              ))}
            </div>
          )}
        </div>
        <p className="mt-8 rounded-xl bg-white px-4 py-3 text-xs leading-5 text-slate-500">
          DawaSetu displays partner-reported information. Call the business to
          confirm current availability before travelling.
        </p>
      </div>
    </main>
  );
}
