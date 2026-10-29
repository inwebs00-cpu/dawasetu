import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { NearbyBusinessFinder } from "@/components/business/nearby-business-finder";
import { Button } from "@/components/ui/button";
import { listPublicBusinesses } from "@/services/business-directory";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Nearby Pharmacies, Hospitals and Diagnostic Centres",
  description:
    "Find approved pharmacies, hospitals, nursing homes, diagnostic centres and medical laboratories near you on DawaSetu.",
  keywords: [
    "nearby pharmacies India",
    "nearby hospitals India",
    "diagnostic centres near me",
    "medical laboratories near me",
    "nursing homes near me",
    "pharmacy medicine availability",
    "find nearby healthcare facilities",
    "approved healthcare directory",
  ],
  alternates: { canonical: "/pharmacies" },
  openGraph: {
    title: "Nearby Healthcare Facilities | DawaSetu",
    description:
      "Browse approved local pharmacies, hospitals, nursing homes and diagnostic facilities.",
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
            Pharmacies and nearby healthcare facilities
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Find approved pharmacies, hospitals, nursing homes, diagnostic
            centres and medical laboratories. Use your location to sort public
            profiles by distance.
          </p>
        </section>
        <NearbyBusinessFinder initialResult={directory} />
        <p className="mt-8 rounded-xl bg-white px-4 py-3 text-xs leading-5 text-slate-500">
          DawaSetu displays partner-reported information. Call the business to
          confirm current availability before travelling.
        </p>
      </div>
    </main>
  );
}
