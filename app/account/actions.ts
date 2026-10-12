"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/authorization";

export async function updateAccountProfileAction(formData: FormData) {
  const nameValue = formData.get("full_name");
  const phoneValue = formData.get("phone_e164");
  const languageValue = formData.get("preferred_language");
  const fullName = typeof nameValue === "string" ? nameValue.trim() : "";
  const phone = typeof phoneValue === "string" ? phoneValue.trim() : "";
  const language =
    typeof languageValue === "string" ? languageValue.trim() : "en";
  if (
    fullName.length < 1 ||
    fullName.length > 160 ||
    (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) ||
    !/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})?$/.test(language)
  ) {
    redirect("/account?profile_error=invalid");
  }
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const { error } = await supabase
      .from("users")
      .update({
        full_name: fullName,
        phone_e164: phone || null,
        preferred_language: language,
      })
      .eq("id", user.id);
    if (error) redirect("/account?profile_error=save");
    revalidatePath("/account");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/account?profile_error=save");
  }
  redirect("/account?profile=updated");
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
