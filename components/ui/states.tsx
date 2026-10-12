import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-slate-200", className)}
    />
  );
}

export function LoadingState({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-3 py-6 text-sm text-slate-600",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-800"
      />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center",
        className,
      )}
    >
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
