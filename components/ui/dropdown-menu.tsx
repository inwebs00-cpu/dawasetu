import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface DropdownMenuProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function DropdownMenu({
  label,
  children,
  className,
}: DropdownMenuProps) {
  return (
    <details className={cn("group relative inline-block", className)}>
      <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 [&::-webkit-details-marker]:hidden">
        {label}
        <span
          aria-hidden="true"
          className="text-slate-500 transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 min-w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
        {children}
      </div>
    </details>
  );
}

export function DropdownMenuItem({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-700",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
