import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePlatformPermission } from "@/lib/auth/authorization";
import { isRazorpayRefundConfigured } from "@/lib/payments/razorpay";

import { requestPaymentRefundAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment refunds" };

type SearchParams = Promise<{ error?: string; updated?: string }>;

interface RefundablePayment {
  payment_id: string;
  business_name: string;
  plan_name: string | null;
  provider_payment_id: string;
  amount_inr: number;
  refunded_amount_inr: number;
  refundable_balance_inr: number;
  currency: string;
  paid_at: string | null;
  pending_refund_id: string | null;
  pending_refund_status: string | null;
}

interface RefundRequest {
  refund_request_id: string;
  payment_id: string;
  business_name: string;
  plan_name: string | null;
  provider_payment_id: string;
  provider_refund_id: string | null;
  amount_inr: number;
  reason: string;
  status: string;
  created_at: string;
  processed_at: string | null;
}

function formatAmount(value: number) {
  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function messageFor(params: Awaited<SearchParams>) {
  if (params.updated) return "Refund request submitted.";
  switch (params.error) {
    case "invalid":
      return "Check the amount, reason, confirmation, and password fields.";
    case "reauth":
      return "Current password could not be verified. No refund request was sent.";
    case "reserve":
      return "This payment cannot be refunded for that amount, or another refund is still pending.";
    case "provider_rejected":
      return "Razorpay rejected the request. No refund was recorded as processed.";
    case "pending":
      return "Refund status is uncertain. The amount remains reserved; reconcile this request in Razorpay before trying again.";
    case "unconfigured":
      return "Refunds are unavailable until Razorpay keys and webhook secret are configured on the server.";
    default:
      return "";
  }
}

export default async function AdminRefundsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { supabase } = await requirePlatformPermission("payments.manage");
  const [params, refundableResult, requestsResult] = await Promise.all([
    searchParams,
    supabase.rpc("admin_list_refundable_payments"),
    supabase.rpc("admin_list_payment_refund_requests"),
  ]);
  const payments = (refundableResult.data ?? []) as RefundablePayment[];
  const requests = (requestsResult.data ?? []) as RefundRequest[];
  const refundsEnabled = isRazorpayRefundConfigured();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/billing">Plans and billing</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Finance operations
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Payment refunds
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Refunds are sent to the original payment method through Razorpay. Each
          request requires finance permission and current-password verification.
          A timeout can leave the provider outcome uncertain, so reconcile it in
          Razorpay before retrying.
        </p>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          Refunds cannot be canceled after Razorpay accepts them. Confirm the
          payment and amount before submitting.
        </p>
        {!refundsEnabled && (
          <p className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
            Refund actions are disabled until the Razorpay server keys and
            webhook secret are configured.
          </p>
        )}
        {messageFor(params) && (
          <p
            role={params.error ? "alert" : "status"}
            className={`mt-4 rounded-xl p-4 text-sm ${params.error ? "bg-rose-50 text-rose-900" : "bg-emerald-50 text-emerald-900"}`}
          >
            {messageFor(params)}
          </p>
        )}

        {(refundableResult.error || requestsResult.error) && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Payment records are temporarily unavailable. No refund has been
            started.
          </p>
        )}

        <section className="mt-6">
          <h2 className="mb-3 text-xl font-semibold text-slate-950">
            Captured Razorpay payments
          </h2>
          {payments.filter((payment) => payment.refundable_balance_inr > 0)
            .length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              No captured payments currently have a refundable balance.
            </div>
          ) : (
            <div className="grid gap-4">
              {payments.map((payment) => {
                const refundable = Number(payment.refundable_balance_inr);
                if (refundable <= 0) return null;
                return (
                  <article
                    key={payment.payment_id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-950">
                          {payment.business_name} ·{" "}
                          {payment.plan_name ?? "Subscription"}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          Razorpay payment {payment.provider_payment_id}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Paid{" "}
                          {payment.paid_at
                            ? new Date(payment.paid_at).toLocaleString(
                                "en-IN",
                                { dateStyle: "medium", timeStyle: "short" },
                              )
                            : "date unavailable"}{" "}
                          · Captured ₹{formatAmount(Number(payment.amount_inr))}{" "}
                          · Refunded ₹
                          {formatAmount(Number(payment.refunded_amount_inr))}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">
                          Available to refund
                        </p>
                        <p className="text-lg font-semibold text-slate-950">
                          ₹{formatAmount(refundable)}
                        </p>
                        {payment.pending_refund_status && (
                          <StatusBadge
                            status={`refund_${payment.pending_refund_status}`}
                          />
                        )}
                      </div>
                    </div>

                    {payment.pending_refund_id ? (
                      <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm leading-5 text-amber-950">
                        Refund request {payment.pending_refund_id} is{" "}
                        {payment.pending_refund_status}. This payment is locked
                        until the provider result is reconciled.
                      </p>
                    ) : refundsEnabled ? (
                      <form
                        action={requestPaymentRefundAction}
                        className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                      >
                        <input
                          type="hidden"
                          name="payment_id"
                          value={payment.payment_id}
                        />
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Refund amount (₹)
                          <input
                            name="amount_inr"
                            type="number"
                            required
                            min="0.01"
                            max={refundable.toFixed(2)}
                            step="0.01"
                            defaultValue={refundable.toFixed(2)}
                            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-medium text-slate-700 sm:col-span-2">
                          Reason
                          <input
                            name="reason"
                            required
                            maxLength={500}
                            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Current password
                          <input
                            name="current_password"
                            type="password"
                            required
                            minLength={12}
                            autoComplete="current-password"
                            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                          />
                        </label>
                        <label className="flex items-start gap-2 text-xs leading-5 text-slate-700 sm:col-span-2 lg:col-span-3">
                          <input
                            name="confirm_refund"
                            type="checkbox"
                            value="yes"
                            required
                            className="mt-1 size-4 accent-rose-700"
                          />
                          I reviewed the payment and amount and authorize this
                          refund request.
                        </label>
                        <div className="flex items-end">
                          <Button
                            type="submit"
                            variant="destructive"
                            className="w-full"
                          >
                            Submit refund request
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500">
                        Refund action is disabled in this deployment.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-9">
          <h2 className="mb-3 text-xl font-semibold text-slate-950">
            Recent refund requests
          </h2>
          {requests.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              No refund requests recorded.
            </div>
          ) : (
            <div className="grid gap-3">
              {requests.map((request) => (
                <article
                  key={request.refund_request_id}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-slate-950">
                        {request.business_name} · ₹
                        {formatAmount(Number(request.amount_inr))}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {request.reason}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Request {request.refund_request_id} · Payment{" "}
                        {request.provider_payment_id}
                        {request.provider_refund_id
                          ? ` · Refund ${request.provider_refund_id}`
                          : ""}
                      </p>
                    </div>
                    <StatusBadge status={`refund_${request.status}`} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
