import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireBusinessPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Distributor dashboard" };

type PageParams = Promise<{ businessId: string }>;

interface DistributorBusiness {
  business_id: string;
  business_name: string;
  business_type: string;
  business_status: string;
}

interface InventoryItem {
  inventory_id: string;
  product_name: string;
  strength: string;
  inventory_status: string;
  last_updated_at: string;
}

interface AccessRequest {
  access_id: string;
  partner_business_id: string;
  partner_name: string;
  partner_area: string | null;
  partner_type: string;
  status: string;
  requested_at: string;
}

interface DistributorInquiry {
  inquiry_id: string;
  partner_name: string;
  partner_type: string;
  partner_area: string | null;
  product_name: string;
  strength: string;
  requested_quantity: number;
  status: string;
  created_at: string;
}

interface BusinessProfileSummary {
  address_line1: string;
  phone_e164: string;
  postal_code: string | null;
  updated_at: string;
}

export default async function DistributorDashboardPage({
  params,
}: {
  params: PageParams;
}) {
  const { businessId } = await params;
  const { supabase } = await requireBusinessPermission(
    businessId,
    "distributors.access.manage",
  );
  const [
    { data: businesses },
    { data: accessRequests, error },
    { data: canManageBilling },
    { data: canViewInventory },
    { data: canManageInventory },
    { data: canManageProfile },
  ] = await Promise.all([
    supabase.rpc("list_my_businesses"),
    supabase.rpc("list_distributor_access_requests", {
      p_distributor_business_id: businessId,
    }),
    supabase.rpc("has_business_permission", {
      p_business_id: businessId,
      p_permission_key: "payments.manage",
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
      p_permission_key: "partners.manage",
    }),
  ]);
  const business = ((businesses ?? []) as DistributorBusiness[]).find(
    (item) => item.business_id === businessId,
  );
  if (!business)
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title="Distributor access unavailable"
            description="This business is not in your active permissions."
          />
        </div>
      </main>
    );
  const pendingCount = ((accessRequests ?? []) as { status: string }[]).filter(
    (item) => item.status === "pending",
  ).length;
  const accessRequestRows = (accessRequests ?? []) as AccessRequest[];
  const inventoryPermission =
    canViewInventory === true || canManageInventory === true;
  const inventoryResult = inventoryPermission
    ? await supabase.rpc("list_business_inventory", {
        p_business_id: businessId,
      })
    : { data: [], error: null };
  const inventory = (inventoryResult.data ?? []) as InventoryItem[];
  const [inquiriesResult, profileResult] = await Promise.all([
    supabase.rpc("list_my_distributor_inquiries", {
      p_distributor_business_id: businessId,
      p_status: null,
    }),
    canManageProfile === true
      ? supabase
          .from("businesses")
          .select("address_line1, phone_e164, postal_code, updated_at")
          .eq("id", businessId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const inquiries = (inquiriesResult.data ?? []) as DistributorInquiry[];
  const profile = profileResult.data as BusinessProfileSummary | null;
  const availableCount = inventory.filter(
    (item) => item.inventory_status === "available",
  ).length;
  const lowStockCount = inventory.filter(
    (item) => item.inventory_status === "low_stock",
  ).length;
  const outOfStockCount = inventory.filter(
    (item) => item.inventory_status === "out_of_stock",
  ).length;
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <div className="flex gap-2">
            {canManageBilling === true && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/partner/${businessId}/billing`}>Billing</Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link href="/partner">Businesses</Link>
            </Button>
          </div>
        </header>
        <section className="rounded-3xl bg-[linear-gradient(120deg,_#0f5557_0%,_#13876e_100%)] p-6 text-white sm:p-9">
          <p className="text-sm font-medium text-teal-50">
            Distributor / stockist
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {business.business_name}
          </h1>
          <p className="mt-2 text-sm text-teal-50">
            Your inventory is visible only to authorized, verified partner
            businesses.
          </p>
        </section>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Distributor access requests are temporarily unavailable.
          </p>
        )}
        {inquiriesResult.error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Partner stock inquiries are temporarily unavailable.
          </p>
        )}
        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Partner access requests", error ? "—" : pendingCount],
            [
              "Open stock inquiries",
              inquiriesResult.error
                ? "—"
                : inquiries.filter((item) => item.status === "open").length,
            ],
            [
              "Inventory items",
              !inventoryPermission || inventoryResult.error
                ? "—"
                : inventory.length,
            ],
            [
              "Available",
              !inventoryPermission || inventoryResult.error
                ? "—"
                : availableCount,
            ],
            [
              "Low or out of stock",
              !inventoryPermission || inventoryResult.error
                ? "—"
                : lowStockCount + outOfStockCount,
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
        <section className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Partner access requests</CardTitle>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/distributor/${businessId}/access`}>
                    Manage access
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {error ? (
                <p className="text-sm text-slate-600">
                  Partner access requests could not be loaded.
                </p>
              ) : accessRequestRows.filter((item) => item.status === "pending")
                  .length === 0 ? (
                <EmptyState
                  title="No pending partner approvals"
                  description="New verified pharmacy, clinic, and nursing-home access requests will appear here."
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {accessRequestRows
                    .filter((item) => item.status === "pending")
                    .slice(0, 5)
                    .map((item) => (
                      <div
                        key={item.access_id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"
                      >
                        <div>
                          <p className="font-medium text-slate-900">
                            {item.partner_name}
                          </p>
                          <p className="text-sm text-slate-600">
                            {item.partner_type}
                            {item.partner_area ? ` · ${item.partner_area}` : ""}
                          </p>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Distributor inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-slate-600">
                Add medicines and update partner-reported stock. Distributor
                inventory never appears in public search.
              </p>
              {canManageInventory === true && (
                <Button asChild variant="outline" className="mt-4">
                  <Link href={`/partner/${businessId}/inventory`}>
                    Manage stock
                  </Link>
                </Button>
              )}
              {inventoryPermission &&
                !inventoryResult.error &&
                inventory.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full bg-emerald-50 px-3 py-1">
                      {availableCount} available
                    </span>
                    <span className="rounded-full bg-amber-50 px-3 py-1">
                      {lowStockCount} low stock
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      {outOfStockCount} out of stock
                    </span>
                  </div>
                )}
            </CardContent>
          </Card>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Partner stock inquiries</CardTitle>
                  <p className="mt-1 text-sm text-slate-600">
                    Private availability questions from approved network
                    partners.
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/distributor/${businessId}/inquiries`}>
                    All inquiries
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {inquiriesResult.error ? (
                <p className="text-sm text-slate-600">
                  Partner inquiries could not be loaded.
                </p>
              ) : inquiries.filter((item) => item.status === "open").length ===
                0 ? (
                <EmptyState
                  title="No open stock inquiries"
                  description="Partners can ask about available inventory after distributor access is approved."
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {inquiries
                    .filter((item) => item.status === "open")
                    .slice(0, 5)
                    .map((item) => (
                      <div
                        key={item.inquiry_id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"
                      >
                        <div>
                          <p className="font-medium text-slate-900">
                            {item.product_name} · {item.strength}
                          </p>
                          <p className="text-sm text-slate-600">
                            {item.partner_name} · {item.partner_type} · Qty{" "}
                            {Number(item.requested_quantity).toLocaleString(
                              "en-IN",
                            )}
                          </p>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Business information</CardTitle>
                {canManageProfile === true && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/partner/${businessId}/profile`}>
                      Edit profile
                    </Link>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {profileResult.error ? (
                <p role="alert" className="text-sm text-rose-800">
                  Business information is temporarily unavailable.
                </p>
              ) : !profile ? (
                <p className="text-sm text-slate-600">
                  Profile access has not been assigned to this account.
                </p>
              ) : (
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Address</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {profile.address_line1}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Business phone</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {profile.phone_e164}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">PIN code</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {profile.postal_code ?? "Not listed"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Profile updated</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {new Date(profile.updated_at).toLocaleDateString(
                        "en-IN",
                        { dateStyle: "medium", timeZone: "Asia/Kolkata" },
                      )}
                    </dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>
        </section>

        {inventoryPermission && !inventoryResult.error && (
          <Card className="mt-4">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Recent distributor stock</CardTitle>
                  <p className="mt-1 text-sm text-slate-600">
                    The availability shown here is B2B-only.
                  </p>
                </div>
                {canManageInventory === true && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/partner/${businessId}/inventory`}>
                      Update stock
                    </Link>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {inventory.length === 0 ? (
                <EmptyState
                  title="No inventory has been reported"
                  description="Add approved medicines in the inventory workspace to serve authorized partners."
                />
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
                          {item.strength} · Updated{" "}
                          {new Date(item.last_updated_at).toLocaleString(
                            "en-IN",
                            {
                              dateStyle: "medium",
                              timeStyle: "short",
                              timeZone: "Asia/Kolkata",
                            },
                          )}
                        </p>
                      </div>
                      <StatusBadge status={item.inventory_status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
