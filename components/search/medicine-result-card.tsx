import {
  ArrowUpRight,
  Clock3,
  MapPin,
  MessageCircle,
  Phone,
  Pill,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { saveMyMedicineAction } from "@/app/medicines/actions";
import type { PublicMedicineSearchRow } from "@/services/medicine-search";

function formatDistance(distance: number | null) {
  if (distance === null || !Number.isFinite(distance)) return null;
  if (distance < 1) return `${Math.max(1, Math.round(distance * 1000))} m away`;
  return `${distance.toFixed(distance < 10 ? 1 : 0)} km away`;
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently updated";
  return `Updated ${new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)}`;
}

export function MedicineResultCard({
  result,
}: {
  result: PublicMedicineSearchRow;
}) {
  const distance = formatDistance(result.distance_km);
  const fullAddress = [
    result.address_line1,
    result.address_line2,
    result.postal_code,
  ]
    .filter(Boolean)
    .join(", ");
  const directionsUrl =
    result.latitude !== null && result.longitude !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${result.latitude},${result.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${result.business_name}, ${fullAddress}`)}`;
  const whatsappNumber = result.whatsapp_e164?.replace(/[^0-9]/g, "");
  const availability =
    result.inventory_status === "available" ? "Available" : "Low Stock";
  const requestParams = new URLSearchParams({
    medicine_id: result.medicine_id,
    name: result.product_name,
    composition: result.composition ?? "",
    strength: result.strength,
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="rounded-xl bg-teal-50 p-2.5 text-teal-800">
              <Pill aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <CardTitle>{result.product_name}</CardTitle>
              {result.brand_name &&
                result.brand_name !== result.product_name && (
                  <p className="mt-1 text-sm text-slate-600">
                    Brand: {result.brand_name}
                  </p>
                )}
              <p className="mt-1 text-sm text-slate-600">{result.strength}</p>
            </div>
          </div>
          <StatusBadge status={availability} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-1.5 text-sm text-slate-600">
          <p>
            <span className="font-medium text-slate-800">
              Regulatory schedule:
            </span>{" "}
            Confirm the current pack label with a pharmacist
          </p>
          {result.composition && (
            <p>
              <span className="font-medium text-slate-800">Composition:</span>{" "}
              {result.composition}
            </p>
          )}
          {result.manufacturer_name && (
            <p>
              <span className="font-medium text-slate-800">Manufacturer:</span>{" "}
              {result.manufacturer_name}
            </p>
          )}
          {result.composition && (
            <Link
              href={`/medicines/${encodeURIComponent(result.medicine_id)}/alternatives`}
              className="inline-flex text-sm font-semibold text-teal-800 hover:underline"
            >
              See medicines with the same composition
            </Link>
          )}
          <p className="text-xs text-slate-500">
            {formatUpdatedAt(result.last_updated_at)}
          </p>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-slate-950">
                  {result.business_name}
                </h3>
                <Badge variant="success">Verified partner</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {result.business_type}
              </p>
              <p className="mt-2 flex items-start gap-1.5 text-sm leading-5 text-slate-600">
                <MapPin
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-teal-800"
                />
                <span>{fullAddress}</span>
              </p>
            </div>
            {distance && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {distance}
              </span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <form action={saveMyMedicineAction}>
              <input
                type="hidden"
                name="medicine_id"
                value={result.medicine_id}
              />
              <input
                type="hidden"
                name="return_to"
                value={`/medicines?q=${encodeURIComponent(result.product_name)}`}
              />
              <Button type="submit" size="sm" variant="outline">
                Save medicine
              </Button>
            </form>
            <Button asChild size="sm">
              <Link href={`/requests/new?${requestParams.toString()}`}>
                Request availability
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link
                href={`/pharmacies/${encodeURIComponent(result.business_slug)}`}
              >
                View profile
              </Link>
            </Button>
            {result.phone_e164 && (
              <Button asChild size="sm" variant="secondary">
                <a href={`tel:${result.phone_e164}`}>
                  <Phone aria-hidden="true" className="size-4" />
                  Call
                </a>
              </Button>
            )}
            {whatsappNumber && (
              <Button asChild size="sm" variant="outline">
                <a
                  href={`https://wa.me/${whatsappNumber}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle aria-hidden="true" className="size-4" />
                  WhatsApp
                </a>
              </Button>
            )}
            <Button asChild size="sm" variant="ghost">
              <a href={directionsUrl} target="_blank" rel="noreferrer">
                Directions
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </a>
            </Button>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs leading-5 text-slate-500">
            <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />
            Availability is reported by the partner and may change. Please call
            to confirm before travelling.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
