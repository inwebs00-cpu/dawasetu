"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformPermission } from "@/lib/auth/authorization";
import type { AuthActionState } from "@/types/auth";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function reviewBusinessAction(
  businessId: string,
  decision: "approved" | "rejected" | "suspended",
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!/^[0-9a-f-]{36}$/i.test(businessId))
    return { error: "Choose a valid business." };
  if (!new Set(["approved", "rejected", "suspended"]).has(decision))
    return { error: "Choose a valid review decision." };
  const note = formValue(formData, "review_note");
  if (note.length > 1000)
    return { error: "Review note must be 1,000 characters or fewer." };
  try {
    const { supabase } = await requirePlatformPermission("partners.approve");
    const { error } = await supabase.rpc("admin_review_business", {
      p_business_id: businessId,
      p_decision: decision,
      p_note: note || null,
    });
    if (error)
      return {
        error:
          "This business could not be reviewed. Its status may have changed.",
      };
    revalidatePath("/admin");
    revalidatePath("/admin/partners");
    revalidatePath("/pharmacies");
    return {
      message:
        decision === "approved"
          ? "Business approved. Public discovery remains controlled by its availability setting."
          : decision === "suspended"
            ? "Business suspended and public availability disabled."
            : "Business registration rejected.",
    };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "Partner review is temporarily unavailable." };
  }
}
