import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

export function DashboardCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 pt-5">
        <div>
          <p className="text-sm font-medium text-slate-600">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
          {description && (
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {description}
            </p>
          )}
        </div>
        {icon && (
          <span className="rounded-xl bg-teal-50 p-2.5 text-teal-800">
            {icon}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
