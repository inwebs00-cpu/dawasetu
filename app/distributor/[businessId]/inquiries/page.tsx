import Link from "next/link";
import type { Metadata } from "next";

import { DistributorInquiryResponseControls } from "@/components/distributor/inquiry-response-controls";
import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireBusinessPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Distributor inquiries" };

type PageParams = Promise<{ businessId: string }>;
type SearchParams = Promise<{ status?: string }>;

interface DistributorInquiry {
  inquiry_id: string;
  partner_business_id: string;
  partner_name: string;
  partner_type: string;
  partner_area: string | null;
  medicine_id: string;
  product_name: string;
  brand_name: string | null;
  composition: string | null;
  strength: string;
  requested_quantity: number;
  message: string | null;
  status: string;
  response_message: string | null;
  created_at: string;
  responded_at: string | null;
}

const inquiryStatuses = ["open", "responded", "unavailable", "closed"];

export default async function DistributorInquiriesPage({
  params,
  searchParams,
}: {
  params: PageParams;
  searchParams: SearchParams;
}) {
  const [{ businessId }, query] = await Promise.all([params, searchParams]);
  const status = inquiryStatuses.includes(query.status ?? "")
    ? query.status!
    : "";
  const { supabase } = await requireBusinessPermission(
    businessId,
    "distributors.access.manage",
  );
  const { data, error } = await supabase.rpc("list_my_distributor_inquiries", {
    p_distributor_business_id: businessId,
    p_status: status || null,
  });
  const inquiries = (data ?? []) as DistributorInquiry[];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href={`/distributor/${businessId}`}>Dashboard</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Private B2B network
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Partner stock inquiries
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Reply to verified pharmacies, clinics, and nursing homes asking about
          your reported stock. These inquiries connect businesses; DawaSetu does
          not place or settle medicine orders.
        </p>

        <form
          method="get"
          className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
        >
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Inquiry status
            <select
              name="status"
              defaultValue={status}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
            >
              <option value="">All inquiries</option>
              {inquiryStatuses.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="secondary" size="sm">
            Filter
          </Button>
        </form>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Partner inquiries are temporarily unavailable.
          </p>
        )}
        {!error && inquiries.length === 0 && (
          <Card className="mt-5">
            <CardContent className="p-6">
              <EmptyState
                title="No partner stock inquiries"
                description="Verified partners with approved access can ask about your latest reported stock."
              />
            </CardContent>
          </Card>
        )}
        {!error && inquiries.length > 0 && (
          <section className="mt-5 grid gap-4">
            {inquiries.map((inquiry) => (
              <Card key={inquiry.inquiry_id}>
                <CardContent className="grid gap-4 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-slate-950">
                          {inquiry.product_name} · {inquiry.strength}
                        </h2>
                        <StatusBadge status={inquiry.status} />
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {inquiry.brand_name ? `${inquiry.brand_name} · ` : ""}
                        {inquiry.composition ?? "Composition not supplied"}
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {inquiry.partner_name} · {inquiry.partner_type}
                        {inquiry.partner_area
                          ? ` · ${inquiry.partner_area}`
                          : ""}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Requested quantity:{" "}
                        {Number(inquiry.requested_quantity).toLocaleString(
                          "en-IN",
                        )}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Received{" "}
                        {new Date(inquiry.created_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Asia/Kolkata",
                        })}
                      </p>
                    </div>
                  </div>
                  {inquiry.message && (
                    <p className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                      {inquiry.message}
                    </p>
                  )}
                  {inquiry.response_message && (
                    <p className="rounded-xl bg-teal-50 p-3 text-sm leading-6 text-teal-950">
                      Your reply: {inquiry.response_message}
                    </p>
                  )}
                  {inquiry.status === "open" && (
                    <DistributorInquiryResponseControls
                      distributorBusinessId={businessId}
                      inquiryId={inquiry.inquiry_id}
                    />
                  )}
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
