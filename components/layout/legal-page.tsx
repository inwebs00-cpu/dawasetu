import Link from "next/link";
import type { ReactNode } from "react";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";

export function LegalPage({
  eyebrow,
  title,
  summary,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <article className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-10">
        <header className="mb-10 flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Home</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          {summary}
        </p>
        <p className="mt-4 text-xs text-slate-500">
          Effective date: 16 October 2026
        </p>
        <div className="prose-dawasetu mt-8 grid gap-7 text-sm leading-7 text-slate-700">
          {children}
        </div>
      </article>
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-2 grid gap-3">{children}</div>
    </section>
  );
}
