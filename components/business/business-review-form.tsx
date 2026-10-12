"use client";

import { useActionState } from "react";

import { submitBusinessReviewAction } from "@/app/pharmacies/actions";
import { Button } from "@/components/ui/button";
import type { MyBusinessReview } from "@/services/business-directory";

export function BusinessReviewForm({
  businessId,
  businessSlug,
  review,
}: {
  businessId: string;
  businessSlug: string;
  review: MyBusinessReview | null;
}) {
  const [state, action, pending] = useActionState(
    submitBusinessReviewAction,
    {},
  );
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="business_id" value={businessId} />
      <input type="hidden" name="business_slug" value={businessSlug} />
      <label className="grid max-w-xs gap-1 text-sm font-medium text-slate-800">
        Your rating
        <select
          name="rating"
          required
          defaultValue={String(review?.rating ?? 5)}
          className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
        >
          <option value="5">5 · Excellent</option>
          <option value="4">4 · Good</option>
          <option value="3">3 · Okay</option>
          <option value="2">2 · Poor</option>
          <option value="1">1 · Very poor</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-800">
        Review (optional)
        <textarea
          name="review_text"
          maxLength={2000}
          rows={3}
          defaultValue={review?.review_text ?? ""}
          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
        />
      </label>
      {review && (
        <p className="text-xs leading-5 text-slate-600">
          Your latest review is {review.status.replaceAll("_", " ")}. Editing it
          will send it for moderation again.
        </p>
      )}
      {state.error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          role="status"
          className="rounded-xl bg-teal-50 p-3 text-sm text-teal-900"
        >
          {state.message}
        </p>
      )}
      <p className="text-xs leading-5 text-slate-500">
        Reviews are customer-submitted and moderated before publishing. DawaSetu
        does not independently verify visits or purchases.
      </p>
      <Button type="submit" className="justify-self-start" disabled={pending}>
        {pending ? "Submitting…" : review ? "Update review" : "Submit review"}
      </Button>
    </form>
  );
}
