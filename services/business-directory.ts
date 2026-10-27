import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/services/medicine-search";

export interface PublicBusinessRow {
  business_id: string;
  business_name: string;
  business_slug: string;
  business_type: string;
  address_line1: string;
  address_line2: string | null;
  postal_code: string | null;
  phone_e164: string;
  whatsapp_e164: string | null;
  latitude: number | null;
  longitude: number | null;
  last_updated_at: string;
  distance_km: number | null;
}

export interface PublicBusinessProfile extends Omit<
  PublicBusinessRow,
  "last_updated_at" | "distance_km"
> {
  description: string | null;
  opening_hours: Record<string, unknown>;
  google_business_url: string | null;
}

export interface PublicBusinessMedicine {
  medicine_id: string;
  product_name: string;
  brand_name: string | null;
  composition: string | null;
  strength: string;
  manufacturer_name: string | null;
  inventory_status: "available" | "low_stock";
  last_updated_at: string;
}

export interface PublicBusinessPromotion {
  promotion_id: string;
  title: string;
  description: string | null;
  promotion_type: "offer" | "featured_listing" | "sponsored_listing";
  starts_at: string | null;
  ends_at: string | null;
}

export interface PublicBusinessReview {
  review_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
}

export interface MyBusinessReview {
  review_id: string;
  rating: number;
  review_text: string | null;
  status: string;
  updated_at: string;
}

export type DirectoryResult =
  | { status: "ready"; rows: PublicBusinessRow[] }
  | { status: "unconfigured" }
  | { status: "error" };

async function invokeRpc<T>(
  name: string,
  parameters: Record<string, unknown>,
): Promise<{ data: T | null; error: unknown }> {
  const supabase = await createSupabaseServerClient();
  const client = supabase as unknown as {
    rpc: (
      functionName: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await client.rpc(name, parameters);
  return { data: data as T | null, error };
}

export async function listPublicBusinesses(
  limit = 30,
  location?: { latitude: number; longitude: number },
): Promise<DirectoryResult> {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };
  const latitude = location?.latitude;
  const longitude = location?.longitude;
  const validCoordinates =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;
  try {
    const { data, error } = await invokeRpc<PublicBusinessRow[]>(
      "list_public_businesses",
      {
        p_latitude: validCoordinates ? latitude : null,
        p_longitude: validCoordinates ? longitude : null,
        p_limit: Math.max(1, Math.min(30, Math.trunc(limit))),
      },
    );
    if (error || !Array.isArray(data)) return { status: "error" };
    return { status: "ready", rows: data };
  } catch {
    return { status: "error" };
  }
}

export async function getPublicBusinessProfile(slug: string): Promise<{
  profile: PublicBusinessProfile | null;
  medicines: PublicBusinessMedicine[];
  promotions: PublicBusinessPromotion[];
  reviews: PublicBusinessReview[];
  error: boolean;
}> {
  if (!isSupabaseConfigured())
    return {
      profile: null,
      medicines: [],
      promotions: [],
      reviews: [],
      error: false,
    };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return {
      profile: null,
      medicines: [],
      promotions: [],
      reviews: [],
      error: false,
    };
  }
  try {
    const [profileResult, medicineResult] = await Promise.all([
      invokeRpc<PublicBusinessProfile[]>("get_public_business_profile", {
        p_business_slug: slug,
      }),
      invokeRpc<PublicBusinessMedicine[]>("list_public_business_medicines", {
        p_business_slug: slug,
      }),
    ]);
    if (profileResult.error || medicineResult.error) {
      return {
        profile: null,
        medicines: [],
        promotions: [],
        reviews: [],
        error: true,
      };
    }
    const profiles = Array.isArray(profileResult.data)
      ? profileResult.data
      : [];
    const medicines = Array.isArray(medicineResult.data)
      ? medicineResult.data
      : [];
    const profile = profiles[0] ?? null;
    const promotionResult = profile
      ? await invokeRpc<PublicBusinessPromotion[]>(
          "list_public_business_promotions",
          { p_business_id: profile.business_id },
        )
      : { data: [] as PublicBusinessPromotion[], error: null };
    const reviewResult = profile
      ? await invokeRpc<PublicBusinessReview[]>(
          "list_public_business_reviews",
          { p_business_id: profile.business_id },
        )
      : { data: [] as PublicBusinessReview[], error: null };
    const promotions = Array.isArray(promotionResult.data)
      ? promotionResult.data
      : [];
    const reviews = Array.isArray(reviewResult.data) ? reviewResult.data : [];
    return {
      profile,
      medicines,
      promotions,
      reviews,
      error: false,
    };
  } catch {
    return {
      profile: null,
      medicines: [],
      promotions: [],
      reviews: [],
      error: true,
    };
  }
}

export async function getMyBusinessReview(businessId: string) {
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(businessId)) {
    return { userId: null, review: null };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return { userId: null, review: null };
    const { data, error } = await supabase.rpc("get_my_business_review", {
      p_business_id: businessId,
    });
    if (error || !Array.isArray(data)) {
      return { userId: authData.user.id, review: null };
    }
    return {
      userId: authData.user.id,
      review: (data[0] as MyBusinessReview | undefined) ?? null,
    };
  } catch {
    return { userId: null, review: null };
  }
}
