"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  searchPublicMedicines,
  type SearchResult,
} from "@/services/medicine-search";

export async function searchNearbyAction(
  query: string,
  latitude: number,
  longitude: number,
  categorySlug: string | null,
): Promise<SearchResult> {
  if (
    typeof query !== "string" ||
    query.length > 120 ||
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    (categorySlug !== null &&
      (typeof categorySlug !== "string" ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(categorySlug)))
  ) {
    return { status: "error" };
  }
  return searchPublicMedicines(query, {
    latitude,
    longitude,
    categorySlug,
  });
}

export async function saveMyMedicineAction(formData: FormData) {
  const medicineId = formData.get("medicine_id");
  const returnValue = formData.get("return_to");
  const returnTo =
    typeof returnValue === "string" &&
    returnValue.startsWith("/medicines") &&
    !returnValue.startsWith("//")
      ? returnValue.slice(0, 500)
      : "/medicines";
  if (typeof medicineId !== "string" || !/^[0-9a-f-]{36}$/i.test(medicineId)) {
    redirect(
      `${returnTo}${returnTo.includes("?") ? "&" : "?"}save_error=invalid`,
    );
  }
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      redirect(`/login?next=${encodeURIComponent(returnTo)}`);
    }
    const { error } = await supabase.rpc("save_my_medicine", {
      p_medicine_id: medicineId,
    });
    if (error) {
      redirect(
        `${returnTo}${returnTo.includes("?") ? "&" : "?"}save_error=failed`,
      );
    }
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(
      `${returnTo}${returnTo.includes("?") ? "&" : "?"}save_error=failed`,
    );
  }
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}saved=1`);
}
