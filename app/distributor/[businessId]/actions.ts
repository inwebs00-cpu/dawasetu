"use server";

import { revalidatePath } from "next/cache";

import { requireBusinessPermission } from "@/lib/auth/authorization";
import type { AuthActionState } from "@/types/auth";

function validId(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value);
}

export async function createDistributorInquiryAction(
  partnerBusinessId: string,
  distributorBusinessId: string,
  medicineId: string,
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const quantity = Number(formData.get("requested_quantity"));
  const message = String(formData.get("message") ?? "").trim();
  if (
    !validId(partnerBusinessId) ||
    !validId(distributorBusinessId) ||
    !validId(medicineId) ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > 1_000_000 ||
    message.length > 1000
  ) {
    return { error: "Enter a valid quantity and inquiry message." };
  }
  try {
    const { supabase } = await requireBusinessPermission(
      partnerBusinessId,
      "distributors.view",
    );
    const { error } = await supabase.rpc("create_partner_distributor_inquiry", {
      p_partner_business_id: partnerBusinessId,
      p_distributor_business_id: distributorBusinessId,
      p_medicine_id: medicineId,
      p_requested_quantity: quantity,
      p_message: message || null,
    });
    if (error)
      return {
        error:
          "The inquiry could not be sent. Check your approved access and the latest reported stock.",
      };
    revalidatePath(`/partner/${partnerBusinessId}`);
    revalidatePath(`/partner/${partnerBusinessId}/distributors`);
    revalidatePath(
      `/partner/${partnerBusinessId}/distributors/${distributorBusinessId}`,
    );
    revalidatePath(`/distributor/${distributorBusinessId}`);
    revalidatePath(`/distributor/${distributorBusinessId}/inquiries`);
    return { message: "B2B availability inquiry sent to the distributor." };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "Distributor inquiries are temporarily unavailable." };
  }
}

export async function respondToDistributorInquiryAction(
  distributorBusinessId: string,
  inquiryId: string,
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const decision = String(formData.get("decision"));
  const message = String(formData.get("response_message") ?? "").trim();
  if (
    !validId(distributorBusinessId) ||
    !validId(inquiryId) ||
    !["responded", "unavailable"].includes(decision) ||
    message.length > 1000 ||
    message.length < 2
  ) {
    return { error: "Enter a response of at least two characters." };
  }
  try {
    const { supabase } = await requireBusinessPermission(
      distributorBusinessId,
      "distributors.access.manage",
    );
    const { error } = await supabase.rpc("respond_to_distributor_inquiry", {
      p_distributor_business_id: distributorBusinessId,
      p_inquiry_id: inquiryId,
      p_decision: decision,
      p_message: message || null,
    });
    if (error)
      return {
        error:
          "This inquiry could not be updated. It may already have a response.",
      };
    revalidatePath(`/distributor/${distributorBusinessId}`);
    revalidatePath(`/distributor/${distributorBusinessId}/inquiries`);
    return { message: "Inquiry response saved and the partner notified." };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "Distributor inquiries are temporarily unavailable." };
  }
}
