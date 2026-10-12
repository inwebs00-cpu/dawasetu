import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-teal-800 text-white shadow-sm hover:bg-teal-900",
  secondary:
    "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
  outline:
    "border border-teal-800 bg-transparent text-teal-900 hover:bg-teal-50",
  ghost: "text-slate-700 hover:bg-slate-100",
  destructive: "bg-rose-700 text-white hover:bg-rose-800",
} as const;

const sizes = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
  icon: "size-10 p-0",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  asChild = false,
  className,
  size = "md",
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      type={type}
      {...props}
    />
  );
}
