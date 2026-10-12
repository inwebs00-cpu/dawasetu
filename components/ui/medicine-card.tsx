import { Clock3, Pill } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface MedicineCardData {
  name: string;
  composition: string;
  strength: string;
  manufacturer?: string;
  availability?: "Available" | "Low Stock" | "Out of Stock";
  lastUpdated?: string;
}

export function MedicineCard({ medicine }: { medicine: MedicineCardData }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-teal-50 p-2 text-teal-800">
              <Pill aria-hidden="true" className="size-5" />
            </span>
            <div>
              <CardTitle>{medicine.name}</CardTitle>
              <p className="mt-1 text-sm text-slate-600">{medicine.strength}</p>
            </div>
          </div>
          {medicine.availability && (
            <StatusBadge status={medicine.availability} />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-slate-600">
        <p>
          <span className="font-medium text-slate-800">Composition:</span>{" "}
          {medicine.composition}
        </p>
        {medicine.manufacturer && <p>Manufacturer: {medicine.manufacturer}</p>}
        {medicine.lastUpdated && (
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock3 aria-hidden="true" className="size-3.5" />
            Availability updated {medicine.lastUpdated}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
