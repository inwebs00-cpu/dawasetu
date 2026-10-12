"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { searchNearbyAction } from "@/app/medicines/actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { SearchBox } from "@/components/ui/search-box";
import type {
  MedicineCategory,
  SearchResult,
} from "@/services/medicine-search";
import { MedicineResultCard } from "@/components/search/medicine-result-card";

export function MedicineSearchPanel({
  query,
  categorySlug,
  categories,
  initialResult,
  backendConfigured,
}: {
  query: string;
  categorySlug: string | null;
  categories: MedicineCategory[];
  initialResult: SearchResult;
  backendConfigured: boolean;
}) {
  const router = useRouter();
  const [nearbyResult, setNearbyResult] = useState<SearchResult | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const result = nearbyResult ?? initialResult;
  const activeCategory = categories.find(
    (category) => category.slug === categorySlug,
  );

  function search(nextQuery: string) {
    const params = new URLSearchParams();
    params.set("q", nextQuery);
    if (categorySlug) params.set("category", categorySlug);
    router.push(`/medicines?${params.toString()}`);
  }

  function searchNearby() {
    if (!query && !categorySlug) {
      setLocationMessage("Search for a medicine first, or choose a category.");
      return;
    }
    if (!navigator.geolocation) {
      setLocationMessage("This browser does not provide device location.");
      return;
    }

    setLocationMessage("Requesting a one-time location for this search…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocationMessage(
          "Searching by distance. Your location is used for this request and is not saved.",
        );
        startTransition(async () => {
          const response = await searchNearbyAction(
            query,
            coords.latitude,
            coords.longitude,
            categorySlug,
          );
          setNearbyResult(response);
        });
      },
      () =>
        setLocationMessage(
          "Location was not shared. You can still search the network without it.",
        ),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 },
    );
  }

  return (
    <div className="grid gap-7">
      <div className="rounded-3xl border border-teal-100 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-wide text-teal-800">
              Medicine availability
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              Find medicines nearby
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Search by brand, product, composition, strength, or manufacturer.
              Results show only current reports from approved public partners.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={searchNearby}
            disabled={pending}
          >
            {pending ? "Searching nearby…" : "Use my location"}
          </Button>
        </div>
        <div className="mt-5">
          <SearchBox
            label="Search by medicine, composition or manufacturer"
            placeholder="e.g. paracetamol, metformin, 500 mg"
            defaultValue={query}
            onSearch={search}
          />
        </div>
        <p
          aria-live="polite"
          className="mt-2 min-h-5 text-xs leading-5 text-slate-500"
        >
          {locationMessage}
        </p>
      </div>

      {categories.length > 0 && (
        <nav
          aria-label="Medicine categories"
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {categories.map((category) => {
            const active = category.slug === categorySlug;
            return (
              <Link
                key={category.slug}
                href={
                  active
                    ? "/medicines"
                    : `/medicines?category=${encodeURIComponent(category.slug)}`
                }
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${active ? "border-teal-800 bg-teal-800 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50"}`}
              >
                {category.name}
              </Link>
            );
          })}
        </nav>
      )}

      {activeCategory && (
        <h2 className="-mb-4 text-lg font-semibold text-slate-900">
          {activeCategory.name}
        </h2>
      )}
      {result.status === "unconfigured" ||
      (!backendConfigured && !query && !categorySlug) ? (
        <EmptyState
          title="Live search is not connected yet"
          description="Configure Supabase and apply the DawaSetu migrations to search verified partner availability."
        />
      ) : result.status === "error" ? (
        <EmptyState
          title="Search is temporarily unavailable"
          description="Please try again in a little while."
        />
      ) : !query && !categorySlug ? (
        <EmptyState
          title="Search the medicine network"
          description="Enter a medicine name or choose a category to see reported availability."
        />
      ) : result.rows.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <EmptyState
            title="No matching availability found"
            description="No approved public partner has reported this medicine. You can request it from nearby partners."
          />
          {query.trim().length > 0 && (
            <div className="mt-4 text-center">
              <Button asChild>
                <Link
                  href={`/requests/new?${new URLSearchParams({ name: query.trim().slice(0, 240) }).toString()}`}
                >
                  Request {query.trim()}
                </Link>
              </Button>
            </div>
          )}
        </section>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            {result.rows.length} reported result
            {result.rows.length === 1 ? "" : "s"}
            {query ? (
              <>
                {" "}
                for{" "}
                <span className="font-medium text-slate-900">“{query}”</span>
              </>
            ) : null}
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {result.rows.map((row) => (
              <MedicineResultCard
                key={`${row.medicine_id}:${row.business_id}`}
                result={row}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
