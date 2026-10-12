"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformPermission } from "@/lib/auth/authorization";
import type { AuthActionState } from "@/types/auth";

function value(formData: FormData, key: string) {
  const field = formData.get(key);
  return typeof field === "string" ? field.trim() : "";
}

export async function saveAdminMedicineAction(
  medicineId: string | null,
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const productName = value(formData, "product_name");
  const brandName = value(formData, "brand_name");
  const composition = value(formData, "composition");
  const strength = value(formData, "strength");
  const manufacturer = value(formData, "manufacturer");
  const categoryId = value(formData, "category_id") || null;
  const medicineType = value(formData, "medicine_type");
  const prescriptionClass = value(formData, "prescription_class");
  const packaging = value(formData, "packaging");
  if (medicineId && !/^[0-9a-f-]{36}$/i.test(medicineId))
    return { error: "Choose a valid medicine." };
  if (productName.length < 1 || productName.length > 240)
    return { error: "Product name must be between 1 and 240 characters." };
  if (
    brandName.length > 240 ||
    composition.length < 2 ||
    composition.length > 240 ||
    strength.length < 1 ||
    strength.length > 120 ||
    manufacturer.length < 2 ||
    manufacturer.length > 200 ||
    packaging.length > 160
  )
    return {
      error:
        "Check composition, strength, manufacturer, brand, and packaging fields.",
    };
  if (
    !new Set([
      "tablet",
      "capsule",
      "syrup",
      "injection",
      "ointment",
      "drops",
      "inhaler",
      "device",
      "other",
    ]).has(medicineType)
  )
    return { error: "Choose a valid medicine type." };
  if (!new Set(["prescription", "otc", "unknown"]).has(prescriptionClass))
    return { error: "Choose a valid prescription classification." };
  if (categoryId && !/^[0-9a-f-]{36}$/i.test(categoryId))
    return { error: "Choose a valid category." };
  try {
    const { supabase } = await requirePlatformPermission("medicines.manage");
    const { error } = await supabase.rpc("admin_save_medicine", {
      p_medicine_id: medicineId,
      p_product_name: productName,
      p_brand_name: brandName || null,
      p_composition: composition,
      p_strength: strength,
      p_manufacturer: manufacturer,
      p_category_id: categoryId,
      p_medicine_type: medicineType,
      p_prescription_class: prescriptionClass,
      p_packaging: packaging || null,
      p_public_visibility: formData.get("public_visibility") === "on",
    });
    if (error)
      return {
        error:
          "Medicine could not be saved. Check the fields and whether the product already exists.",
      };
    revalidatePath("/admin");
    revalidatePath("/admin/medicines");
    return {
      message:
        "Saved as pending verification. Review it before it becomes publicly searchable.",
    };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "Medicine administration is temporarily unavailable." };
  }
}

export async function reviewAdminMedicineAction(
  medicineId: string,
  decision: "approved" | "rejected",
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!/^[0-9a-f-]{36}$/i.test(medicineId))
    return { error: "Choose a valid medicine." };
  if (decision !== "approved" && decision !== "rejected")
    return { error: "Choose a valid review decision." };
  const note = value(formData, "review_note");
  if (note.length > 1000)
    return { error: "Review note must be 1,000 characters or fewer." };
  try {
    const { supabase } = await requirePlatformPermission("medicines.approve");
    const { error } = await supabase.rpc("admin_review_medicine", {
      p_medicine_id: medicineId,
      p_decision: decision,
      p_note: note || null,
    });
    if (error)
      return {
        error:
          "This medicine could not be reviewed. It may no longer be pending.",
      };
    revalidatePath("/admin");
    revalidatePath("/admin/medicines");
    return {
      message:
        decision === "approved"
          ? "Medicine approved for the master database."
          : "Medicine rejected.",
    };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "Medicine review is temporarily unavailable." };
  }
}
