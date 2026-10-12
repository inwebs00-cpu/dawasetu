import type { ReactNode } from "react";

import { Brand } from "@/components/brand/brand";

export default function AuthLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_85%_12%,_rgba(34,197,130,0.11),_transparent_34%),linear-gradient(180deg,_#fbfdfd_0%,_#f2f8f6_100%)] px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <Brand />
          <span className="hidden rounded-full border border-teal-100 bg-white/80 px-3 py-1.5 text-xs font-medium text-teal-900 sm:inline-flex">
            Find Medicines. Find Nearby.
          </span>
        </header>
        <div className="grid flex-1 place-items-center py-12">{children}</div>
        <footer className="border-t border-slate-200/80 pt-5 text-xs text-slate-500">
          DawaSetu · India’s Medicine Availability Network
        </footer>
      </div>
    </main>
  );
}
