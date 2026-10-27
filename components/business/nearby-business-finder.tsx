"use client";

import { LocateFixed } from "lucide-react";
import { useState, useTransition } from "react";

import { findNearbyPublicBusinessesAction } from "@/app/pharmacies/actions";
import { BusinessDirectoryCard } from "@/components/business/business-directory-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import type {
  DirectoryResult,
  PublicBusinessRow,
} from "@/services/business-directory";

export function NearbyBusinessFinder({
  initialResult,
}: {
  initialResult: DirectoryResult;
}) {
  const [nearbyResult, setNearbyResult] = useState<DirectoryResult | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [pending, startTransition] = useTransition();
  const result = nearbyResult ?? initialResult;

  function findNearby() {
    if (!navigator.geolocation) {
      setMessage(
        "Location is not available in this browser. You can still browse the public partner directory below.",
      );
      return;
    }
    setLocating(true);
    setMessage("Requesting your location for this search…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        setMessage("Finding approved pharmacies and care partners nearby…");
        startTransition(async () => {
          try {
            const response = await findNearbyPublicBusinessesAction(
              coords.latitude,
              coords.longitude,
            );
            if (response.status === "ready") {
              setNearbyResult(response);
              setMessage(
                "Nearby public partners are sorted by distance. Your precise location is used once and is not saved.",
              );
            } else {
              setMessage(
                response.status === "unconfigured"
                  ? "The live directory is not connected in this deployment yet. The public directory remains available below."
                  : "Nearby partners could not be loaded. The public directory remains available below.",
              );
            }
          } catch {
            setMessage(
              "Nearby partners could not be loaded. The public directory remains available below.",
            );
          }
        });
      },
      (error) => {
        setLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setMessage(
            "Location access is blocked. Allow location access for this site and try again.",
          );
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setMessage(
            "Your device could not determine its location. Check location services and try again.",
          );
        } else if (error.code === error.TIMEOUT) {
          setMessage("Location request timed out. Please try again.");
        } else {
          setMessage(
            "Location was not shared. You can still browse the public partner directory below.",
          );
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 },
    );
  }

  const rows: PublicBusinessRow[] =
    result.status === "ready" ? result.rows : [];

  return (
    <section className="mt-7" aria-labelledby="partner-directory-heading">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-teal-800">
            Verified DawaSetu network
          </p>
          <h2
            id="partner-directory-heading"
            className="mt-1 text-xl font-semibold tracking-tight text-slate-950"
          >
            Pharmacies and care partners
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Approved public profiles appear here even when no medicine stock is
            currently reported. Stock is shown only when the partner has marked
            it public and available.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={findNearby}
          disabled={locating || pending}
        >
          <LocateFixed aria-hidden="true" className="size-4" />
          {locating
            ? "Getting location…"
            : pending
              ? "Searching…"
              : "Find near me"}
        </Button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className="min-h-5 text-xs text-slate-500"
      >
        {message}
      </p>

      {result.status === "unconfigured" ? (
        <EmptyState
          title="The live directory is not connected"
          description="Configure Supabase and apply the DawaSetu migrations to list approved public partners."
        />
      ) : result.status === "error" ? (
        <EmptyState
          title="The directory is temporarily unavailable"
          description="Please try again shortly."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No public partner profiles yet"
          description="Approved pharmacies, clinic pharmacies and nursing home pharmacies appear after public availability is enabled."
        />
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {rows.map((business) => (
            <BusinessDirectoryCard
              key={business.business_id}
              business={business}
            />
          ))}
        </div>
      )}
    </section>
  );
}
