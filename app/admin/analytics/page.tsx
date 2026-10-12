import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { requirePlatformPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Network analytics" };

type SearchParams = Promise<{ days?: string }>;

interface AnalyticsSummary {
  total_users: number;
  new_users: number;
  approved_partners: number;
  new_approved_partners: number;
  medicine_searches: number;
  profile_views: number;
  medicine_requests: number;
  paid_revenue_inr: number;
}

interface TopSearch {
  medicine_id: string;
  product_name: string;
  strength: string;
  search_count: number;
}

interface RegionMetric {
  state_name: string;
  district_name: string;
  approved_partners: number;
  medicine_requests: number;
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const days = [7, 30, 90].includes(Number(query.days))
    ? Number(query.days)
    : 30;
  const { supabase } = await requirePlatformPermission("reports.view");
  const [summaryResult, searchesResult, regionsResult] = await Promise.all([
    supabase.rpc("admin_get_analytics_summary", { p_days: days }),
    supabase.rpc("admin_list_top_medicine_searches", { p_days: days }),
    supabase.rpc("admin_list_analytics_regions", { p_days: days }),
  ]);
  const summary = (summaryResult.data?.[0] ?? null) as AnalyticsSummary | null;
  const searches = (searchesResult.data ?? []) as TopSearch[];
  const regions = (regionsResult.data ?? []) as RegionMetric[];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin">Dashboard</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Network performance
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Analytics and reports
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          User, partner, request, and paid-payment counts come from DawaSetu
          records. Profile views and search counts are daily unique totals.
          Search counts are medicine result appearances based on
          privacy-preserving visitor hashes.
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
        {(summaryResult.error ||
          searchesResult.error ||
          regionsResult.error) && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Some analytics are temporarily unavailable.
          </p>
        )}
        {summary && (
          <section
            aria-label="Network analytics metrics"
            className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {[
              ["Total users", summary.total_users],
              [`New users · ${days} days`, summary.new_users],
              ["Approved partners", summary.approved_partners],
              [
                `New approved partners · ${days} days`,
                summary.new_approved_partners,
              ],
              [
                `Search result appearances · ${days} days`,
                summary.medicine_searches,
              ],
              [`Partner profile views · ${days} days`, summary.profile_views],
              [`Medicine requests · ${days} days`, summary.medicine_requests],
              [
                `Paid revenue · ${days} days`,
                `₹${Number(summary.paid_revenue_inr).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              ],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardContent className="p-5">
                  <p className="text-sm text-slate-600">{label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                    {typeof value === "number"
                      ? value.toLocaleString("en-IN")
                      : value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top medicine search appearances</CardTitle>
            </CardHeader>
            <CardContent>
              {searchesResult.error ? (
                <p className="text-sm text-slate-600">
                  Search reports are unavailable.
                </p>
              ) : searches.length === 0 ? (
                <EmptyState
                  title="No search appearances in this period"
                  description="Medicine search results will appear here as the network is used."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[24rem] text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase">
                      <tr>
                        <th className="px-3 py-3 font-medium">Medicine</th>
                        <th className="px-3 py-3 font-medium">Strength</th>
                        <th className="px-3 py-3 text-right font-medium">
                          Daily unique appearances
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {searches.map((search) => (
                        <tr key={search.medicine_id}>
                          <td className="px-3 py-3 font-medium text-slate-900">
                            {search.product_name}
                          </td>
                          <td className="px-3 py-3 text-slate-700">
                            {search.strength}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-700">
                            {Number(search.search_count).toLocaleString(
                              "en-IN",
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>State and district network</CardTitle>
            </CardHeader>
            <CardContent>
              {regionsResult.error ? (
                <p className="text-sm text-slate-600">
                  Regional reports are unavailable.
                </p>
              ) : regions.length === 0 ? (
                <EmptyState
                  title="No mapped regional activity"
                  description="Add active locations and map partner businesses to report regional performance."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[26rem] text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase">
                      <tr>
                        <th className="px-3 py-3 font-medium">District</th>
                        <th className="px-3 py-3 text-right font-medium">
                          Partners
                        </th>
                        <th className="px-3 py-3 text-right font-medium">
                          Requests
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {regions.map((region) => (
                        <tr
                          key={`${region.state_name}-${region.district_name}`}
                        >
                          <td className="px-3 py-3 text-slate-900">
                            <span className="font-medium">
                              {region.district_name}
                            </span>
                            <span className="block text-xs text-slate-500">
                              {region.state_name}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right text-slate-700">
                            {Number(region.approved_partners).toLocaleString(
                              "en-IN",
                            )}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-700">
                            {Number(region.medicine_requests).toLocaleString(
                              "en-IN",
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
