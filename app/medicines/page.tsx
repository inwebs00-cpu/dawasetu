import type { Metadata } from "next";

import { MedicineSearchPanel } from "@/components/search/medicine-search-panel";
import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import {
  getMedicineCategories,
  isSupabaseConfigured,
  searchPublicMedicines,
  type SearchResult,
} from "@/services/medicine-search";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Find a medicine nearby",
  description:
    "Search medicine names, brands, compositions and strengths to find partner-reported availability at approved nearby pharmacies across India.",
  keywords: [
    "find medicine nearby",
    "medicine availability near me",
    "search medicine by brand or composition",
    "nearby pharmacy stock availability",
  ],
  alternates: { canonical: "/medicines" },
  openGraph: {
    title: "Find a Medicine Nearby | DawaSetu",
    description:
      "Search medicine brands, compositions and strengths and check partner-reported nearby pharmacy availability.",
    url: "/medicines",
    type: "website",
  },
};

type SearchParams = Promise<{
  q?: string | string[];
  category?: string | string[];
}>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function MedicinesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = firstValue(params.q).trim().slice(0, 120);
  const requestedCategory = firstValue(params.category);
  const [categories, configAvailable] = await Promise.all([
    getMedicineCategories(),
    Promise.resolve(isSupabaseConfigured()),
  ]);
  const categorySlug = categories.some(
    (category) => category.slug === requestedCategory,
  )
    ? requestedCategory
    : null;
  let initialResult: SearchResult;
  if (query.length >= 2 || categorySlug) {
    initialResult = await searchPublicMedicines(query, { categorySlug });
  } else {
    initialResult = configAvailable
      ? { status: "ready", rows: [] }
      : { status: "unconfigured" };
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/">Home</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/account">Account</Link>
            </Button>
          </nav>
        </header>
        <MedicineSearchPanel
          query={query}
          categorySlug={categorySlug}
          categories={categories}
          initialResult={initialResult}
          backendConfigured={configAvailable}
        />
        <footer className="mt-10 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">
          Availability is reported by partners and may change. DawaSetu does not
          sell medicines or recommend prescription substitutions.
        </footer>
      </div>
    </main>
  );
}
