import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        </section>
      </div>
    </main>
  );
}
