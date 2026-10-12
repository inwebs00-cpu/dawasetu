import Link from "next/link";
import type { Metadata } from "next";

import {
  MedicineForm,
  type MedicineFormValue,
} from "@/components/admin/medicine-form";
import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { requirePlatformPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit medicine" };

type PageParams = Promise<{ medicineId: string }>;

interface CategoryOption {
  id: string;
  name: string;
}

export default async function EditAdminMedicinePage({
  params,
}: {
  params: PageParams;
}) {
  const { medicineId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(medicineId))
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title="Medicine not found"
            description="The medicine identifier is invalid."
          />
        </div>
      </main>
    );
  const { supabase } = await requirePlatformPermission("medicines.manage");
  const [{ data: medicineRows }, { data: categories }] = await Promise.all([
    supabase.rpc("admin_get_medicine", { p_medicine_id: medicineId }),
    supabase
      .from("categories")
      .select("id, name")
      .eq("is_active", true)
      .order("display_order"),
  ]);
  const initial = ((medicineRows ?? [])[0] ?? null) as MedicineFormValue | null;
  if (!initial)
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title="Medicine not found"
            description="This record may have been removed or is unavailable to your account."
          />
          <div className="mt-5 text-center">
            <Button asChild variant="outline">
              <Link href="/admin/medicines">Medicine master</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/medicines">Medicine master</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Catalog governance
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Edit medicine
        </h1>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{initial.product_name}</CardTitle>
          </CardHeader>
          <CardContent>
            <MedicineForm
              medicineId={medicineId}
              initial={initial}
              categories={(categories ?? []) as CategoryOption[]}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
