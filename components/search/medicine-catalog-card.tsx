import { Pill } from "lucide-react";
import Link from "next/link";

import { saveMyMedicineAction } from "@/app/medicines/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { PublicMedicineCatalogRow } from "@/services/medicine-search";

export function MedicineCatalogCard({
  medicine,
  availabilityUnavailable = false,
}: {
  medicine: PublicMedicineCatalogRow;
  availabilityUnavailable?: boolean;
}) {
  const requestParams = new URLSearchParams({
    medicine_id: medicine.medicine_id,
    name: medicine.product_name,
    composition: medicine.composition ?? "",
    strength: medicine.strength,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="rounded-xl bg-teal-50 p-2.5 text-teal-800">
              <Pill aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <CardTitle>{medicine.product_name}</CardTitle>
              {medicine.brand_name &&
                medicine.brand_name !== medicine.product_name && (
                  <p className="mt-1 text-sm text-slate-600">
                    Brand: {medicine.brand_name}
                  </p>
                )}
              <p className="mt-1 text-sm text-slate-600">{medicine.strength}</p>
            </div>
          </div>
          <StatusBadge
            status={
              availabilityUnavailable
                ? "Live stock unavailable"
                : "No public stock reported"
            }
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-1.5 text-sm text-slate-600">
          <p>
            <span className="font-medium text-slate-800">
              Regulatory schedule:
            </span>{" "}
            Not verified
          </p>
          {medicine.composition && (
            <p>
              <span className="font-medium text-slate-800">Composition:</span>{" "}
              {medicine.composition}
            </p>
          )}
          {medicine.manufacturer_name && (
            <p>
              <span className="font-medium text-slate-800">Manufacturer:</span>{" "}
              {medicine.manufacturer_name}
            </p>
          )}
          {medicine.composition && (
            <Link
              href={`/medicines/${encodeURIComponent(medicine.medicine_id)}/alternatives`}
              className="inline-flex text-sm font-semibold text-teal-800 hover:underline"
            >
              See medicines with the same composition
            </Link>
          )}
        </div>
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
          {availabilityUnavailable
            ? "This medicine is in the catalogue, but live partner availability could not be checked. Contact a pharmacy directly to confirm stock. Confirm the current pack label and prescription requirements with a pharmacist; this catalogue does not verify Schedule H, H1 or NRx status."
            : "This approved medicine is in the catalogue, but no partner has reported public stock for this search. Availability may be unreported or out of date. Confirm the current pack label and prescription requirements with a pharmacist; this catalogue does not verify Schedule H, H1 or NRx status."}
        </p>
        <div className="flex flex-wrap gap-2">
          <form action={saveMyMedicineAction}>
            <input
              type="hidden"
              name="medicine_id"
              value={medicine.medicine_id}
            />
            <input
              type="hidden"
              name="return_to"
              value={`/medicines?q=${encodeURIComponent(medicine.product_name)}`}
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
        </div>
      </CardContent>
    </Card>
  );
}
