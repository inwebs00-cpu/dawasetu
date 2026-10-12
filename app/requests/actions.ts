"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/types/auth";

function get(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createMedicineRequestAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const medicineId = get(formData, "medicine_id");
  const medicineName = get(formData, "medicine_name");
  const composition = get(formData, "composition");
  const strength = get(formData, "strength");
  const quantityValue = get(formData, "quantity");
  const areaId = get(formData, "area_id");
  const note = get(formData, "note");
  if (medicineId && !/^[0-9a-f-]{36}$/i.test(medicineId))
    return { error: "Choose a valid medicine." };
  if (medicineName.length < 1 || medicineName.length > 240)
    return { error: "Medicine name must be between 1 and 240 characters." };
  if (composition.length > 240 || strength.length > 120 || note.length > 1000)
    return { error: "One or more request fields are too long." };
  if (!/^[0-9a-f-]{36}$/i.test(areaId))
    return { error: "Choose an area near you." };
  const quantity = Number(quantityValue);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100)
    return { error: "Quantity must be between 1 and 100." };

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user)
      redirect(`/login?next=${encodeURIComponent("/requests/new")}`);
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || profile?.status !== "active")
      return { error: "This account cannot submit a request right now." };
    const { error } = await supabase.rpc("create_medicine_request", {
      p_medicine_id: medicineId || null,
      p_requested_medicine_name: medicineName,
      p_composition_text: composition || null,
      p_strength: strength || null,
      p_quantity: quantity,
      p_customer_area_id: areaId,
      p_note: note || null,
      p_contact_preference: "in_app",
      p_contact_phone_e164: null,
    });
    if (error) {
      if (error.message.includes("Too many requests"))
        return {
          error:
            "You’ve reached the request limit. Please try again in an hour.",
        };
      return {
        error:
          "We could not submit this request. Choose an approved medicine and try again.",
      };
    }
    redirect("/account?request=sent");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "Medicine requests are temporarily unavailable." };
  }
}
