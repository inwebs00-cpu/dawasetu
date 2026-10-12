"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformPermission } from "@/lib/auth/authorization";

export async function moderateBusinessReviewAction(formData: FormData) {
  const reviewId = formData.get("review_id");
  const decision = formData.get("decision");
  const status = formData.get("status");
  if (
    typeof reviewId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(reviewId) ||
    typeof decision !== "string" ||
    !new Set(["approved", "rejected", "hidden"]).has(decision) ||
    typeof status !== "string" ||
    !new Set(["pending", "approved", "rejected", "hidden"]).has(status)
  ) {
    redirect("/admin/reviews?error=invalid");
  }
  try {
    const { supabase } = await requirePlatformPermission("partners.approve");
    const { error } = await supabase.rpc("admin_review_business_review", {
      p_review_id: reviewId,
      p_decision: decision,
    });
    if (error) redirect(`/admin/reviews?status=${status}&error=save`);
    revalidatePath("/admin/reviews");
    revalidatePath("/pharmacies/[slug]", "page");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`/admin/reviews?status=${status}&error=save`);
  }
  redirect(`/admin/reviews?status=${status}&updated=${decision}`);
}
