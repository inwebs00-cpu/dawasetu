import Link from "next/link";
import {
  Activity,
  Building2,
  ChartColumn,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  Pill,
  Settings,
  ShieldCheck,
  Store,
  Tag,
  UsersRound,
} from "lucide-react";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePlatformPermission } from "@/lib/auth/authorization";
import { listAuthUserDirectoryFallback } from "@/services/admin-auth-users";

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

interface PendingVerification {
  user_id: string;
  full_name: string;
  email: string | null;
  created_at: string;
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
    ? [
        {
          label: "Total users",
          value: summary.total_users,
          Icon: UsersRound,
          tone: "bg-sky-50 text-sky-700",
          detail: "Registered accounts",
        },
        {
          label: "Partner businesses",
          value: summary.total_partners,
          Icon: Store,
          tone: "bg-emerald-50 text-emerald-700",
          detail: "Across the network",
        },
        {
          label: "Partner reviews",
          value: summary.pending_partners,
          Icon: Building2,
          tone: "bg-amber-50 text-amber-700",
          detail: "Awaiting admin review",
        },
        {
          label: "Medicine requests",
          value: summary.total_requests,
          Icon: ClipboardList,
          tone: "bg-violet-50 text-violet-700",
          detail: "Customer availability requests",
        },
        {
          label: "Approved medicines",
          value: summary.active_medicines,
          Icon: Pill,
          tone: "bg-teal-50 text-teal-700",
          detail: "Public catalog",
        },
        {
          label: "Orders and inquiries",
          value: summary.total_orders,
          Icon: Activity,
          tone: "bg-indigo-50 text-indigo-700",
          detail: "Network activity",
        },
      ]
    : [];
  const [
    pendingVerificationsResult,
    recentPartnersResult,
    recentRequestsResult,
    analyticsSummaryResult,
    topSearchesResult,
    regionsResult,
  ] = await Promise.all([
    canViewUsers
      ? supabase.rpc("admin_list_user_directory", {
          p_search: null,
          p_account_type: null,
          p_status: null,
          p_verification_status: "pending",
          p_limit: 5,
          p_offset: 0,
        })
      : Promise.resolve({ data: [], error: null }),
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
  let pendingVerifications = (pendingVerificationsResult.data ??
    []) as PendingVerification[];
  let usingAuthUserFallback = false;
  if (canViewUsers && pendingVerificationsResult.error) {
    try {
      const authUsers = await listAuthUserDirectoryFallback();
      pendingVerifications = authUsers
        .filter((user) => user.verification_status === "pending")
        .slice(0, 5)
        .map(({ user_id, full_name, email, created_at }) => ({
          user_id,
          full_name,
          email,
          created_at,
        }));
      usingAuthUserFallback = true;
    } catch (error) {
      console.error("[admin-dashboard] pending signup fallback failed", error);
    }
  }
  const recentPartners = (recentPartnersResult.data ?? []) as RecentPartner[];
  const recentRequests = (recentRequestsResult.data ??
    []) as RecentAvailabilityRequest[];
  const analytics = (analyticsSummaryResult.data?.[0] ??
    null) as AdminAnalyticsSummary | null;
  const topSearches = (topSearchesResult.data ?? []) as TopMedicineSearch[];
  const regions = (regionsResult.data ?? []) as RegionMetric[];

  const navigation = [
    {
      href: "/admin",
      label: "Dashboard",
      Icon: LayoutDashboard,
      visible: true,
    },
    {
      href: "/admin/users",
      label: "Users & roles",
      Icon: UsersRound,
      visible: canViewUsers,
    },
    {
      href: "/admin/partners",
      label: "Partners",
      Icon: Store,
      visible: canViewPartners,
    },
    {
      href: "/admin/medicines",
      label: "Medicine database",
      Icon: Pill,
      visible: canManageMedicines,
    },
    {
      href: "/admin/fulfillment",
      label: "Requests & inquiries",
      Icon: ClipboardList,
      visible: canViewFulfillment,
    },
    {
      href: "/admin/locations",
      label: "Network locations",
      Icon: MapPin,
      visible: canManageLocations,
    },
    {
      href: "/admin/content",
      label: "Content",
      Icon: FileText,
      visible: canManageContent,
    },
    {
      href: "/admin/promotions",
      label: "Promotions",
      Icon: Tag,
      visible: canManagePromotions,
    },
    {
      href: "/admin/billing",
      label: "Plans & payments",
      Icon: CreditCard,
      visible: canManageBilling,
    },
    {
      href: "/admin/analytics",
      label: "Reports & analytics",
      Icon: ChartColumn,
      visible: canViewReports,
    },
    {
      href: "/admin/support",
      label: "Support tickets",
      Icon: LifeBuoy,
      visible: canManageSupport,
    },
    {
      href: "/admin/team",
      label: "Team & roles",
      Icon: Settings,
      visible: canManageTeam,
    },
    {
      href: "/admin/security",
      label: "Security",
      Icon: ShieldCheck,
      visible: canManageSecurity,
    },
  ].filter((item) => item.visible);

  return (
    <main className="min-h-screen bg-[#f3f6fb] px-3 py-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-[1600px] xl:grid xl:grid-cols-[248px_minmax(0,1fr)] xl:gap-8">
        <aside className="mb-5 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm xl:sticky xl:top-6 xl:mb-0 xl:flex xl:h-[calc(100vh-3rem)] xl:flex-col">
          <div className="flex items-center justify-between gap-3 xl:block">
            <div>
              <Brand compact />
              <p className="ml-14 -mt-1 text-xs font-medium text-slate-500">
                Admin panel
              </p>
            </div>
            <Link
              href="/account"
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-teal-300 hover:text-teal-800 xl:hidden"
            >
              Account
            </Link>
          </div>
          <nav
            aria-label="Admin navigation"
            className="mt-4 flex gap-2 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible"
          >
            {navigation.map((item) => {
              const Icon = item.Icon;
              const active = item.href === "/admin";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "flex shrink-0 items-center gap-3 rounded-xl bg-emerald-700 px-3 py-3 text-sm font-semibold text-white shadow-sm"
                      : "flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-teal-800"
                  }
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto hidden rounded-2xl bg-gradient-to-br from-teal-800 to-emerald-600 p-4 text-white xl:block">
            <p className="text-sm font-semibold">Better healthcare together</p>
            <p className="mt-1 text-xs leading-5 text-white/80">
              DawaSetu network administration
            </p>
          </div>
        </aside>
        <div className="min-w-0">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm sm:px-6">
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-teal-800 uppercase">
                Network overview
              </p>
              <p className="mt-1 text-sm text-slate-500">
                DawaSetu administration workspace
              </p>
            </div>
            <nav className="flex flex-wrap gap-2">
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
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                Network administration
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Admin dashboard
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                A clear view of DawaSetu users, partners, and medicine access.
                Metrics come from current platform records.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <p className="font-semibold">
                India’s medicine availability network
              </p>
              <p className="mt-1 text-xs text-emerald-800/80">
                Admin workspace
              </p>
            </div>
          </div>
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
              className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3"
            >
              {metrics.map(({ label, value, Icon, tone, detail }) => (
                <Card
                  key={label}
                  className="overflow-hidden rounded-2xl border-slate-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <CardContent className="flex items-center justify-between gap-4 p-5">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        {label}
                      </p>
                      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                        {Number(value).toLocaleString("en-IN")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{detail}</p>
                    </div>
                    <span
                      className={`grid size-12 shrink-0 place-items-center rounded-2xl ${tone}`}
                    >
                      <Icon aria-hidden="true" className="size-6" />
                    </span>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}
          {(canViewUsers || canViewPartners || canViewFulfillment) && (
            <section className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {canViewUsers && (
                <Card className="rounded-2xl border-sky-100 bg-white shadow-sm">
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <CardTitle>Waiting for verification</CardTitle>
                        <p className="mt-1 text-sm text-slate-500">
                          New accounts that have not confirmed their email
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href="/admin/users?verification_status=pending">
                          View all
                        </Link>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {usingAuthUserFallback && (
                      <p className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                        Temporary Auth directory view. Apply the database
                        migration for the complete account directory.
                      </p>
                    )}
                    {pendingVerificationsResult.error &&
                    !usingAuthUserFallback ? (
                      <p role="alert" className="text-sm text-rose-800">
                        Pending accounts could not be loaded right now.
                      </p>
                    ) : pendingVerifications.length === 0 ? (
                      <EmptyState
                        title="No pending email verifications"
                        description="New registrations waiting to confirm their email will appear here."
                      />
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {pendingVerifications.map((pendingUser) => (
                          <div
                            key={pendingUser.user_id}
                            className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">
                                {pendingUser.full_name}
                              </p>
                              <p className="mt-1 break-all text-xs text-slate-500">
                                {pendingUser.email ?? "Email unavailable"} ·{" "}
                                {formatDate(pendingUser.created_at)}
                              </p>
                            </div>
                            <StatusBadge status="pending" />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
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
                            Math.round(
                              (medicine.search_count / maxCount) * 100,
                            ),
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
                                {Number(
                                  region.approved_partners,
                                ).toLocaleString("en-IN")}{" "}
                                partners
                              </span>
                              <span>
                                {Number(
                                  region.medicine_requests,
                                ).toLocaleString("en-IN")}{" "}
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
                    Find customer and partner accounts, review business links,
                    and manage account access with audited password
                    confirmation.
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
                    Review partner submissions, maintain the product catalog,
                    and control medicine visibility.
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
                    <Link href="/admin/redirect-websites">
                      Redirect websites
                    </Link>
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
                    Assign least-privilege platform roles and manage team
                    account access with password confirmation and audit records.
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
                    Configure INR plan prices, limits, trial periods and
                    included features with a reviewed change history.
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
      </div>
    </main>
  );
}
