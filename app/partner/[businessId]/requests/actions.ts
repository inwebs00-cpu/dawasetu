"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/types/auth";

export async function respondToMedicineRequestAction(
  businessId: string,
  requestId: string,
  response: "available" | "unavailable",
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (
    !/^[0-9a-f-]{36}$/i.test(businessId) ||
    !/^[0-9a-f-]{36}$/i.test(requestId)
  )
    return { error: "Choose a valid request." };
  if (response !== "available" && response !== "unavailable")
    return { error: "Choose a valid response." };
  const messageField = formData.get("message");
  const message = typeof messageField === "string" ? messageField.trim() : "";
  if (message.length > 1000)
    return { error: "Message must be 1,000 characters or fewer." };

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return { error: "Sign in to respond to requests." };
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || profile?.status !== "active")
      return { error: "This account cannot respond to requests." };
    const { data: permitted, error: permissionError } = await supabase.rpc(
      "has_business_permission",
      { p_business_id: businessId, p_permission_key: "requests.respond" },
    );
    if (permissionError || permitted !== true)
      return {
        error: "You do not have permission to respond for this business.",
      };
    const { error } = await supabase.rpc("respond_to_medicine_request", {
      p_business_id: businessId,
      p_request_id: requestId,
      p_response: response,
      p_message: message || null,
    });
    if (error)
      return {
        error:
          "This request is no longer open for your business or could not be updated.",
      };
    revalidatePath(`/partner/${businessId}`);
    revalidatePath(`/partner/${businessId}/requests`);
    return {
      message:
        response === "available"
          ? "Availability shared with the customer."
          : "Response saved. The customer’s personal details remain private.",
    };
  } catch {
    return { error: "Request response is temporarily unavailable." };
  }
}
