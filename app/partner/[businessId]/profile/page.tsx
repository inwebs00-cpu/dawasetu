import Link from "next/link";
import type { Metadata } from "next";

import { BusinessProfileForm } from "@/components/partner/business-profile-form";
import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireBusinessPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Business profile" };

type PageParams = Promise<{ businessId: string }>;

interface BusinessProfile {
  business_name: string;
  phone_e164: string;
  whatsapp_e164: string | null;
  email: string | null;
  address_line1: string;
  address_line2: string | null;
  area_id: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  opening_hours: { schedule?: string };
  google_business_url: string | null;
  public_availability_enabled: boolean;
  status: string;
}

interface AreaOption {
  id: string;
  name: string;
  postal_code: string | null;
}

export default async function PartnerProfilePage({
  params,
}: {
  params: PageParams;
}) {
  const { businessId } = await params;
  const { supabase } = await requireBusinessPermission(
    businessId,
    "partners.manage",
  );
  const [{ data: business }, { data: areas }] = await Promise.all([
    supabase
      .from("businesses")
      .select(
        "business_name, phone_e164, whatsapp_e164, email, address_line1, address_line2, area_id, postal_code, latitude, longitude, description, opening_hours, google_business_url, public_availability_enabled, status",
      )
      .eq("id", businessId)
      .maybeSingle(),
    supabase
      .from("areas")
      .select("id, name, postal_code")
      .eq("is_active", true)
      .order("name")
      .limit(500),
  ]);

  if (!business)
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title="Business profile unavailable"
            description="This business is no longer linked to your active permissions."
          />
          <div className="mt-5 text-center">
            <Button asChild variant="outline">
              <Link href="/partner">Your businesses</Link>
            </Button>
          </div>
        </div>
      </main>
    );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <nav className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/partner/${businessId}`}>Dashboard</Link>
            </Button>
            <StatusBadge status={business.status} />
          </nav>
        </header>
        <p className="text-sm font-semibold text-teal-800">Partner settings</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Store profile
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Keep your address and contact details current so customers can reach
          the pharmacy. A mapped area is needed to receive nearby medicine
          requests.
        </p>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Public listing and contact details</CardTitle>
          </CardHeader>
          <CardContent>
            <BusinessProfileForm
              businessId={businessId}
              business={business as BusinessProfile}
              areas={(areas ?? []) as AreaOption[]}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
