import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  placeholder?: string;
}

export function Select({
  className,
  options,
  placeholder,
  ...props
}: SelectProps) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 shadow-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15 disabled:cursor-not-allowed disabled:bg-slate-100",
        className,
      )}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          disabled={option.disabled}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
}
