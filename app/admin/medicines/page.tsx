import Link from "next/link";
import type { Metadata } from "next";

import { MedicineReviewControls } from "@/components/admin/medicine-review-controls";
import { MedicineBulkUpload } from "@/components/admin/medicine-bulk-upload";
import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePlatformPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Medicine master administration" };

type SearchParams = Promise<{ q?: string; status?: string; page?: string }>;

interface AdminMedicine {
  medicine_id: string;
  product_name: string;
  brand_name: string | null;
  composition: string | null;
  strength: string;
  manufacturer_name: string | null;
  category_name: string | null;
  medicine_type: string;
  prescription_class: string;
  packaging: string | null;
  public_visibility: boolean;
  medicine_status: string;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export default async function AdminMedicinesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 120);
  const selectedStatus = [
    "pending",
    "approved",
    "rejected",
    "inactive",
  ].includes(params.status ?? "")
    ? params.status!
    : null;
  const parsedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(parsedPage) && parsedPage > 0
      ? Math.min(parsedPage, 10000)
      : 1;
  const pageSize = 50;
  const { supabase } = await requirePlatformPermission("medicines.view");
  const [listResult, canManageResult, canApproveResult] = await Promise.all([
    supabase.rpc("admin_list_medicines", {
      p_query: query || null,
      p_status: selectedStatus,
      p_limit: pageSize + 1,
      p_offset: (page - 1) * pageSize,
    }),
    supabase.rpc("has_platform_permission", {
      p_permission_key: "medicines.manage",
    }),
    supabase.rpc("has_platform_permission", {
      p_permission_key: "medicines.approve",
    }),
  ]);
  const results = listResult.error
    ? []
    : ((listResult.data ?? []) as AdminMedicine[]);
  const hasNext = results.length > pageSize;
  const medicines = results.slice(0, pageSize);
  const canManage = canManageResult.data === true;
  const canApprove = canApproveResult.data === true;

  function pageUrl(nextPage: number) {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (selectedStatus) search.set("status", selectedStatus);
    search.set("page", String(nextPage));
    return `/admin/medicines?${search.toString()}`;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin">Dashboard</Link>
            </Button>
            {canManage && (
              <Button asChild size="sm">
                <Link href="/admin/medicines/new">Add medicine</Link>
              </Button>
            )}
          </div>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Catalog governance
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Medicine master
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Approved records power public availability search. New or edited
          records remain pending until an authorized reviewer approves them.
        </p>
        <form
          method="get"
          className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_200px_auto]"
        >
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Search product, brand, composition, strength, or manufacturer
            <input
              name="q"
              defaultValue={query}
              maxLength={120}
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal text-slate-900"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Status
            <select
              name="status"
              defaultValue={selectedStatus ?? ""}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
            >
              <option value="">All statuses</option>
              {["pending", "approved", "rejected", "inactive"].map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <Button type="submit" variant="secondary">
              Apply filters
            </Button>
          </div>
        </form>
        {canManage && <MedicineBulkUpload />}
        {listResult.error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
          >
            Medicine catalog is temporarily unavailable.
          </p>
        )}
        {!listResult.error && medicines.length === 0 && (
          <Card className="mt-5">
            <CardContent className="p-6">
              <EmptyState
                title="No medicine records found"
                description={
                  query || selectedStatus
                    ? "Change the search or status filter to see other records."
                    : "Medicine submissions will appear here after partners or administrators add products."
                }
              />
            </CardContent>
          </Card>
        )}
        <section className="mt-5 grid gap-4" aria-label="Medicine records">
          {medicines.map((medicine) => (
            <Card key={medicine.medicine_id}>
              <CardContent className="grid gap-4 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-950">
                        {medicine.product_name}
                      </h2>
                      <StatusBadge status={medicine.medicine_status} />
                      {!medicine.public_visibility && (
                        <StatusBadge status="Private" />
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {medicine.brand_name ? `${medicine.brand_name} · ` : ""}
                      {medicine.strength}
                      {medicine.manufacturer_name
                        ? ` · ${medicine.manufacturer_name}`
                        : ""}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {medicine.composition ?? "Composition pending"}
                      {medicine.category_name
                        ? ` · ${medicine.category_name}`
                        : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {medicine.medicine_type} · {medicine.prescription_class} ·{" "}
                      {medicine.packaging ?? "Packaging not supplied"}
                    </p>
                    {medicine.review_note && (
                      <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                        Reviewer note: {medicine.review_note}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {canManage && (
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/admin/medicines/${medicine.medicine_id}/edit`}
                        >
                          Edit
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
                {canApprove &&
                  (medicine.medicine_status === "pending" ||
                    medicine.medicine_status === "rejected") && (
                    <MedicineReviewControls
                      medicineId={medicine.medicine_id}
                      status={medicine.medicine_status}
                    />
                  )}
              </CardContent>
            </Card>
          ))}
        </section>
        <nav
          aria-label="Medicine pages"
          className="mt-6 flex items-center justify-between"
        >
          <p className="text-sm text-slate-600">
            Page {page} · {medicines.length} record
            {medicines.length === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild size="sm" variant="outline">
                <Link href={pageUrl(page - 1)}>Previous</Link>
              </Button>
            )}
            {hasNext && (
              <Button asChild size="sm" variant="outline">
                <Link href={pageUrl(page + 1)}>Next</Link>
              </Button>
            )}
          </div>
        </nav>
      </div>
    </main>
  );
}
