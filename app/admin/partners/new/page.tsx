import Link from "next/link";
import type { Metadata } from "next";

import { BusinessForm } from "@/components/admin/business-form";
import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { requirePlatformPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add a partner business" };

interface BusinessTypeOption {
  id: string;
  name: string;
}
interface AreaOption {
  id: string;
  name: string;
  postal_code: string | null;
}

export default async function NewAdminBusinessPage() {
  const { supabase } = await requirePlatformPermission("partners.manage");
  const [{ data: types }, { data: areas }] = await Promise.all([
    supabase
      .from("business_types")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("areas")
      .select("id, name, postal_code")
      .eq("is_active", true)
      .order("name")
      .limit(500),
  ]);
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/partners">Partner businesses</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Network onboarding
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Add a business
        </h1>
        <div className="mt-6">
          <BusinessForm
            types={(types ?? []) as BusinessTypeOption[]}
            areas={(areas ?? []) as AreaOption[]}
          />
        </div>
      </div>
    </main>
  );
}
