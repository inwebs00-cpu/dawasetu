import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { MedicineRequestForm } from "@/components/requests/medicine-request-form";
import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/services/medicine-search";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Request a medicine" };

type SearchParams = Promise<{
  medicine_id?: string;
  name?: string;
  composition?: string;
  strength?: string;
}>;

export default async function NewMedicineRequestPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  if (!isSupabaseConfigured())
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <Brand />
          <h1 className="mt-8 text-2xl font-semibold text-slate-950">
            Medicine requests are not connected
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Configure Supabase and apply the DawaSetu migrations to send
            availability requests.
          </p>
        </div>
      </main>
    );
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const next = `/requests/new?${new URLSearchParams(Object.entries(params).filter(([, value]) => value))}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  const medicineId =
    params.medicine_id && /^[0-9a-f-]{36}$/i.test(params.medicine_id)
      ? params.medicine_id
      : "";
  const medicineName = (params.name ?? "").slice(0, 240);
  const composition = (params.composition ?? "").slice(0, 240);
  const strength = (params.strength ?? "").slice(0, 120);
  const { data: areas } = await supabase
    .from("areas")
    .select("id, name, postal_code")
    .eq("is_active", true)
    .order("name")
    .limit(500);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/account">My account</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Availability network
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Ask nearby pharmacies
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          We’ll notify approved partner businesses in your area. A request does
          not reserve medicine, place an order, or recommend a substitute.
        </p>
        <Card className="mt-6">
          <CardContent className="p-0">
            <MedicineRequestForm
              medicineId={medicineId}
              medicineName={medicineName}
              composition={composition}
              strength={strength}
              areas={areas ?? []}
            />
          </CardContent>
        </Card>
        {(areas ?? []).length === 0 && (
          <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            DawaSetu area data has not been configured. Contact the network
            administrator to enable location-based requests.
          </p>
        )}
      </div>
    </main>
  );
}
