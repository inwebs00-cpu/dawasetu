import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireBusinessPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Partner dashboard" };

type PageParams = Promise<{ businessId: string }>;

interface BusinessSummary {
  business_id: string;
  business_name: string;
  business_type: string;
  business_status: string;
  public_availability_enabled: boolean;
}

interface InventorySummary {
  inventory_id: string;
  medicine_id: string;
  product_name: string;
  strength: string;
  medicine_status: string;
  inventory_status: string;
  quantity: number | null;
  public_visible: boolean;
  last_updated_at: string;
}

interface PartnerRequestSummary {
  request_id: string;
  requested_medicine_name: string;
  quantity: number;
  approximate_area: string;
  request_time: string;
  response: string | null;
}

export default async function PartnerDashboardPage({
  params,
}: {
  params: PageParams;
}) {
  const { businessId } = await params;
  const { supabase } = await requireBusinessPermission(
    businessId,
    "dashboard.view",
  );
  const [
    businessResult,
    inventoryResult,
    requestResult,
    billingPermission,
    promotionsPermission,
    documentsPermission,
    analyticsPermission,
  ] = await Promise.all([
    supabase.rpc("list_my_businesses"),
    supabase.rpc("list_business_inventory", { p_business_id: businessId }),
    supabase.rpc("list_business_medicine_requests", {
      p_business_id: businessId,
    }),
    supabase.rpc("has_business_permission", {
      p_business_id: businessId,
      p_permission_key: "payments.manage",
    }),
    supabase.rpc("has_business_permission", {
      p_business_id: businessId,
      p_permission_key: "promotions.manage",
    }),
    supabase.rpc("has_business_permission", {
      p_business_id: businessId,
      p_permission_key: "partners.manage",
    }),
    supabase.rpc("has_business_permission", {
      p_business_id: businessId,
      p_permission_key: "reports.view",
    }),
  ]);
  const businesses = (businessResult.data ?? []) as BusinessSummary[];
  const business = businesses.find((item) => item.business_id === businessId);
  if (!business) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title="Business not available"
            description="This business is no longer linked to your active account permissions."
          />
          <div className="mt-5 text-center">
            <Button asChild variant="outline">
              <Link href="/partner">Your businesses</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const inventory = inventoryResult.error
    ? []
    : ((inventoryResult.data ?? []) as InventorySummary[]);
  const requests = requestResult.error
    ? []
    : ((requestResult.data ?? []) as PartnerRequestSummary[]);
  const availableCount = inventory.filter(
    (item) => item.inventory_status === "available",
  ).length;
  const lowStockCount = inventory.filter(
    (item) => item.inventory_status === "low_stock",
  ).length;
  const openRequests = requests.filter((request) => !request.response).length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <nav className="flex flex-wrap items-center gap-2">
            {billingPermission.data === true && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/partner/${businessId}/billing`}>Billing</Link>
              </Button>
            )}
            {promotionsPermission.data === true &&
              !business.business_type.toLowerCase().includes("distributor") && (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/partner/${businessId}/promotions`}>
                    Promotions
                  </Link>
                </Button>
              )}
            {documentsPermission.data === true && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/partner/${businessId}/documents`}>Documents</Link>
              </Button>
            )}
            {analyticsPermission.data === true && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/partner/${businessId}/analytics`}>Analytics</Link>
              </Button>
            )}
            {!business.business_type.toLowerCase().includes("distributor") && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/partner/${businessId}/distributors`}>
                  Stockists
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link href="/partner">Businesses</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/account">Account</Link>
            </Button>
          </nav>
        </header>
        <section className="rounded-3xl bg-[linear-gradient(120deg,_#0f5557_0%,_#13876e_100%)] p-6 text-white shadow-sm sm:p-9">
          <p className="text-sm font-medium text-teal-50">Partner dashboard</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {business.business_name}
              </h1>
              <p className="mt-2 text-sm text-teal-50">
                {business.business_type}
              </p>
            </div>
            <StatusBadge status={business.business_status} />
          </div>
          {business.business_status === "pending" && (
            <p className="mt-5 rounded-xl border border-white/20 bg-white/10 p-3 text-sm leading-6 text-teal-50">
              This business is under review. Its inventory is private until an
              administrator approves the listing.
            </p>
          )}
        </section>

        <section
          aria-label="Current partner metrics"
          className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {[
            ["Inventory items", inventory.length],
            ["Available", availableCount],
            ["Low stock", lowStockCount],
            ["Nearby requests", openRequests],
          ].map(([label, count]) => (
            <Card key={label}>
              <CardContent className="p-5">
                <p className="text-sm text-slate-600">{label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  {count}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Inventory overview</CardTitle>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/partner/${businessId}/inventory`}>
                    Manage inventory
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {inventory.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  No inventory has been added. Search the approved medicine
                  master to add products.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {inventory.slice(0, 6).map((item) => (
                    <div
                      key={item.inventory_id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {item.product_name}
                        </p>
                        <p className="text-sm text-slate-600">
                          {item.strength}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge
                          status={
                            item.medicine_status === "approved"
                              ? item.inventory_status
                              : "Pending verification"
                          }
                        />
                        {!item.public_visible && (
                          <span className="text-xs text-slate-500">
                            Private
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Medicine requests nearby</CardTitle>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/partner/${businessId}/requests`}>
                    View requests
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  No unexpired requests are currently matched to your mapped
                  area.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {requests.slice(0, 5).map((request) => (
                    <div key={request.request_id} className="py-3 first:pt-0">
                      <p className="font-medium text-slate-900">
                        {request.requested_medicine_name}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Quantity {request.quantity} · {request.approximate_area}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            [
              "Store profile",
              "Update contact, address, hours and visibility.",
              "profile",
            ],
            [
              "Manage inventory",
              "Add approved medicines and update reported stock.",
              "inventory",
            ],
            [
              "Nearby requests",
              "Respond to active requests in your mapped area.",
              "requests",
            ],
            ...(!business.business_type.toLowerCase().includes("distributor")
              ? [
                  [
                    "Distributors",
                    "Access verified B2B stock after approval.",
                    "distributors",
                  ],
                ]
              : []),
            ...(promotionsPermission.data === true &&
            !business.business_type.toLowerCase().includes("distributor")
              ? [
                  [
                    "Promotions",
                    "Request a featured listing or submit an offer for review.",
                    "promotions",
                  ],
                ]
              : []),
            ...(documentsPermission.data === true
              ? [
                  [
                    "Verification documents",
                    "Upload and track private partner verification files.",
                    "documents",
                  ],
                ]
              : []),
            ...(analyticsPermission.data === true
              ? [
                  [
                    "Analytics and reports",
                    "Review real profile views, searches, requests, inquiries and orders.",
                    "analytics",
                  ],
                ]
              : []),
          ].map(([title, description, path]) => (
            <Card key={path}>
              <CardContent className="p-5">
                <h2 className="font-semibold text-slate-950">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {description}
                </p>
                <Button asChild variant="ghost" size="sm" className="mt-3 px-0">
                  <Link href={`/partner/${businessId}/${path}`}>
                    Open section
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
