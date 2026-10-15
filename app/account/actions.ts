"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import type { AuthActionState } from "@/types/auth";

export async function updateAccountProfileAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const nameValue = formData.get("full_name");
  const phoneValue = formData.get("phone");
  const languageValue = formData.get("preferred_language");
  const fullName = typeof nameValue === "string" ? nameValue.trim() : "";
  const phoneInput = typeof phoneValue === "string" ? phoneValue.trim() : "";
  const compactPhone = phoneInput.replace(/[\s()-]/g, "");
  const indianDigits = compactPhone.replace(/^\+91/, "");
  const phone = phoneInput
    ? /^[6-9]\d{9}$/.test(indianDigits)
      ? `+91${indianDigits}`
      : /^\+[1-9]\d{7,14}$/.test(compactPhone)
        ? compactPhone
        : null
    : "";
  const language =
    typeof languageValue === "string" ? languageValue.trim() : "en";
  if (
    fullName.length < 1 ||
    fullName.length > 160 ||
    phone === null ||
    !/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})?$/.test(language)
  ) {
    return {
      error:
        "Enter a valid 10-digit Indian mobile number. You can type it with or without +91.",
    };
  }
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const { data, error } = await supabase
      .from("users")
      .update({
        full_name: fullName,
        phone_e164: phone || null,
        preferred_language: language,
      })
      .eq("id", user.id)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return {
        error:
          "Profile could not be saved. Check whether this phone number is already used, then try again.",
      };
    }
    revalidatePath("/account");
    return { message: "Your profile was updated." };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "Profile could not be saved. Please try again." };
  }
}

export async function removeSavedMedicineAction(formData: FormData) {
  const medicineId = formData.get("medicine_id");
  if (typeof medicineId !== "string" || !/^[0-9a-f-]{36}$/i.test(medicineId)) {
    redirect("/account?saved_error=invalid");
  }
  try {
    const { supabase } = await requireAuthenticatedUser();
    const { error } = await supabase.rpc("remove_my_saved_medicine", {
      p_medicine_id: medicineId,
    });
    if (error) redirect("/account?saved_error=remove");
    revalidatePath("/account");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/account?saved_error=remove");
  }
  redirect("/account?saved=removed");
}

export async function markNotificationsReadAction() {
  try {
    const { supabase } = await requireAuthenticatedUser();
    const { error } = await supabase.rpc("mark_my_notifications_read");
    if (error) redirect("/account?notifications_error=read");
    revalidatePath("/account");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/account?notifications_error=read");
  }
  redirect("/account?notifications=read");
}
