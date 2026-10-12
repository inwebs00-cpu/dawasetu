import Link from "next/link";
import type { Metadata } from "next";

import { BusinessReviewControls } from "@/components/admin/business-review-controls";
import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePlatformPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Partner review" };

type SearchParams = Promise<{ status?: string; type?: string }>;

interface BusinessApplication {
  business_id: string;
  business_name: string;
  business_slug: string;
  business_type: string;
  business_type_slug: string;
  owner_user_id: string;
  owner_name: string;
  email: string | null;
  phone_e164: string;
  registration_number: string | null;
  address_line1: string;
  address_line2: string | null;
  area_name: string | null;
  postal_code: string | null;
  business_status: string;
  review_note: string | null;
  created_at: string;
}

export default async function AdminPartnersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const status = ["pending", "approved", "rejected", "suspended"].includes(
    params.status ?? "",
  )
    ? params.status!
    : null;
  const businessType = [
    "retail_pharmacy",
    "clinic_pharmacy",
    "nursing_home_pharmacy",
    "distributor",
  ].includes(params.type ?? "")
    ? params.type!
    : null;
  const { supabase } = await requirePlatformPermission("partners.view");
  const [listResult, canApproveResult, canManageResult] = await Promise.all([
    supabase.rpc("admin_list_businesses", {
      p_status: status,
      p_business_type_slug: businessType,
      p_limit: 100,
      p_offset: 0,
    }),
    supabase.rpc("has_platform_permission", {
      p_permission_key: "partners.approve",
    }),
    supabase.rpc("has_platform_permission", {
      p_permission_key: "partners.manage",
    }),
  ]);
  const applications = listResult.error
    ? []
    : ((listResult.data ?? []) as BusinessApplication[]);
  const canApprove = canApproveResult.data === true;
  const canManage = canManageResult.data === true;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin">Dashboard</Link>
            </Button>
            {canManage && (
              <Button asChild size="sm">
                <Link href="/admin/partners/new">Add business</Link>
              </Button>
            )}
          </div>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Network verification
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Partner businesses
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Only approved businesses can publish availability. Approval does not
          turn public visibility on automatically.
        </p>
        <form
          method="get"
          className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto]"
        >
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Status
            <select
              name="status"
              defaultValue={status ?? ""}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
            >
              <option value="">All statuses</option>
              {["pending", "approved", "rejected", "suspended"].map(
                (option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Business type
            <select
              name="type"
              defaultValue={businessType ?? ""}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
            >
              <option value="">All types</option>
              <option value="retail_pharmacy">Retail pharmacy</option>
              <option value="clinic_pharmacy">Clinic pharmacy</option>
              <option value="nursing_home_pharmacy">
                Nursing home pharmacy
              </option>
              <option value="distributor">Distributor / stockist</option>
            </select>
          </label>
          <div className="flex items-end">
            <Button type="submit" variant="secondary">
              Apply filters
            </Button>
          </div>
        </form>
        {listResult.error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
          >
            Partner records are temporarily unavailable.
          </p>
        )}
        {!listResult.error && applications.length === 0 && (
          <Card className="mt-5">
            <CardContent className="p-6">
              <EmptyState
                title="No matching businesses"
                description="Submitted business applications will appear here for review."
              />
            </CardContent>
          </Card>
        )}
        <section className="mt-5 grid gap-4">
          {applications.map((business) => (
            <Card key={business.business_id}>
              <CardContent className="grid gap-5 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-950">
                        {business.business_name}
                      </h2>
                      <StatusBadge status={business.business_status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {business.business_type} · Submitted{" "}
                      {new Date(business.created_at).toLocaleDateString(
                        "en-IN",
                      )}
                    </p>
                    <p className="mt-3 text-sm text-slate-800">
                      {business.owner_name} · {business.phone_e164}
                      {business.email ? ` · ${business.email}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {business.address_line1}
                      {business.address_line2
                        ? `, ${business.address_line2}`
                        : ""}
                      {business.area_name ? `, ${business.area_name}` : ""}
                      {business.postal_code ? ` ${business.postal_code}` : ""}
                    </p>
                    {business.registration_number && (
                      <p className="mt-1 text-sm text-slate-600">
                        Registration / licence reference:{" "}
                        {business.registration_number}
                      </p>
                    )}
                    {business.review_note && (
                      <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                        Review note: {business.review_note}
                      </p>
                    )}
                  </div>
                  {business.business_status === "approved" && (
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/pharmacies/${encodeURIComponent(business.business_slug)}`}
                        target="_blank"
                      >
                        Public profile
                      </Link>
                    </Button>
                  )}
                </div>
                {canApprove && (
                  <BusinessReviewControls
                    businessId={business.business_id}
                    status={business.business_status}
                  />
                )}
                <div>
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={`/admin/partners/${business.business_id}/documents`}
                    >
                      View verification documents
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
