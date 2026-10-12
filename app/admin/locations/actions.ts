"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformPermission } from "@/lib/auth/authorization";
import type { AuthActionState } from "@/types/auth";

export async function saveAreaAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const value = (key: string) => {
    const field = formData.get(key);
    return typeof field === "string" ? field.trim() : "";
  };
  const state = value("state_name");
  const stateCode = value("state_code").toUpperCase();
  const district = value("district_name");
  const area = value("area_name");
  const postalCode = value("postal_code");
  if (
    state.length < 2 ||
    state.length > 100 ||
    district.length < 2 ||
    district.length > 100 ||
    area.length < 2 ||
    area.length > 100
  )
    return {
      error: "State, district, and area names must be 2 to 100 characters.",
    };
  if (!/^[A-Z0-9-]{2,6}$/.test(stateCode))
    return { error: "State code must be 2 to 6 letters, numbers, or hyphens." };
  if (postalCode && !/^\d{6}$/.test(postalCode))
    return { error: "PIN code must contain six digits." };
  try {
    const { supabase } = await requirePlatformPermission("partners.manage");
    const { error } = await supabase.rpc("admin_save_area", {
      p_state_name: state,
      p_state_code: stateCode,
      p_district_name: district,
      p_area_name: area,
      p_postal_code: postalCode || null,
    });
    if (error)
      return {
        error:
          "Area could not be saved. Check for an existing name or try again.",
      };
    revalidatePath("/admin/locations");
    revalidatePath("/partner/register");
    revalidatePath("/requests/new");
    return {
      message:
        "Area saved. Customers and partners can now map to this locality.",
    };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "Location settings are temporarily unavailable." };
  }
}
