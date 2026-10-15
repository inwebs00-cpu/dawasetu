import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePlatformPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin dashboard" };

interface Summary {
  total_users: number;
  total_partners: number;
  pending_partners: number;
  total_requests: number;
  active_medicines: number;
  total_orders: number;
}

interface RecentPartner {
  id: string;
  business_name: string;
  status: string;
  created_at: string;
}

interface RecentAvailabilityRequest {
  id: string;
  requested_medicine_name: string;
  status: string;
  created_at: string;
}

interface AdminAnalyticsSummary {
  new_users: number;
  new_approved_partners: number;
  medicine_searches: number;
  medicine_requests: number;
  paid_revenue_inr: number;
}

interface TopMedicineSearch {
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export default async function AdminDashboardPage() {
  const { supabase } = await requirePlatformPermission("dashboard.view");
  const [
    summaryResult,
    medicinePermission,
    partnerPermission,
    partnerApprovalPermission,
    locationPermission,
    contentPermission,
    auditPermission,
    supportPermission,
    teamPermission,
    billingPermission,
    promotionsPermission,
    securityPermission,
    reportsPermission,
    fulfillmentPermission,
    usersPermission,
  ] = await Promise.all([
    supabase.rpc("get_admin_dashboard_summary"),
    supabase.rpc("has_platform_permission", {
      p_permission_key: "medicines.view",
    }),
    supabase.rpc("has_platform_permission", {
      p_permission_key: "partners.view",
    }),
    supabase.rpc("has_platform_permission", {
      p_permission_key: "partners.approve",
    }),
    supabase.rpc("has_platform_permission", {
      p_permission_key: "partners.manage",
    }),
    supabase.rpc("has_platform_permission", {
      p_permission_key: "content.manage",
    }),
    supabase.rpc("has_platform_permission", {
      p_permission_key: "audit_logs.view",
    }),
    supabase.rpc("has_platform_permission", {
      p_permission_key: "support.manage",
    }),
    supabase.rpc("has_platform_permission", {
      p_permission_key: "team.manage",
    }),
    supabase.rpc("has_platform_permission", {
      p_permission_key: "payments.manage",
    }),
    supabase.rpc("has_platform_permission", {
      p_permission_key: "promotions.manage",
    }),
    supabase.rpc("has_platform_permission", {
      p_permission_key: "security.manage",
    }),
    supabase.rpc("has_platform_permission", {
      p_permission_key: "reports.view",
    }),
    supabase.rpc("has_platform_permission", {
      p_permission_key: "requests.view",
    }),
    supabase.rpc("has_platform_permission", {
      p_permission_key: "users.view",
    }),
  ]);
  const { data, error } = summaryResult;
  const canManageMedicines = medicinePermission.data === true;
  const canViewPartners = partnerPermission.data === true;
  const canApprovePartners = partnerApprovalPermission.data === true;
  const canManageLocations = locationPermission.data === true;
  const canManageContent = contentPermission.data === true;
  const canViewAudit = auditPermission.data === true;
  const canManageSupport = supportPermission.data === true;
  const canManageTeam = teamPermission.data === true;
  const canManageBilling = billingPermission.data === true;
  const canManagePromotions = promotionsPermission.data === true;
  const canManageSecurity = securityPermission.data === true;
  const canViewReports = reportsPermission.data === true;
  const canViewFulfillment = fulfillmentPermission.data === true;
  const canViewUsers = usersPermission.data === true;
  const summary = (data?.[0] ?? null) as Summary | null;
  const metrics = summary
    ? ([
        ["Total users", summary.total_users],
        ["Partner businesses", summary.total_partners],
        ["Pending partner reviews", summary.pending_partners],
        ["Medicine requests", summary.total_requests],
        ["Approved medicines", summary.active_medicines],
        ["Orders and inquiries", summary.total_orders],
      ] as const)
    : [];
  const [
    recentPartnersResult,
    recentRequestsResult,
    analyticsSummaryResult,
    topSearchesResult,
    regionsResult,
  ] = await Promise.all([
    canViewPartners
      ? supabase
          .from("businesses")
          .select("id, business_name, status, created_at")
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [], error: null }),
    canViewFulfillment
      ? supabase
          .from("medicine_requests")
          .select("id, requested_medicine_name, status, created_at")
          .in("status", ["open", "partially_fulfilled"])
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [], error: null }),
    canViewReports
      ? supabase.rpc("admin_get_analytics_summary", { p_days: 30 })
      : Promise.resolve({ data: [], error: null }),
    canViewReports
      ? supabase.rpc("admin_list_top_medicine_searches", { p_days: 30 })
      : Promise.resolve({ data: [], error: null }),
    canViewReports
      ? supabase.rpc("admin_list_analytics_regions", { p_days: 30 })
      : Promise.resolve({ data: [], error: null }),
  ]);
  const recentPartners = (recentPartnersResult.data ?? []) as RecentPartner[];
  const recentRequests = (recentRequestsResult.data ??
    []) as RecentAvailabilityRequest[];
  const analytics = (analyticsSummaryResult.data?.[0] ??
    null) as AdminAnalyticsSummary | null;
  const topSearches = (topSearchesResult.data ?? []) as TopMedicineSearch[];
  const regions = (regionsResult.data ?? []) as RegionMetric[];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <nav className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/account">Account</Link>
            </Button>
            {canManageMedicines && (
              <Button asChild variant="secondary" size="sm">
                <Link href="/admin/medicines">Medicine master</Link>
              </Button>
            )}
          </nav>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Network administration
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Admin dashboard
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Counts come from the current DawaSetu database. No demo values are
          shown.
        </p>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900"
          >
            Dashboard metrics are temporarily unavailable.
          </p>
        )}
        {summary && (
          <section
            aria-label="Network metrics"
            className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {metrics.map(([label, value]) => (
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
        {(canViewPartners || canViewFulfillment) && (
          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            {canViewPartners && (
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle>Recent partner registrations</CardTitle>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/admin/partners">Review partners</Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {recentPartnersResult.error ? (
                    <p role="alert" className="text-sm text-rose-800">
                      Partner registrations are temporarily unavailable.
                    </p>
                  ) : recentPartners.length === 0 ? (
                    <EmptyState
                      title="No partner registrations yet"
                      description="New pharmacy, clinic, nursing-home, and distributor applications will appear here."
                    />
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {recentPartners.map((partner) => (
                        <div
                          key={partner.id}
                          className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <div>
                            <p className="font-medium text-slate-900">
                              {partner.business_name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Submitted {formatDate(partner.created_at)}
                            </p>
                          </div>
                          <StatusBadge status={partner.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            {canViewFulfillment && (
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle>Open availability requests</CardTitle>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/admin/fulfillment">View requests</Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {recentRequestsResult.error ? (
                    <p role="alert" className="text-sm text-rose-800">
                      Availability requests are temporarily unavailable.
                    </p>
                  ) : recentRequests.length === 0 ? (
                    <EmptyState
                      title="No open requests"
                      description="Active customer medicine requests will appear here."
                    />
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {recentRequests.map((request) => (
                        <div
                          key={request.id}
                          className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <div>
                            <p className="font-medium text-slate-900">
                              {request.requested_medicine_name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Requested {formatDate(request.created_at)}
                            </p>
                          </div>
                          <StatusBadge status={request.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </section>
        )}
        {canViewReports && (
          <section className="mt-6">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">
                  Network pulse
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Verified activity and paid revenue from the last 30 days.
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/analytics">Open analytics</Link>
              </Button>
            </div>
            {analyticsSummaryResult.error ? (
              <p
                role="alert"
                className="rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
              >
                Network reporting is temporarily unavailable.
              </p>
            ) : analytics ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {[
                  ["New users", analytics.new_users],
                  ["New approved partners", analytics.new_approved_partners],
                  ["Medicine requests", analytics.medicine_requests],
                  ["Unique search appearances", analytics.medicine_searches],
                  [
                    "Paid revenue",
                    `₹${Number(analytics.paid_revenue_inr).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`,
                  ],
                ].map(([label, value]) => (
                  <Card key={label}>
                    <CardContent className="p-4">
                      <p className="text-sm text-slate-600">{label}</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">
                        {typeof value === "number"
                          ? value.toLocaleString("en-IN")
                          : value}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Most searched medicines</CardTitle>
                </CardHeader>
                <CardContent>
                  {topSearchesResult.error ? (
                    <p role="alert" className="text-sm text-rose-800">
                      Search trends are temporarily unavailable.
                    </p>
                  ) : topSearches.length === 0 ? (
                    <EmptyState
                      title="No medicine search activity yet"
                      description="Popular medicines will appear here as customers use DawaSetu search."
                    />
                  ) : (
                    <ol className="grid gap-3">
                      {topSearches.slice(0, 5).map((medicine, index) => {
                        const maxCount = Math.max(
                          ...topSearches
                            .slice(0, 5)
                            .map((item) => item.search_count),
                          1,
                        );
                        const width = Math.max(
                          6,
                          Math.round((medicine.search_count / maxCount) * 100),
                        );
                        return (
                          <li key={medicine.medicine_id}>
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="min-w-0 truncate font-medium text-slate-900">
                                {index + 1}. {medicine.product_name} ·{" "}
                                {medicine.strength}
                              </span>
                              <span className="shrink-0 text-slate-600">
                                {Number(medicine.search_count).toLocaleString(
                                  "en-IN",
                                )}
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-teal-700"
                                style={{ width: `${width}%` }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Regional network coverage</CardTitle>
                </CardHeader>
                <CardContent>
                  {regionsResult.error ? (
                    <p role="alert" className="text-sm text-rose-800">
                      Regional activity is temporarily unavailable.
                    </p>
                  ) : regions.length === 0 ? (
                    <EmptyState
                      title="No mapped regional activity"
                      description="Partner and request activity will appear when it is linked to configured districts and areas."
                    />
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {regions.slice(0, 5).map((region) => (
                        <div
                          key={`${region.state_name}-${region.district_name}`}
                          className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"
                        >
                          <div>
                            <p className="font-medium text-slate-900">
                              {region.district_name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {region.state_name}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 text-right text-sm text-slate-600">
                            <span>
                              {Number(region.approved_partners).toLocaleString(
                                "en-IN",
                              )}{" "}
                              partners
                            </span>
                            <span>
                              {Number(region.medicine_requests).toLocaleString(
                                "en-IN",
                              )}{" "}
                              requests
                            </span>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${region.district_name}, ${region.state_name}, India`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-teal-800 underline underline-offset-4"
                            >
                              Map
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        )}
        <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {canViewUsers && (
            <Card>
              <CardHeader>
                <CardTitle>Users and patients</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">
                  Find customer and partner accounts, review business links, and
                  manage account access with audited password confirmation.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/admin/users">Open user directory</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {canManageMedicines && (
            <Card>
              <CardHeader>
                <CardTitle>Medicine master</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">
                  Review partner submissions, maintain the product catalog, and
                  control medicine visibility.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/admin/medicines">Manage medicines</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {canViewPartners && (
            <Card>
              <CardHeader>
                <CardTitle>Partner businesses</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">
                  Review submitted partner businesses and control approved or
                  suspended public listings.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/admin/partners">Review partners</Link>
                </Button>
                {canApprovePartners && (
                  <Button asChild variant="ghost" className="mt-4 sm:ml-2">
                    <Link href="/admin/reviews">Moderate reviews</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
          {canManageLocations && (
            <Card>
              <CardHeader>
                <CardTitle>Network configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">
                  Add the states, districts, and localities where DawaSetu
                  partners operate so customer requests can be routed.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/admin/locations">Manage areas</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {canManageContent && (
            <Card>
              <CardHeader>
                <CardTitle>Public content</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">
                  Manage DawaSetu news and publish updates for customers and
                  network partners.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/admin/content">Manage content</Link>
                </Button>
                <Button asChild variant="ghost" className="mt-4 sm:ml-2">
                  <Link href="/admin/redirect-websites">Redirect websites</Link>
                </Button>
                <Button asChild variant="ghost" className="mt-4 sm:ml-2">
                  <Link href="/admin/categories">Medicine categories</Link>
                </Button>
                <Button asChild variant="ghost" className="mt-4 sm:ml-2">
                  <Link href="/admin/doctors">Doctor appointments</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {canViewAudit && (
            <Card>
              <CardHeader>
                <CardTitle>Audit log</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">
                  Review recorded business, inventory, catalog, and content
                  changes.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/admin/audit-logs">Open audit log</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {canManageSupport && (
            <Card>
              <CardHeader>
                <CardTitle>Support desk</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">
                  Triage customer and partner cases, assign tickets, and keep
                  internal notes separate from customer replies.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/admin/support">Manage support tickets</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {canManageTeam && (
            <Card>
              <CardHeader>
                <CardTitle>Team and roles</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">
                  Assign least-privilege platform roles and manage team account
                  access with password confirmation and audit records.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/admin/team">Manage team</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {canManageBilling && (
            <Card>
              <CardHeader>
                <CardTitle>Plans and billing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">
                  Configure INR plan prices, limits, trial periods and included
                  features with a reviewed change history.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/admin/billing">Manage plans</Link>
                </Button>
                <Button asChild variant="ghost" className="mt-4 sm:ml-2">
                  <Link href="/admin/refunds">Payment refunds</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {canManagePromotions && (
            <Card>
              <CardHeader>
                <CardTitle>Promotions and listings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">
                  Review partner offers and control time-bound featured or
                  sponsored listings.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/admin/promotions">Manage promotions</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {canManageSecurity && (
            <Card>
              <CardHeader>
                <CardTitle>Security settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">
                  Configure an authenticator and review database-enforced
                  protection for privileged admin operations.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/admin/security">Manage security</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {canViewReports && (
            <Card>
              <CardHeader>
                <CardTitle>Analytics and reports</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">
                  Review real medicine search, profile view, request, partner,
                  and paid-payment totals by reporting window.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/admin/analytics">Open reports</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {canViewFulfillment && (
            <Card>
              <CardHeader>
                <CardTitle>Orders and inquiries</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">
                  Review customer inquiries and partner-confirmation records
                  without exposing customer phone numbers or exact locations.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/admin/fulfillment">Open operations</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}
