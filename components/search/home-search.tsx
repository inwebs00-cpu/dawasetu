"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LocateFixed,
  LoaderCircle,
  MapPin,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";

import { searchNearbyAction } from "@/app/medicines/actions";
import { findNearbyPublicBusinessesAction } from "@/app/pharmacies/actions";
import { BusinessDirectoryCard } from "@/components/business/business-directory-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MedicineCatalogCard } from "@/components/search/medicine-catalog-card";
import type { DirectoryResult } from "@/services/business-directory";
import type {
  PublicMedicineSearchRow,
  SearchResult,
} from "@/services/medicine-search";

const quickSearches = [
  "Paracetamol",
  "Cetirizine",
  "Metformin",
  "Azithromycin",
];

function formatDistance(distance: number | null) {
  if (distance === null || !Number.isFinite(distance)) return null;
  if (distance < 1) return `${Math.max(1, Math.round(distance * 1000))} m`;
  return `${distance.toFixed(distance < 10 ? 1 : 0)} km`;
}

function NearbyMatch({ result }: { result: PublicMedicineSearchRow }) {
  const distance = formatDistance(result.distance_km);
  return (
    <li>
      <Link
        href={`/pharmacies/${encodeURIComponent(result.business_slug)}`}
        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 transition hover:border-emerald-200 hover:bg-emerald-50/60"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-800">
            <MapPin aria-hidden="true" className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-slate-900">
              {result.product_name}
            </span>
            <span className="mt-0.5 block truncate text-xs text-slate-600">
              {result.business_name} · {result.strength}
            </span>
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-xs font-semibold text-emerald-800">
            {result.inventory_status === "available"
              ? "Available"
              : "Low stock"}
          </span>
          {distance && (
            <span className="mt-0.5 block text-xs text-slate-500">
              {distance}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

export function HomeSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [nearbyResult, setNearbyResult] = useState<SearchResult | null>(null);
  const [nearbyBusinesses, setNearbyBusinesses] =
    useState<DirectoryResult | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [pending, startTransition] = useTransition();

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return;
    setNearbyResult(null);
    setNearbyBusinesses(null);
    setLocationMessage("");
    router.push(`/medicines?q=${encodeURIComponent(normalizedQuery)}`);
  }

  function searchNearby() {
    setNearbyResult(null);
    setNearbyBusinesses(null);
    setShowAllMatches(false);
    if (!navigator.geolocation) {
      setLocationMessage(
        "Location is unavailable here. Use a secure HTTPS page and allow location access in your browser.",
      );
      return;
    }

    setLocating(true);
    setLocationMessage("Requesting a one-time location for this search…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        setLocationMessage("Searching nearby partner reports…");
        startTransition(async () => {
          try {
            const searchTerm = query.trim();
            if (!searchTerm) {
              const response = await findNearbyPublicBusinessesAction(
                coords.latitude,
                coords.longitude,
              );
              setNearbyBusinesses(response);
              if (response.status !== "ready") {
                setLocationMessage(
                  response.status === "unconfigured"
                    ? "Nearby search is not connected in this deployment yet."
                    : "Nearby partners are temporarily unavailable. Please try again.",
                );
              } else {
                setLocationMessage(
                  "Approved public partners are listed below, closest first when coordinates are available. Stock appears only when a partner reports it. Your precise location is used for this search and is not saved.",
                );
              }
              return;
            }

            const response = await searchNearbyAction(
              searchTerm,
              coords.latitude,
              coords.longitude,
              null,
            );
            setNearbyResult(response);
            if (response.status !== "ready") {
              setLocationMessage(
                response.status === "unconfigured"
                  ? "Nearby search is not connected in this deployment yet."
                  : "Nearby search is temporarily unavailable. Please try again.",
              );
            } else {
              setLocationMessage(
                "Partner reports are sorted by distance. Your precise location is used for this search and is not saved.",
              );
            }
          } catch {
            setNearbyResult({ status: "error" });
            setLocationMessage(
              "Nearby search could not be completed. Please try again.",
            );
          }
        });
      },
      (error) => {
        setLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationMessage(
            "Location access is blocked. Allow location for this site in your browser, then try again.",
          );
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationMessage(
            "Your device could not determine your location. Check device location services and try again.",
          );
        } else if (error.code === error.TIMEOUT) {
          setLocationMessage(
            "The location request timed out. Try again or search by medicine name.",
          );
        } else {
          setLocationMessage(
            "Location was not shared. You can still search the network without it.",
          );
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 },
    );
  }

  const rows = nearbyResult?.status === "ready" ? nearbyResult.rows : [];
  const catalogRows =
    nearbyResult?.status === "ready" ? (nearbyResult.catalogRows ?? []) : [];
  const visibleRows = showAllMatches ? rows : rows.slice(0, 3);

  return (
    <div className="rounded-[1.4rem] border border-white/90 bg-white p-2.5 shadow-[0_20px_45px_-28px_rgba(18,49,74,0.32)] sm:p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <form
          role="search"
          onSubmit={search}
          className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row"
        >
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">
              Search medicine, brand or composition
            </span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-400"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setNearbyResult(null);
                setNearbyBusinesses(null);
                setLocationMessage("");
              }}
              placeholder="Search a medicine…"
              className="h-12 rounded-xl border-slate-200 bg-white pl-11 text-sm shadow-none placeholder:text-slate-400 focus-visible:ring-emerald-600 sm:h-14 sm:border-transparent sm:bg-slate-50/70 sm:text-base"
            />
          </label>
          <Button
            type="submit"
            disabled={!query.trim()}
            className="h-12 rounded-xl bg-emerald-700 px-5 text-sm hover:bg-emerald-800 disabled:bg-emerald-700 disabled:opacity-100 sm:h-14 sm:px-6"
          >
            Search <Search aria-hidden="true" className="size-4" />
          </Button>
        </form>
        <button
          type="button"
          onClick={searchNearby}
          disabled={locating || pending}
          aria-label="Find nearby pharmacies and medicine availability"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-70 sm:min-w-[132px] sm:px-3"
        >
          {locating || pending ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <LocateFixed aria-hidden="true" className="size-4" />
          )}
          <span className="sm:hidden">
            {locating
              ? "Finding you…"
              : pending
                ? "Searching…"
                : "Use my location"}
          </span>
          <span className="hidden sm:inline">
            {locating
              ? "Finding you…"
              : pending
                ? "Searching…"
                : "Use location"}
          </span>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-2 pt-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-600">Try a search</span>
          {quickSearches.map((term) => (
            <Link
              key={term}
              href={`/medicines?q=${encodeURIComponent(term)}`}
              className="rounded-full bg-slate-100 px-2.5 py-1.5 font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800"
            >
              {term}
            </Link>
          ))}
        </div>
        <span className="inline-flex items-center gap-1 text-[0.7rem] text-slate-500">
          <ShieldCheck
            aria-hidden="true"
            className="size-3.5 text-emerald-700"
          />
          Location is used once; it is not saved
        </span>
      </div>

      {locationMessage && (
        <p
          role="status"
          aria-live="polite"
          className="mx-2 mt-2 flex items-start gap-2 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-600"
        >
          <MapPin
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0 text-emerald-700"
          />
          {locationMessage}
        </p>
      )}

      {nearbyResult?.status === "ready" && (
        <section
          aria-label="Nearby medicine matches"
          className="mt-3 border-t border-slate-100 px-1 pt-3"
        >
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <h2 className="text-sm font-bold text-slate-900">
              {rows.length > 0
                ? "Nearby partner reports"
                : catalogRows.length > 0
                  ? "No nearby stock reported"
                  : "No current matches nearby"}
            </h2>
            {rows.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllMatches((current) => !current)}
                className="min-h-9 rounded-lg px-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
              >
                {showAllMatches ? "Show fewer" : `Show all ${rows.length}`}
              </button>
            )}
          </div>
          {rows.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {visibleRows.map((row) => (
                <NearbyMatch
                  key={`${row.medicine_id}:${row.business_id}`}
                  result={row}
                />
              ))}
            </ul>
          ) : catalogRows.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {catalogRows.slice(0, 4).map((medicine) => (
                <MedicineCatalogCard
                  key={medicine.medicine_id}
                  medicine={medicine}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-600">
              No approved public partner has reported a matching medicine yet.
              Try another search or check again later.
            </p>
          )}
        </section>
      )}

      {nearbyBusinesses?.status === "ready" && (
        <section
          aria-label="Nearby pharmacies and care partners"
          className="mt-3 border-t border-slate-100 px-1 pt-3"
        >
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <h2 className="text-sm font-bold text-slate-900">
              {nearbyBusinesses.rows.length > 0
                ? "Nearby pharmacies and care partners"
                : "No public partner profiles yet"}
            </h2>
            <Link
              href="/pharmacies"
              className="min-h-9 rounded-lg px-2 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              View directory
            </Link>
          </div>
          {nearbyBusinesses.rows.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {nearbyBusinesses.rows.slice(0, 4).map((business) => (
                <BusinessDirectoryCard
                  key={business.business_id}
                  business={business}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-600">
              There are no approved public pharmacy or care partner profiles to
              show yet. You can browse the full directory or try again later.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
