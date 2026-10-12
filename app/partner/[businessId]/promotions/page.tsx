import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireBusinessPermission } from "@/lib/auth/authorization";

import { savePartnerPromotionRequestAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Promotion requests" };

type PageParams = Promise<{ businessId: string }>;
type SearchParams = Promise<{ updated?: string; error?: string }>;

interface PromotionRequest {
  promotion_id: string;
  title: string;
  description: string | null;
  promotion_type: "offer" | "featured_listing" | "sponsored_listing";
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  updated_at: string;
}

const promotionTypes = [
  ["offer", "Partner offer"],
  ["featured_listing", "Featured listing"],
  ["sponsored_listing", "Sponsored listing"],
] as const;

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

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

function PromotionRequestForm({
  businessId,
  promotion,
}: {
  businessId: string;
  promotion?: PromotionRequest;
}) {
  const canEdit =
    !promotion ||
    ["pending", "rejected", "cancelled"].includes(promotion.status);

  return (
    <form action={savePartnerPromotionRequestAction} className="grid gap-4">
      <input type="hidden" name="business_id" value={businessId} />
      <input
        type="hidden"
        name="promotion_id"
        value={promotion?.promotion_id ?? ""}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Promotion title
          <input
            name="title"
            required
            minLength={2}
            maxLength={160}
            defaultValue={promotion?.title}
            disabled={!canEdit}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 disabled:bg-slate-100"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Request type
          <select
            name="promotion_type"
            required
            defaultValue={promotion?.promotion_type ?? "offer"}
            disabled={!canEdit}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 disabled:bg-slate-100"
          >
            {promotionTypes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
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
            disabled={!canEdit}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 disabled:bg-slate-100"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Ends (India time)
          <input
            type="datetime-local"
            name="ends_at"
            defaultValue={dateForIndiaInput(promotion?.ends_at ?? null)}
            disabled={!canEdit}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 disabled:bg-slate-100"
          />
        </label>
      </div>
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Details
        <textarea
          name="description"
          maxLength={1000}
          rows={3}
          defaultValue={promotion?.description ?? ""}
          disabled={!canEdit}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 disabled:bg-slate-100"
        />
      </label>
      {canEdit ? (
        <Button type="submit" className="justify-self-start">
          {promotion?.status === "rejected"
            ? "Resubmit for review"
            : promotion
              ? "Update request"
              : "Request promotion"}
        </Button>
      ) : (
        <p className="text-sm text-slate-600">
          This request has been reviewed. Contact DawaSetu support if it needs
          to be changed.
        </p>
      )}
    </form>
  );
}

export default async function PartnerPromotionsPage({
  params,
  searchParams,
}: {
  params: PageParams;
  searchParams: SearchParams;
}) {
  const [{ businessId }, query] = await Promise.all([params, searchParams]);
  const { supabase } = await requireBusinessPermission(
    businessId,
    "promotions.manage",
  );
  const { data, error } = await supabase.rpc("list_my_business_promotions", {
    p_business_id: businessId,
  });
  const promotions = (data ?? []) as PromotionRequest[];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href={`/partner/${businessId}`}>Dashboard</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Business visibility
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Promotions and featured listings
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Submit an offer or listing request for DawaSetu review. Nothing is
          shown publicly until an administrator approves it.
        </p>
        {query.updated && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"
          >
            Your promotion request was sent for review.
          </p>
        )}
        {query.error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-900"
          >
            {query.error === "invalid"
              ? "Check the title, request type, and date range, then try again."
              : "The request could not be saved. Please try again."}
          </p>
        )}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>New promotion request</CardTitle>
          </CardHeader>
          <CardContent>
            <PromotionRequestForm businessId={businessId} />
          </CardContent>
        </Card>
        <section className="mt-8">
          <h2 className="text-xl font-semibold text-slate-950">
            Your requests
          </h2>
          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
            >
              Promotion requests are temporarily unavailable.
            </p>
          ) : promotions.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No promotion requests yet"
                description="Submit a request above. The DawaSetu team will review it before it appears on public listings."
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-4">
              {promotions.map((promotion) => (
                <Card key={promotion.promotion_id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle>{promotion.title}</CardTitle>
                      <StatusBadge status={promotion.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <p>
                        Type: {promotion.promotion_type.replaceAll("_", " ")}
                      </p>
                      <p>Last updated: {formatDate(promotion.updated_at)}</p>
                      <p>Starts: {formatDate(promotion.starts_at)}</p>
                      <p>Ends: {formatDate(promotion.ends_at)}</p>
                    </div>
                    {promotion.description && (
                      <p className="text-sm leading-6 text-slate-700">
                        {promotion.description}
                      </p>
                    )}
                    {["pending", "rejected", "cancelled"].includes(
                      promotion.status,
                    ) && (
                      <PromotionRequestForm
                        businessId={businessId}
                        promotion={promotion}
                      />
                    )}
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
