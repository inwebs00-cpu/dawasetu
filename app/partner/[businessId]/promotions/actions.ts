"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireBusinessPermission } from "@/lib/auth/authorization";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function parseIndiaDate(value: string) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}:00+05:30`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export async function savePartnerPromotionRequestAction(formData: FormData) {
  const businessId = field(formData, "business_id");
  const promotionId = field(formData, "promotion_id");
  const title = field(formData, "title");
  const description = field(formData, "description");
  const type = field(formData, "promotion_type");
  const startsAt = parseIndiaDate(field(formData, "starts_at"));
  const endsAt = parseIndiaDate(field(formData, "ends_at"));
  if (
    !/^[0-9a-f-]{36}$/i.test(businessId) ||
    (promotionId && !/^[0-9a-f-]{36}$/i.test(promotionId)) ||
    title.length < 2 ||
    title.length > 160 ||
    description.length > 1000 ||
    !new Set(["offer", "featured_listing", "sponsored_listing"]).has(type) ||
    startsAt === undefined ||
    endsAt === undefined ||
    (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt))
  ) {
    redirect(`/partner/${businessId}/promotions?error=invalid`);
  }
  try {
    const { supabase } = await requireBusinessPermission(
      businessId,
      "promotions.manage",
    );
    const { error } = await supabase.rpc("save_my_business_promotion", {
      p_promotion_id: promotionId || null,
      p_business_id: businessId,
      p_title: title,
      p_description: description || null,
      p_promotion_type: type,
      p_starts_at: startsAt,
      p_ends_at: endsAt,
    });
    if (error) redirect(`/partner/${businessId}/promotions?error=save`);
    revalidatePath(`/partner/${businessId}/promotions`);
    revalidatePath("/admin/promotions");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`/partner/${businessId}/promotions?error=save`);
  }
  redirect(`/partner/${businessId}/promotions?updated=1`);
}
