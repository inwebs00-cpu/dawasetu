import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import {
  InventoryBulkUpload,
  MedicineMasterSearch,
  SubmitMedicineForm,
  UpdateInventoryForm,
} from "@/components/partner/inventory-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireBusinessPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Manage partner inventory" };

type PageParams = Promise<{ businessId: string }>;

interface BusinessSummary {
  business_id: string;
  business_name: string;
  business_type: string;
  business_status: string;
}

interface InventoryRow {
  inventory_id: string;
  medicine_id: string;
  product_name: string;
  brand_name: string | null;
  composition: string | null;
  strength: string;
  manufacturer_name: string | null;
  medicine_status: string;
  inventory_status: string;
  quantity: number | null;
  public_visible: boolean;
  last_updated_at: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

export default async function PartnerInventoryPage({
  params,
}: {
  params: PageParams;
}) {
  const { businessId } = await params;
  const { supabase } = await requireBusinessPermission(
    businessId,
    "inventory.manage",
  );
  const [businessesResult, inventoryResult, categoriesResult] =
    await Promise.all([
      supabase.rpc("list_my_businesses"),
      supabase.rpc("list_business_inventory", { p_business_id: businessId }),
      supabase
        .from("categories")
        .select("id, name")
        .eq("is_active", true)
        .order("display_order"),
    ]);
  const businesses = (businessesResult.data ?? []) as BusinessSummary[];
  const business = businesses.find((item) => item.business_id === businessId);
  if (!business) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title="Business access is unavailable"
            description="This business is not in your active permissions."
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

  const inventory = (inventoryResult.data ?? []) as InventoryRow[];
  const categories = (categoriesResult.data ?? []) as CategoryOption[];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/partner/${businessId}`}>Dashboard</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/partner">Businesses</Link>
            </Button>
          </nav>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          {business.business_name}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Manage inventory
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Record partner-reported stock. Items remain in your inventory when
          they go out of stock. Public listing requires an approved business, an
          approved medicine, business-level visibility, and medicine-level
          visibility.
        </p>
        {business.business_status === "pending" && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            Your business is pending review. You can prepare inventory, but it
            will not be public until approval.
          </p>
        )}

        <div className="mt-7 grid gap-5">
          {[
            "Retail Pharmacy",
            "Clinic Pharmacy",
            "Nursing Home Pharmacy",
          ].includes(business.business_type) && (
            <InventoryBulkUpload businessId={businessId} />
          )}
          <MedicineMasterSearch businessId={businessId} />
          <SubmitMedicineForm businessId={businessId} categories={categories} />
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-teal-800">
                  Your business records
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                  Current inventory
                </h2>
              </div>
              <p className="text-sm text-slate-600">
                {inventory.length} item{inventory.length === 1 ? "" : "s"}
              </p>
            </div>
            {inventory.length === 0 ? (
              <EmptyState
                title="No inventory items yet"
                description="Search the approved medicine master or submit a new medicine for admin verification."
              />
            ) : (
              <div className="grid gap-4">
                {inventory.map((item) => (
                  <Card key={item.inventory_id}>
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle>{item.product_name}</CardTitle>
                          <p className="mt-1 text-sm text-slate-600">
                            {item.brand_name ? `${item.brand_name} · ` : ""}
                            {item.strength}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge
                            status={
                              item.medicine_status === "approved"
                                ? item.inventory_status
                                : "Pending verification"
                            }
                          />
                          <StatusBadge
                            status={
                              item.public_visible
                                ? "Public visibility on"
                                : "Private"
                            }
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {item.composition && (
                        <p className="text-sm text-slate-600">
                          Composition: {item.composition}
                          {item.manufacturer_name
                            ? ` · ${item.manufacturer_name}`
                            : ""}
                        </p>
                      )}
                      {item.medicine_status === "approved" ? (
                        <UpdateInventoryForm
                          businessId={businessId}
                          item={item}
                        />
                      ) : (
                        <p className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                          This medicine is pending or rejected by admin.
                          Availability cannot be published until an approved
                          medicine record exists.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
