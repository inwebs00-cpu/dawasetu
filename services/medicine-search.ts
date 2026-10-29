import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordPublicMedicineSearch } from "@/services/analytics-events";

export interface PublicMedicineSearchRow {
  medicine_id: string;
  product_name: string;
  brand_name: string | null;
  composition: string | null;
  strength: string;
  manufacturer_name: string | null;
  medicine_type: string;
  prescription_class: string;
  business_id: string;
  business_name: string;
  business_type: string;
  business_slug: string;
  address_line1: string;
  address_line2: string | null;
  postal_code: string | null;
  phone_e164: string;
  whatsapp_e164: string | null;
  latitude: number | null;
  longitude: number | null;
  inventory_status: "available" | "low_stock";
  last_updated_at: string;
  distance_km: number | null;
}

export interface PublicMedicineCatalogRow {
  medicine_id: string;
  product_name: string;
  brand_name: string | null;
  composition: string | null;
  strength: string;
  manufacturer_name: string | null;
  medicine_type: string;
  prescription_class: string;
}

export interface MedicineCategory {
  slug: string;
  name: string;
}

export interface SameCompositionMedicine {
  reference_medicine_id: string;
  reference_product_name: string;
  reference_strength: string;
  reference_composition: string;
  reference_prescription_class: "prescription" | "otc" | "unknown";
  alternative_medicine_id: string | null;
  alternative_product_name: string | null;
  alternative_brand_name: string | null;
  alternative_strength: string | null;
  alternative_composition: string | null;
  alternative_manufacturer: string | null;
}

export type SearchResult =
  | {
      status: "ready";
      rows: PublicMedicineSearchRow[];
      catalogRows?: PublicMedicineCatalogRow[];
      availabilityUnavailable?: boolean;
    }
  | { status: "unconfigured" }
  | { status: "error" };

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export async function getMedicineCategories(): Promise<MedicineCategory[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createSupabaseServerClient();
    const result = await supabase
      .from("categories")
      .select("slug, name")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    if (result.error) return [];
    return (result.data ?? []) as MedicineCategory[];
  } catch {
    return [];
  }
}

export async function searchPublicMedicines(
  query: string,
  options: {
    latitude?: number | null;
    longitude?: number | null;
    categorySlug?: string | null;
  } = {},
): Promise<SearchResult> {
  const normalizedQuery = query.trim();
  const categorySlug = options.categorySlug ?? null;
  const latitude = options.latitude ?? null;
  const longitude = options.longitude ?? null;
  const hasValidCoordinates =
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;
  if (
    normalizedQuery.length > 120 ||
    (!categorySlug && normalizedQuery.length < 2 && !hasValidCoordinates) ||
    (categorySlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(categorySlug))
  ) {
    return { status: "ready", rows: [] };
  }
  if (!isSupabaseConfigured()) return { status: "unconfigured" };

  try {
    const supabase = await createSupabaseServerClient();
    const rpcClient = supabase as unknown as {
      rpc: (
        functionName: string,
        parameters: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>;
    };
    const { data, error } = await rpcClient.rpc("search_public_medicine", {
      p_query: normalizedQuery,
      p_latitude: hasValidCoordinates ? latitude : null,
      p_longitude: hasValidCoordinates ? longitude : null,
      p_limit: 30,
      p_category_slug: categorySlug,
    });
    const availabilityUnavailable = Boolean(error || !Array.isArray(data));
    const rows = availabilityUnavailable
      ? []
      : (data as PublicMedicineSearchRow[]);
    if (!availabilityUnavailable && normalizedQuery.length >= 2) {
      await recordPublicMedicineSearch(rows.map((row) => row.medicine_id));
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await supabase.rpc("record_my_medicine_search", {
            p_query: normalizedQuery,
          });
        }
      } catch {
        // Recent-search history is optional and must not block availability results.
      }
    }
    let catalogRows: PublicMedicineCatalogRow[] = [];
    if (
      (availabilityUnavailable || rows.length === 0) &&
      (normalizedQuery.length >= 2 || categorySlug !== null)
    ) {
      const { data: catalogData, error: catalogError } = await rpcClient.rpc(
        "search_public_medicine_catalog",
        {
          p_query: normalizedQuery,
          p_limit: 30,
          p_category_slug: categorySlug,
        },
      );
      if (catalogError || !Array.isArray(catalogData)) {
        if (availabilityUnavailable) return { status: "error" };
      } else {
        catalogRows = catalogData as PublicMedicineCatalogRow[];
      }
    }
    return { status: "ready", rows, catalogRows, availabilityUnavailable };
  } catch {
    return { status: "error" };
  }
}

export async function getPublicSameCompositionMedicines(
  medicineId: string,
): Promise<
  | { status: "ready"; rows: SameCompositionMedicine[] }
  | { status: "unconfigured" | "error" }
> {
  if (!/^[0-9a-f-]{36}$/i.test(medicineId)) {
    return { status: "ready", rows: [] };
  }
  if (!isSupabaseConfigured()) return { status: "unconfigured" };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "list_public_same_composition_medicines",
      { p_medicine_id: medicineId },
    );
    if (error || !Array.isArray(data)) return { status: "error" };
    return { status: "ready", rows: data as SameCompositionMedicine[] };
  } catch {
    return { status: "error" };
  }
}
