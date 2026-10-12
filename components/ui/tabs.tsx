"use client";

import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function Tabs({
  items,
  defaultValue,
  value,
  onValueChange,
  className,
}: TabsProps) {
  const id = useId();
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? items[0]?.value ?? "",
  );
  const selectedValue = value ?? internalValue;

  function selectTab(nextValue: string) {
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
  }

  const selectedTab =
    items.find((item) => item.value === selectedValue) ?? items[0];
  if (!selectedTab) return null;

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label="Content sections"
        className="flex gap-1 border-b border-slate-200"
      >
        {items.map((item) => {
          const selected = item.value === selectedTab.value;
          return (
            <button
              key={item.value}
              id={`${id}-tab-${item.value}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${id}-panel-${item.value}`}
              tabIndex={selected ? 0 : -1}
              className={cn(
                "-mb-px rounded-t-lg border-b-2 px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700",
                selected
                  ? "border-teal-800 text-teal-900"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
              onClick={() => selectTab(item.value)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowRight" && event.key !== "ArrowLeft")
                  return;
                event.preventDefault();
                const currentIndex = items.findIndex(
                  (tab) => tab.value === selectedTab.value,
                );
                const offset = event.key === "ArrowRight" ? 1 : -1;
                const nextIndex =
                  (currentIndex + offset + items.length) % items.length;
                selectTab(items[nextIndex].value);
                document
                  .getElementById(`${id}-tab-${items[nextIndex].value}`)
                  ?.focus();
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        id={`${id}-panel-${selectedTab.value}`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${selectedTab.value}`}
        tabIndex={0}
        className="pt-4 focus-visible:outline-2 focus-visible:outline-teal-700"
      >
        {selectedTab.content}
      </div>
    </div>
  );
}
