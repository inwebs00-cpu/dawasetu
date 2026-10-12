"use client";

import { Search } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SearchBoxProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  label?: string;
  defaultValue?: string;
  disabled?: boolean;
}

export function SearchBox({
  onSearch,
  placeholder = "Search",
  label = "Search",
  defaultValue = "",
  disabled = false,
}: SearchBoxProps) {
  const id = useId();
  const [query, setQuery] = useState(defaultValue);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();
    if (normalizedQuery) onSearch(normalizedQuery);
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-2 sm:flex-row"
    >
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <div className="relative min-w-0 flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400"
        />
        <Input
          id={id}
          type="search"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          className="pl-10"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <Button type="submit" disabled={disabled || !query.trim()}>
        Search
      </Button>
    </form>
  );
}
