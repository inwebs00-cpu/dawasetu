"use client";

import { useRouter } from "next/navigation";

import { SearchBox } from "@/components/ui/search-box";

export function HomeSearch() {
  const router = useRouter();
  return (
    <SearchBox
      label="Search medicine, brand, composition or generic"
      placeholder="Search medicine, brand, composition or generic…"
      onSearch={(query) =>
        router.push(`/medicines?q=${encodeURIComponent(query)}`)
      }
    />
  );
}
