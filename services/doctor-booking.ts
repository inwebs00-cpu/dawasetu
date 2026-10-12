import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface PublicDoctorBookingProfile {
  doctor_id: string;
  slug: string;
  full_name: string;
  specialty: string;
  description?: string | null;
  booking_url?: string;
  business_name: string | null;
  business_slug?: string | null;
}

export async function listPublicDoctorBookingProfiles() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return { status: "unconfigured" as const, profiles: [] };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "list_public_doctor_booking_profiles",
    );
    if (error || !data) return { status: "error" as const, profiles: [] };
    return {
      status: "ready" as const,
      profiles: data as PublicDoctorBookingProfile[],
    };
  } catch {
    return { status: "error" as const, profiles: [] };
  }
}

export async function getPublicDoctorBookingProfile(slug: string) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return null;
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "get_public_doctor_booking_profile",
      { p_slug: slug },
    );
    if (error || !data?.[0]) return null;
    return data[0] as PublicDoctorBookingProfile;
  } catch {
    return null;
  }
}
