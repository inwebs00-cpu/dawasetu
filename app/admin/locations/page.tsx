import Link from "next/link";
import type { Metadata } from "next";

import { AreaForm } from "@/components/admin/area-form";
import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { requirePlatformPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Network locations" };

interface AreaRow {
  id: string;
  name: string;
  postal_code: string | null;
}

export default async function AdminLocationsPage() {
  const { supabase } = await requirePlatformPermission("partners.manage");
  const [
    { data, error, count: areaCount },
    { count: districtCount },
    { count: stateCount },
  ] = await Promise.all([
    supabase
      .from("areas")
      .select("id, name, postal_code", { count: "exact" })
      .eq("is_active", true)
      .order("name")
      .limit(200),
    supabase
      .from("districts")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("states")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
  ]);
  const areas = (data ?? []) as AreaRow[];
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin">Dashboard</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Network configuration
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          States, districts, and areas
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Add the service areas where partners operate. Local request routing
          requires both a mapped partner and a customer-selected area.
        </p>
        <div className="mt-6">
          <AreaForm />
        </div>
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="font-semibold text-slate-950">Active areas</h2>
          <p className="mt-1 text-sm text-slate-600">
            {areaCount ?? areas.length} areas across {districtCount ?? 0}{" "}
            districts and {stateCount ?? 0} states. This page previews up to
            200; partner forms search the full location list.
          </p>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-rose-800">
              Area list is temporarily unavailable.
            </p>
          ) : areas.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No areas configured"
                description="Create areas for your initial service regions before turning on local request routing."
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {areas.map((area) => (
                <Card key={area.id}>
                  <CardContent className="p-4">
                    <p className="font-medium text-slate-900">{area.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      PIN {area.postal_code ?? "not supplied"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
