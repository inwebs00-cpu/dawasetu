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

interface BusinessLocation {
  slug: string;
  address_line1: string;
  latitude: number | null;
  longitude: number | null;
  opening_hours: { schedule?: string } | null;
}

interface PartnerAnalyticsSummary {
  profile_views: number;
  medicine_searches: number;
  medicine_requests: number;
  confirmed_orders: number;
}

interface DistributorInquirySummary {
  inquiry_id: string;
  distributor_name: string;
  product_name: string;
  strength: string;
  requested_quantity: number;
  status: string;
  response_message: string | null;
  created_at: string;
}

interface NearbyBusiness {
  business_id: string;
  business_name: string;
  business_type: string;
  address_line1: string;
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;
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
    inventoryViewPermission,
    inventoryManagePermission,
    requestViewPermission,
    distributorAccessPermission,
    openInquiryCountResult,
    pendingOrderCountResult,
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
    supabase.rpc("has_business_permission", {
      p_business_id: businessId,
      p_permission_key: "inventory.view",
    }),
    supabase.rpc("has_business_permission", {
      p_business_id: businessId,
      p_permission_key: "inventory.manage",
    }),
    supabase.rpc("has_business_permission", {
      p_business_id: businessId,
      p_permission_key: "requests.view",
    }),
    supabase.rpc("has_business_permission", {
      p_business_id: businessId,
      p_permission_key: "distributors.view",
    }),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "open"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .in("status", ["inquiry", "pending_confirmation"]),
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

  const canViewInventory =
    inventoryViewPermission.data === true ||
    inventoryManagePermission.data === true;
  const canManageInventory = inventoryManagePermission.data === true;
  const canViewRequests = requestViewPermission.data === true;
  const canRequestDistributorAccess = distributorAccessPermission.data === true;
  const inventory =
    inventoryResult.error || !canViewInventory
      ? []
      : ((inventoryResult.data ?? []) as InventorySummary[]);
  const requests =
    requestResult.error || !canViewRequests
      ? []
      : ((requestResult.data ?? []) as PartnerRequestSummary[]);
  const availableCount = inventory.filter(
    (item) => item.inventory_status === "available",
  ).length;
  const lowStockCount = inventory.filter(
    (item) => item.inventory_status === "low_stock",
  ).length;
  const openRequests = requests.filter((request) => !request.response).length;
  const startOfToday = startOfTodayInIndia();

  const [
    locationResult,
    analyticsResult,
    todayInquiryResult,
    todayOrdersResult,
    distributorInquiriesResult,
  ] = await Promise.all([
    supabase
      .from("businesses")
      .select("slug, address_line1, latitude, longitude, opening_hours")
      .eq("id", businessId)
      .maybeSingle(),
    analyticsPermission.data === true
      ? supabase.rpc("list_my_business_analytics", {
          p_business_id: businessId,
          p_days: 30,
        })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", startOfToday),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .in("status", ["confirmed", "completed"])
      .gte("updated_at", startOfToday),
    canRequestDistributorAccess &&
    !business.business_type.toLowerCase().includes("distributor")
      ? supabase.rpc("list_my_partner_distributor_inquiries", {
          p_partner_business_id: businessId,
        })
      : Promise.resolve({ data: [], error: null }),
  ]);
  const location = locationResult.data as BusinessLocation | null;
  const analytics = (analyticsResult.data?.[0] ??
    null) as PartnerAnalyticsSummary | null;
  const distributorInquiries = (distributorInquiriesResult.data ??
    []) as DistributorInquirySummary[];
  const todayRequests = requests.filter(
    (request) =>
      new Date(request.request_time).getTime() >=
      new Date(startOfToday).getTime(),
  ).length;
  const stockAlerts = inventory
    .filter(
      (item) =>
        item.inventory_status === "low_stock" ||
        item.inventory_status === "out_of_stock",
    )
    .slice(0, 5);
  const nearbyBusinessResult =
    location?.latitude !== null &&
    location?.latitude !== undefined &&
    location.longitude !== null &&
    location.longitude !== undefined
      ? await supabase.rpc("list_public_businesses", {
          p_latitude: location.latitude,
          p_longitude: location.longitude,
          p_limit: 30,
        })
      : { data: [], error: null };
  const nearbyCareBusinesses = (
    (nearbyBusinessResult.data ?? []) as NearbyBusiness[]
  )
    .filter((item) => {
      const type = item.business_type.toLowerCase();
      return (
        item.business_id !== businessId &&
        (type.includes("clinic") ||
          type.includes("nursing home") ||
          type.includes("hospital"))
      );
    })
    .slice(0, 4);
  const mapsHref =
    location?.latitude !== null &&
    location?.latitude !== undefined &&
    location.longitude !== null &&
    location.longitude !== undefined
      ? `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.business_name} ${location?.address_line1 ?? ""}`)}`;

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
            {documentsPermission.data === true && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/partner/${businessId}/profile`}>
                  Store profile
                </Link>
              </Button>
            )}
            {canViewRequests && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/partner/${businessId}/orders`}>
                  Orders & inquiries
                </Link>
              </Button>
            )}
            {analyticsPermission.data === true && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/partner/${businessId}/analytics`}>Analytics</Link>
              </Button>
            )}
            {canRequestDistributorAccess &&
              !business.business_type.toLowerCase().includes("distributor") && (
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
            ...(canViewInventory
              ? [
                  [
                    "Inventory items",
                    inventoryResult.error ? "—" : inventory.length,
                  ],
                  ["Available", inventoryResult.error ? "—" : availableCount],
                  ["Low stock", inventoryResult.error ? "—" : lowStockCount],
                  [
                    "Stock alerts",
                    inventoryResult.error
                      ? "—"
                      : inventory.filter(
                          (item) =>
                            item.inventory_status === "low_stock" ||
                            item.inventory_status === "out_of_stock",
                        ).length,
                  ],
                ]
              : []),
            ...(canViewRequests
              ? [
                  ["Nearby requests", requestResult.error ? "—" : openRequests],
                  [
                    "Open inquiries",
                    openInquiryCountResult.error
                      ? "—"
                      : (openInquiryCountResult.count ?? 0),
                  ],
                  [
                    "Orders to confirm",
                    pendingOrderCountResult.error
                      ? "—"
                      : (pendingOrderCountResult.count ?? 0),
                  ],
                  [
                    "Today’s inquiries",
                    todayInquiryResult.error
                      ? "—"
                      : (todayInquiryResult.count ?? 0),
                  ],
                  [
                    "Today’s confirmed orders",
                    todayOrdersResult.error
                      ? "—"
                      : (todayOrdersResult.count ?? 0),
                  ],
                ]
              : []),
          ].map(([label, count]) => (
            <Card key={label}>
              <CardContent className="p-5">
                <p className="text-sm text-slate-600">{label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  {typeof count === "number"
                    ? count.toLocaleString("en-IN")
                    : count}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Store availability</CardTitle>
                  <p className="mt-1 text-sm text-slate-600">
                    Your public listing and visiting details.
                  </p>
                </div>
                <StatusBadge
                  status={
                    business.business_status !== "approved"
                      ? business.business_status
                      : business.public_availability_enabled
                        ? "Public availability on"
                        : "Public availability off"
                  }
                />
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Opening hours
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-800">
                  {location?.opening_hours?.schedule ||
                    "Add your store hours in the profile."}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Store location
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-800">
                  {location?.address_line1 || "Add an address in the profile."}
                </p>
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-sm font-semibold text-teal-800 underline underline-offset-4"
                >
                  Open directions
                </a>
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                {documentsPermission.data === true && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/partner/${businessId}/profile`}>
                      Edit store profile
                    </Link>
                  </Button>
                )}
                {canManageInventory && (
                  <Button asChild size="sm">
                    <Link href={`/partner/${businessId}/inventory`}>
                      Update availability
                    </Link>
                  </Button>
                )}
                {business.business_status === "approved" && location?.slug && (
                  <Button asChild variant="ghost" size="sm">
                    <Link
                      href={`/pharmacies/${encodeURIComponent(location.slug)}`}
                    >
                      View public profile
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {analyticsPermission.data === true && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>Store performance</CardTitle>
                    <p className="mt-1 text-sm text-slate-600">Last 30 days</p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/partner/${businessId}/analytics`}>
                      Full reports
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {analyticsResult.error || !analytics ? (
                  <p role="alert" className="text-sm text-rose-800">
                    Performance data is temporarily unavailable.
                  </p>
                ) : (
                  <dl className="grid grid-cols-2 gap-3">
                    {[
                      ["Store views", analytics.profile_views],
                      ["Medicine searches", analytics.medicine_searches],
                      ["Requests received", analytics.medicine_requests],
                      ["Confirmed orders", analytics.confirmed_orders],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-slate-50 p-3">
                        <dt className="text-xs text-slate-600">{label}</dt>
                        <dd className="mt-1 text-xl font-semibold text-slate-950">
                          {Number(value).toLocaleString("en-IN")}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </CardContent>
            </Card>
          )}
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Inventory alerts</CardTitle>
                  <p className="mt-1 text-sm text-slate-600">
                    Low and out-of-stock reports need an availability update.
                  </p>
                </div>
                {canManageInventory && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/partner/${businessId}/inventory`}>
                      Review stock
                    </Link>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {inventoryResult.error && canViewInventory ? (
                <p role="alert" className="text-sm text-rose-800">
                  Inventory alerts are temporarily unavailable.
                </p>
              ) : !canViewInventory ? (
                <p className="text-sm text-slate-600">
                  Inventory access has not been assigned to this account.
                </p>
              ) : stockAlerts.length === 0 ? (
                <EmptyState
                  title="No stock alerts"
                  description="There are no low or out-of-stock items in the latest inventory report."
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {stockAlerts.map((item) => (
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
                      <StatusBadge status={item.inventory_status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Nearby clinics and hospitals</CardTitle>
                  <p className="mt-1 text-sm text-slate-600">
                    Approved public partners with medicine availability near
                    your mapped location.
                  </p>
                </div>
                {location?.latitude !== null &&
                  location?.latitude !== undefined && (
                    <Button asChild variant="outline" size="sm">
                      <a href={mapsHref} target="_blank" rel="noreferrer">
                        Open map
                      </a>
                    </Button>
                  )}
              </div>
            </CardHeader>
            <CardContent>
              {nearbyBusinessResult.error ? (
                <p role="alert" className="text-sm text-rose-800">
                  Nearby partner information is temporarily unavailable.
                </p>
              ) : location?.latitude === null ||
                location?.latitude === undefined ||
                location.longitude === null ||
                location.longitude === undefined ? (
                <EmptyState
                  title="Map your store to see nearby partners"
                  description="Add both coordinates to your store profile to discover nearby clinics, hospitals, and nursing homes."
                />
              ) : nearbyCareBusinesses.length === 0 ? (
                <EmptyState
                  title="No nearby care partners listed yet"
                  description="Approved public clinics, hospitals, and nursing homes will appear here when they are in the medicine availability network."
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {nearbyCareBusinesses.map((item) => (
                    <div
                      key={item.business_id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {item.business_name}
                        </p>
                        <p className="text-sm text-slate-600">
                          {item.business_type} · {item.address_line1}
                        </p>
                      </div>
                      <span className="text-sm text-slate-600">
                        {item.distance_km === null
                          ? "Distance unavailable"
                          : `${Number(item.distance_km).toFixed(1)} km`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Inventory overview</CardTitle>
                {canManageInventory && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/partner/${businessId}/inventory`}>
                      Manage inventory
                    </Link>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {inventoryResult.error && canViewInventory ? (
                <p
                  role="alert"
                  className="rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
                >
                  Inventory is temporarily unavailable.
                </p>
              ) : !canViewInventory ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  Inventory access has not been assigned to this account.
                </p>
              ) : inventory.length === 0 ? (
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
                {canViewRequests && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/partner/${businessId}/requests`}>
                      View requests
                    </Link>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {requestResult.error && canViewRequests ? (
                <p
                  role="alert"
                  className="rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
                >
                  Requests are temporarily unavailable.
                </p>
              ) : !canViewRequests ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  Request access has not been assigned to this account.
                </p>
              ) : requests.length === 0 ? (
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

        {canRequestDistributorAccess &&
          !business.business_type.toLowerCase().includes("distributor") && (
            <Card className="mt-4">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>Distributor inquiries</CardTitle>
                    <p className="mt-1 text-sm text-slate-600">
                      Private stock questions sent to authorized distributors.
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/partner/${businessId}/distributors`}>
                      Open distributor network
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {distributorInquiriesResult.error ? (
                  <p role="alert" className="text-sm text-rose-800">
                    Distributor inquiries are temporarily unavailable.
                  </p>
                ) : distributorInquiries.length === 0 ? (
                  <EmptyState
                    title="No stock inquiries sent"
                    description="Once distributor access is approved, send a private inquiry from a medicine availability result."
                  />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {distributorInquiries.slice(0, 5).map((inquiry) => (
                      <div
                        key={inquiry.inquiry_id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"
                      >
                        <div>
                          <p className="font-medium text-slate-900">
                            {inquiry.product_name} · {inquiry.strength}
                          </p>
                          <p className="text-sm text-slate-600">
                            {inquiry.distributor_name} · Quantity{" "}
                            {Number(inquiry.requested_quantity).toLocaleString(
                              "en-IN",
                            )}
                          </p>
                          {inquiry.response_message && (
                            <p className="mt-1 text-sm text-teal-900">
                              {inquiry.response_message}
                            </p>
                          )}
                        </div>
                        <StatusBadge status={inquiry.status} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ...(documentsPermission.data === true
              ? [
                  [
                    "Store profile",
                    "Update contact, address, hours and visibility.",
                    "profile",
                  ],
                ]
              : []),
            ...(canManageInventory
              ? [
                  [
                    "Manage inventory",
                    "Add approved medicines and update reported stock.",
                    "inventory",
                  ],
                ]
              : []),
            ...(canViewRequests
              ? [
                  [
                    "Nearby requests",
                    `${todayRequests} new today · review active requests in your mapped area.`,
                    "requests",
                  ],
                ]
              : []),
            ...(canViewRequests
              ? [
                  [
                    "Orders and inquiries",
                    "Review customer messages and partner-confirmation records.",
                    "orders",
                  ],
                ]
              : []),
            ...(canRequestDistributorAccess &&
            !business.business_type.toLowerCase().includes("distributor")
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

function startOfTodayInIndia() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: "year" | "month" | "day") =>
    parts.find((item) => item.type === type)?.value ?? "";
  return new Date(
    `${part("year")}-${part("month")}-${part("day")}T00:00:00+05:30`,
  ).toISOString();
}
