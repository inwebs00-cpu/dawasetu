import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

const variants = {
  info: "border-sky-200 bg-sky-50 text-sky-950",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  destructive: "border-rose-200 bg-rose-50 text-rose-950",
} as const;

export function Alert({
  className,
  title,
  variant = "info",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title?: string;
  variant?: keyof typeof variants;
  children?: ReactNode;
}) {
  return (
    <div
      role={variant === "destructive" ? "alert" : "status"}
      className={cn(
        "rounded-xl border p-4 text-sm",
        variants[variant],
        className,
      )}
      {...props}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children && (
        <div className={cn(title && "mt-1", "leading-6")}>{children}</div>
      )}
    </div>
  );
}
