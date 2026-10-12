import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePlatformPermission } from "@/lib/auth/authorization";

import { deletePromotionAction, savePromotionAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Promotions and listings" };

interface PromotionBusiness {
  business_id: string;
  business_name: string;
  business_type: string;
}

interface Promotion {
  promotion_id: string;
  business_id: string;
  business_name: string;
  title: string;
  description: string | null;
  promotion_type: "offer" | "featured_listing" | "sponsored_listing";
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  updated_at: string;
}

type SearchParams = Promise<{ updated?: string; error?: string }>;

const promotionTypes = [
  ["offer", "Partner offer"],
  ["featured_listing", "Featured listing"],
  ["sponsored_listing", "Sponsored listing"],
] as const;
const promotionStatuses = [
  "pending",
  "approved",
  "rejected",
  "scheduled",
  "active",
  "expired",
  "cancelled",
] as const;

function dateForIndiaInput(value: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${read("year")}-${read("month")}-${read("day")}T${read("hour")}:${read("minute")}`;
}

function PromotionForm({
  promotion,
  businesses,
}: {
  promotion?: Promotion;
  businesses: PromotionBusiness[];
}) {
  return (
    <form action={savePromotionAction} className="grid gap-4">
      <input
        type="hidden"
        name="promotion_id"
        value={promotion?.promotion_id ?? ""}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Approved partner
          <select
            name="business_id"
            required
            defaultValue={promotion?.business_id ?? ""}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          >
            <option value="" disabled>
              Choose a pharmacy, clinic, or nursing home
            </option>
            {businesses.map((business) => (
              <option key={business.business_id} value={business.business_id}>
                {business.business_name} · {business.business_type}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Promotion title
          <input
            name="title"
            required
            minLength={2}
            maxLength={160}
            defaultValue={promotion?.title}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Promotion type
          <select
            name="promotion_type"
            required
            defaultValue={promotion?.promotion_type ?? "offer"}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          >
            {promotionTypes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Review status
          <select
            name="status"
            required
            defaultValue={promotion?.status ?? "pending"}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          >
            {promotionStatuses.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Starts (India time)
          <input
            type="datetime-local"
            name="starts_at"
            defaultValue={dateForIndiaInput(promotion?.starts_at ?? null)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Ends (India time)
          <input
            type="datetime-local"
            name="ends_at"
            defaultValue={dateForIndiaInput(promotion?.ends_at ?? null)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          />
        </label>
      </div>
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Description
        <textarea
          name="description"
          maxLength={1000}
          rows={2}
          defaultValue={promotion?.description ?? ""}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900"
        />
      </label>
      <Button type="submit" size="sm" className="justify-self-start">
        {promotion ? "Save promotion" : "Create promotion"}
      </Button>
    </form>
  );
}

export default async function AdminPromotionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const { supabase } = await requirePlatformPermission("promotions.manage");
  const [promotionsResult, businessesResult] = await Promise.all([
    supabase.rpc("admin_list_promotions"),
    supabase.rpc("admin_list_promotion_businesses"),
  ]);
  const promotions = (promotionsResult.data ?? []) as Promotion[];
  const businesses = (businessesResult.data ?? []) as PromotionBusiness[];
  const error = promotionsResult.error || businessesResult.error;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin">Dashboard</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Visibility and offers
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Promotions and listings
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Approve partner offers and featured placements. Active sponsored
          listings are visibly labelled on public partner profiles.
        </p>
        {params.updated && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"
          >
            {params.updated === "deleted"
              ? "Promotion removed."
              : "Promotion saved."}
          </p>
        )}
        {params.error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-900"
          >
            {params.error === "confirm"
              ? "Confirm the removal before deleting this promotion."
              : "The promotion could not be saved. Check its dates and selected partner."}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Promotions are temporarily unavailable.
          </p>
        )}
        {!error && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Create a promotion</CardTitle>
            </CardHeader>
            <CardContent>
              {businesses.length ? (
                <PromotionForm businesses={businesses} />
              ) : (
                <EmptyState
                  title="No approved partners yet"
                  description="Approve a pharmacy, clinic, or nursing home before creating a public promotion."
                />
              )}
            </CardContent>
          </Card>
        )}
        {!error && promotions.length === 0 ? (
          <Card className="mt-5">
            <CardContent className="p-6">
              <EmptyState
                title="No promotions have been created"
                description="Create a partner offer or a dated featured/sponsored listing for approved businesses."
              />
            </CardContent>
          </Card>
        ) : (
          <section className="mt-5 grid gap-4">
            {promotions.map((promotion) => (
              <Card key={promotion.promotion_id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{promotion.title}</CardTitle>
                    <StatusBadge status={promotion.status} />
                    <StatusBadge
                      status={promotion.promotion_type.replaceAll("_", " ")}
                    />
                  </div>
                  <p className="text-sm text-slate-600">
                    {promotion.business_name}
                  </p>
                </CardHeader>
                <CardContent className="grid gap-5">
                  <PromotionForm
                    promotion={promotion}
                    businesses={businesses}
                  />
                  <form
                    action={deletePromotionAction}
                    className="flex flex-wrap items-center gap-3 border-t border-rose-100 pt-4"
                  >
                    <input
                      type="hidden"
                      name="promotion_id"
                      value={promotion.promotion_id}
                    />
                    <label className="flex items-center gap-2 text-sm text-rose-800">
                      <input
                        type="checkbox"
                        name="confirm_delete"
                        required
                        className="size-4 accent-rose-700"
                      />
                      Confirm removal
                    </label>
                    <Button type="submit" size="sm" variant="destructive">
                      Delete promotion
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
