"use server";

import { revalidatePath } from "next/cache";

import { requireBusinessPermission } from "@/lib/auth/authorization";
import type { AuthActionState } from "@/types/auth";

export async function reviewDistributorAccessAction(
  distributorBusinessId: string,
  partnerBusinessId: string,
  decision: "approved" | "rejected" | "revoked",
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (
    !/^[0-9a-f-]{36}$/i.test(distributorBusinessId) ||
    !/^[0-9a-f-]{36}$/i.test(partnerBusinessId)
  )
    return { error: "Choose a valid business." };
  if (!new Set(["approved", "rejected", "revoked"]).has(decision))
    return { error: "Choose a valid access decision." };
  const noteField = formData.get("review_note");
  const note = typeof noteField === "string" ? noteField.trim() : "";
  if (note.length > 1000)
    return { error: "Review note must be 1,000 characters or fewer." };
  try {
    const { supabase } = await requireBusinessPermission(
      distributorBusinessId,
      "distributors.access.manage",
    );
    const { error } = await supabase.rpc("review_distributor_access", {
      p_distributor_business_id: distributorBusinessId,
      p_partner_business_id: partnerBusinessId,
      p_decision: decision,
      p_note: note || null,
    });
    if (error)
      return {
        error:
          "Access status could not be changed. It may have changed already.",
      };
    revalidatePath(`/distributor/${distributorBusinessId}/access`);
    revalidatePath(`/partner/${partnerBusinessId}/distributors`);
    revalidatePath(
      `/partner/${partnerBusinessId}/distributors/${distributorBusinessId}`,
    );
    return {
      message:
        decision === "approved"
          ? "Verified partner access approved."
          : decision === "revoked"
            ? "Partner access revoked."
            : "Partner access request rejected.",
    };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return {
      error: "Distributor access management is temporarily unavailable.",
    };
  }
}
