import Link from "next/link";
import type { Metadata } from "next";

import { MedicineForm } from "@/components/admin/medicine-form";
import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add a medicine" };

interface CategoryOption {
  id: string;
  name: string;
}

export default async function NewAdminMedicinePage() {
  const { supabase } = await requirePlatformPermission("medicines.manage");
  const { data } = await supabase
    .from("categories")
    .select("id, name")
    .eq("is_active", true)
    .order("display_order");
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
          Add a medicine
        </h1>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>New master record</CardTitle>
          </CardHeader>
          <CardContent>
            <MedicineForm
              medicineId={null}
              categories={(data ?? []) as CategoryOption[]}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
