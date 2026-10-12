import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const variants = {
  default: "bg-teal-100 text-teal-900",
  secondary: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-900",
  warning: "bg-amber-100 text-amber-900",
  destructive: "bg-rose-100 text-rose-900",
  outline: "border border-slate-300 bg-white text-slate-700",
} as const;

export type BadgeVariant = keyof typeof variants;

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs leading-none font-semibold",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
