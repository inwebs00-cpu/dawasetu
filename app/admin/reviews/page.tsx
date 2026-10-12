import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePlatformPermission } from "@/lib/auth/authorization";

import { moderateBusinessReviewAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customer reviews" };

interface BusinessReview {
  review_id: string;
  business_id: string;
  business_name: string;
  customer_name: string;
  rating: number;
  review_text: string | null;
  review_status: string;
  created_at: string;
  updated_at: string;
}

type SearchParams = Promise<{
  status?: string;
  updated?: string;
  error?: string;
}>;

const reviewStatuses = ["pending", "approved", "rejected", "hidden"];

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const status = reviewStatuses.includes(params.status ?? "")
    ? params.status!
    : "pending";
  const { supabase } = await requirePlatformPermission("partners.approve");
  const { data, error } = await supabase.rpc("admin_list_business_reviews", {
    p_status: status,
  });
  const reviews = (data ?? []) as BusinessReview[];

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
          Community feedback
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Customer reviews
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Review customer-submitted feedback before it appears on public partner
          profiles. Approval does not mean DawaSetu verified a visit or
          purchase.
        </p>
        <form
          method="get"
          className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
        >
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Review status
            <select
              name="status"
              defaultValue={status}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
            >
              {reviewStatuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="secondary" size="sm">
            Filter reviews
          </Button>
        </form>
        {params.updated && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"
          >
            Review {params.updated}.
          </p>
        )}
        {params.error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-900"
          >
            The review could not be updated. Refresh and try again.
          </p>
        )}
        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Reviews are temporarily unavailable.
          </p>
        ) : reviews.length === 0 ? (
          <Card className="mt-5">
            <CardContent className="p-6">
              <EmptyState
                title={`No ${status} reviews`}
                description="Customer feedback will appear here for moderation."
              />
            </CardContent>
          </Card>
        ) : (
          <section className="mt-5 grid gap-3">
            {reviews.map((review) => (
              <Card key={review.review_id}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-slate-950">
                        {review.business_name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {review.customer_name} ·{" "}
                        {new Date(review.created_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="font-semibold text-amber-700"
                        aria-label={`${review.rating} out of 5 stars`}
                      >
                        {"★".repeat(review.rating)} {review.rating}/5
                      </span>
                      <StatusBadge status={review.review_status} />
                    </div>
                  </div>
                  {review.review_text && (
                    <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 whitespace-pre-wrap text-slate-700">
                      {review.review_text}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(["approved", "rejected", "hidden"] as const).map(
                      (decision) => (
                        <form
                          key={decision}
                          action={moderateBusinessReviewAction}
                        >
                          <input
                            type="hidden"
                            name="review_id"
                            value={review.review_id}
                          />
                          <input
                            type="hidden"
                            name="decision"
                            value={decision}
                          />
                          <input type="hidden" name="status" value={status} />
                          <Button
                            type="submit"
                            size="sm"
                            variant={
                              decision === "approved" ? "primary" : "outline"
                            }
                          >
                            {decision === "approved"
                              ? "Approve"
                              : decision === "rejected"
                                ? "Reject"
                                : "Hide"}
                          </Button>
                        </form>
                      ),
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
