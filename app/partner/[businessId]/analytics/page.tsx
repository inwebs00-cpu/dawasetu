import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireBusinessPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Partner analytics" };

type PageParams = Promise<{ businessId: string }>;
type SearchParams = Promise<{ days?: string }>;

interface PartnerMetrics {
  profile_views: number;
  medicine_searches: number;
  medicine_requests: number;
  inquiries: number;
  confirmed_orders: number;
  available_inventory: number;
  total_inventory: number;
}

interface SearchTrend {
  medicine_id: string;
  product_name: string;
  strength: string;
  search_count: number;
  inventory_status: string;
}

export default async function PartnerAnalyticsPage({
  params,
  searchParams,
}: {
  params: PageParams;
  searchParams: SearchParams;
}) {
  const [{ businessId }, query] = await Promise.all([params, searchParams]);
  const days = [7, 30, 90].includes(Number(query.days))
    ? Number(query.days)
    : 30;
  const { supabase } = await requireBusinessPermission(
    businessId,
    "reports.view",
  );
  const [metricsResult, trendsResult] = await Promise.all([
    supabase.rpc("list_my_business_analytics", {
      p_business_id: businessId,
      p_days: days,
    }),
    supabase.rpc("list_my_business_search_trends", {
      p_business_id: businessId,
      p_days: days,
    }),
  ]);
  const metrics = (metricsResult.data?.[0] ?? null) as PartnerMetrics | null;
  const trends = (trendsResult.data ?? []) as SearchTrend[];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href={`/partner/${businessId}`}>Dashboard</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Business performance
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Analytics and reports
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Counts come from partner inventory, customer requests, inquiries,
          orders, and privacy-preserving daily unique search result appearances.
        </p>
        <form method="get" className="mt-5 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Reporting window
            <select
              name="days"
              defaultValue={String(days)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </label>
          <Button type="submit" variant="secondary" size="sm">
            Apply
          </Button>
        </form>
        {metricsResult.error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Analytics are temporarily unavailable.
          </p>
        )}
        {metrics && (
          <section
            aria-label="Partner metrics"
            className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {[
              ["Profile views · unique/day", metrics.profile_views],
              ["Search appearances · unique/day", metrics.medicine_searches],
              ["Medicine requests received", metrics.medicine_requests],
              ["Inquiries", metrics.inquiries],
              ["Confirmed orders", metrics.confirmed_orders],
              ["Available medicines", metrics.available_inventory],
              ["Inventory items", metrics.total_inventory],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardContent className="p-5">
                  <p className="text-sm text-slate-600">{label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                    {Number(value).toLocaleString("en-IN")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Search appearances for your medicines</CardTitle>
          </CardHeader>
          <CardContent>
            {trendsResult.error ? (
              <p role="alert" className="text-sm text-rose-900">
                Search trends are temporarily unavailable.
              </p>
            ) : trends.length === 0 ? (
              <EmptyState
                title="No search activity in this period"
                description="When public medicine search results include your listed products, daily unique appearances will appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase">
                    <tr>
                      <th className="px-3 py-3 font-medium">Medicine</th>
                      <th className="px-3 py-3 font-medium">Strength</th>
                      <th className="px-3 py-3 font-medium">
                        Daily unique appearances
                      </th>
                      <th className="px-3 py-3 font-medium">Reported stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {trends.map((trend) => (
                      <tr key={trend.medicine_id}>
                        <td className="px-3 py-3 font-medium text-slate-900">
                          {trend.product_name}
                        </td>
                        <td className="px-3 py-3 text-slate-700">
                          {trend.strength}
                        </td>
                        <td className="px-3 py-3 text-slate-700">
                          {Number(trend.search_count).toLocaleString("en-IN")}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={trend.inventory_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
