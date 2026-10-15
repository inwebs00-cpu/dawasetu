"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireBusinessPermission } from "@/lib/auth/authorization";

const orderTransitions: Record<string, string[]> = {
  inquiry: ["pending_confirmation", "cancelled"],
  pending_confirmation: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export async function updatePartnerOrderStatusAction(formData: FormData) {
  const businessId = formData.get("business_id");
  const orderId = formData.get("order_id");
  const nextStatus = formData.get("status");
  if (
    typeof businessId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(businessId) ||
    typeof orderId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(orderId) ||
    typeof nextStatus !== "string"
  ) {
    redirect("/partner?orders_error=invalid");
  }

  const { supabase } = await requireBusinessPermission(
    businessId,
    "requests.respond",
  );
  const { data: order, error: readError } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (readError || !order) {
    redirect(`/partner/${businessId}/orders?error=not_found`);
  }
  if (!orderTransitions[order.status]?.includes(nextStatus)) {
    redirect(`/partner/${businessId}/orders?error=transition`);
  }

  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({ status: nextStatus })
    .eq("id", orderId)
    .eq("business_id", businessId)
    .eq("status", order.status)
    .select("id")
    .maybeSingle();
  if (updateError || !updated) {
    redirect(`/partner/${businessId}/orders?error=update`);
  }
  revalidatePath(`/partner/${businessId}`);
  revalidatePath(`/partner/${businessId}/orders`);
  redirect(`/partner/${businessId}/orders?updated=order`);
}

export async function respondToPartnerInquiryAction(
  businessId: string,
  inquiryId: string,
  _previousState: { error?: string; message?: string },
  formData: FormData,
): Promise<{ error?: string; message?: string }> {
  if (
    !/^[0-9a-f-]{36}$/i.test(businessId) ||
    !/^[0-9a-f-]{36}$/i.test(inquiryId)
  ) {
    return { error: "Choose a valid inquiry." };
  }
  const responseField = formData.get("response_message");
  const responseMessage =
    typeof responseField === "string" ? responseField.trim() : "";
  if (responseMessage.length < 1 || responseMessage.length > 1000) {
    return { error: "Reply must be between 1 and 1,000 characters." };
  }

  const { supabase } = await requireBusinessPermission(
    businessId,
    "requests.respond",
  );
  try {
    const { error } = await supabase.rpc("respond_to_partner_inquiry", {
      p_business_id: businessId,
      p_inquiry_id: inquiryId,
      p_response_message: responseMessage,
    });
    if (error) {
      return {
        error:
          "The inquiry may already have a reply or your access may have changed. Refresh and try again.",
      };
    }
    revalidatePath(`/partner/${businessId}`);
    revalidatePath(`/partner/${businessId}/orders`);
    revalidatePath("/account");
    return {
      message: "Your reply was delivered to the customer’s DawaSetu account.",
    };
  } catch {
    return { error: "The reply could not be sent. Please try again." };
  }
}
