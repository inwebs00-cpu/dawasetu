"use server";

import { revalidatePath } from "next/cache";

import { requireBusinessPermission } from "@/lib/auth/authorization";
import type { AuthActionState } from "@/types/auth";

export async function requestDistributorAccessAction(
  partnerBusinessId: string,
  distributorBusinessId: string,
  _previousState: AuthActionState,
  _formData: FormData,
): Promise<AuthActionState> {
  void _previousState;
  void _formData;
  if (
    !/^[0-9a-f-]{36}$/i.test(partnerBusinessId) ||
    !/^[0-9a-f-]{36}$/i.test(distributorBusinessId)
  )
    return { error: "Choose a valid business." };
  try {
    const { supabase } = await requireBusinessPermission(
      partnerBusinessId,
      "distributors.view",
    );
    const { error } = await supabase.rpc("request_distributor_access", {
      p_partner_business_id: partnerBusinessId,
      p_distributor_business_id: distributorBusinessId,
    });
    if (error)
      return {
        error:
          "Access could not be requested. Verify your partner business and try again.",
      };
    revalidatePath(`/partner/${partnerBusinessId}/distributors`);
    return {
      message:
        "Access request sent to the distributor. Availability appears after approval.",
    };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "Distributor network is temporarily unavailable." };
  }
}
