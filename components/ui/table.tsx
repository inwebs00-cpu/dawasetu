import type { HTMLAttributes, TableHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Table({
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
      <table
        className={cn("w-full caption-bottom text-left text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "bg-slate-50 text-xs tracking-wide text-slate-500 uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function TableBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("divide-y divide-slate-100", className)} {...props} />
  );
}

export function TableRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("hover:bg-slate-50/70", className)} {...props} />;
}

export function TableHead({
  className,
  ...props
}: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn("px-4 py-3 font-semibold", className)}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-4 py-3 text-slate-700", className)} {...props} />
  );
}
