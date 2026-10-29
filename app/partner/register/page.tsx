import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { BusinessRegistrationForm } from "@/components/partner/business-registration-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/services/medicine-search";
import { getActiveLocationHierarchy } from "@/services/location-directory";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Register a partner business" };

interface BusinessTypeOption {
  id: string;
  name: string;
}

export default async function PartnerRegisterPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <Brand />
          <h1 className="mt-8 text-2xl font-semibold text-slate-950">
            Partner registration is not connected
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Configure Supabase and apply the DawaSetu migrations before
            submitting a business registration.
          </p>
        </div>
      </main>
    );
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data }, locationHierarchy] = await Promise.all([
    supabase
      .from("business_types")
      .select("id, name")
      .eq("is_active", true)
      .eq("is_distributor", false)
      .order("name"),
    getActiveLocationHierarchy(supabase),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/account">Account</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Partner onboarding
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Register a local business
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Pharmacies, clinics, hospitals, nursing homes, diagnostic centres and
          medical laboratories can submit their details for review. Public
          visibility is enabled only after approval and the business turns on
          public availability. Upload required verification documents from the
          business dashboard after submitting the form.
        </p>
        <Card className="mt-7">
          <CardHeader>
            <CardTitle>Business registration</CardTitle>
          </CardHeader>
          <CardContent>
            <BusinessRegistrationForm
              businessTypes={(data ?? []) as BusinessTypeOption[]}
              states={locationHierarchy.states}
              districts={locationHierarchy.districts}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
