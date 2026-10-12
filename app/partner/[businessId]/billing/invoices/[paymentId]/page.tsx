import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { PrintInvoiceButton } from "@/components/billing/print-invoice-button";
import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { requireBusinessPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Payment receipt",
  robots: { index: false, follow: false },
};

type PageParams = Promise<{ businessId: string; paymentId: string }>;
interface PaymentReceipt {
  payment_id: string;
  invoice_number: string;
  business_id: string;
  business_name: string;
  business_email: string | null;
  business_phone: string;
  business_address: string | null;
  registration_number: string | null;
  plan_name: string | null;
  amount_inr: number;
  currency: string;
  provider: string;
  provider_payment_id: string | null;
  paid_at: string;
  created_at: string;
}

export default async function PaymentReceiptPage({
  params,
}: {
  params: PageParams;
}) {
  const { businessId, paymentId } = await params;
  if (
    !/^[0-9a-f-]{36}$/i.test(businessId) ||
    !/^[0-9a-f-]{36}$/i.test(paymentId)
  )
    notFound();
  const { supabase } = await requireBusinessPermission(
    businessId,
    "payments.view",
  );
  const { data, error } = await supabase.rpc("get_my_payment_invoice", {
    p_payment_id: paymentId,
  });
  const receipt = Array.isArray(data)
    ? ((data[0] ?? null) as PaymentReceipt | null)
    : null;
  if (error || !receipt || receipt.business_id !== businessId) notFound();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-8 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Brand compact />
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/partner/${businessId}/billing`}>Billing</Link>
            </Button>
            <PrintInvoiceButton />
          </div>
        </header>
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <p className="text-sm font-semibold text-teal-800">
                DawaSetu · Payment receipt
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">
                Receipt
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Receipt number {receipt.invoice_number}
              </p>
            </div>
            <p className="text-sm text-slate-600">
              Paid{" "}
              {new Date(receipt.paid_at).toLocaleDateString("en-IN", {
                dateStyle: "long",
              })}
            </p>
          </div>
          <section className="grid gap-6 border-b border-slate-200 py-6 sm:grid-cols-2">
            <div>
              <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Billed to
              </h2>
              <p className="mt-2 font-semibold text-slate-950">
                {receipt.business_name}
              </p>
              {receipt.business_address && (
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {receipt.business_address}
                </p>
              )}
              {receipt.business_email && (
                <p className="mt-1 text-sm text-slate-600">
                  {receipt.business_email}
                </p>
              )}
              <p className="mt-1 text-sm text-slate-600">
                {receipt.business_phone}
              </p>
              {receipt.registration_number && (
                <p className="mt-1 text-xs text-slate-500">
                  Business registration: {receipt.registration_number}
                </p>
              )}
            </div>
            <div>
              <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Payment details
              </h2>
              <p className="mt-2 text-sm text-slate-700">
                Gateway: {receipt.provider}
              </p>
              {receipt.provider_payment_id && (
                <p className="mt-1 text-sm break-all text-slate-700">
                  Payment ID: {receipt.provider_payment_id}
                </p>
              )}
              <p className="mt-1 text-sm text-slate-700">Status: Paid</p>
            </div>
          </section>
          <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-200 py-6 text-sm">
            <div>
              <p className="font-semibold text-slate-950">
                {receipt.plan_name ?? "DawaSetu subscription"}
              </p>
              <p className="mt-1 text-slate-600">Subscription payment</p>
            </div>
            <p className="font-semibold text-slate-950">
              ₹
              {Number(receipt.amount_inr).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="flex justify-end gap-10 py-5">
            <p className="font-semibold text-slate-700">Total paid</p>
            <p className="text-lg font-semibold text-slate-950">
              ₹
              {Number(receipt.amount_inr).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}{" "}
              {receipt.currency}
            </p>
          </div>
          <p className="border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
            This receipt confirms the recorded subscription payment. Keep it
            with your business records.
          </p>
        </article>
      </div>
    </main>
  );
}
