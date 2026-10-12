"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformPermission } from "@/lib/auth/authorization";

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

export async function savePromotionAction(formData: FormData) {
  const id = field(formData, "promotion_id");
  const businessId = field(formData, "business_id");
  const title = field(formData, "title");
  const description = field(formData, "description");
  const type = field(formData, "promotion_type");
  const status = field(formData, "status");
  const startsAt = parseIndiaDate(field(formData, "starts_at"));
  const endsAt = parseIndiaDate(field(formData, "ends_at"));
  if (
    (id && !/^[0-9a-f-]{36}$/i.test(id)) ||
    !/^[0-9a-f-]{36}$/i.test(businessId) ||
    title.length < 2 ||
    title.length > 160 ||
    description.length > 1000 ||
    !new Set(["offer", "featured_listing", "sponsored_listing"]).has(type) ||
    !new Set([
      "pending",
      "approved",
      "rejected",
      "scheduled",
      "active",
      "expired",
      "cancelled",
    ]).has(status) ||
    startsAt === undefined ||
    endsAt === undefined ||
    (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt))
  ) {
    redirect("/admin/promotions?error=invalid");
  }
  try {
    const { supabase } = await requirePlatformPermission("promotions.manage");
    const { error } = await supabase.rpc("admin_save_promotion", {
      p_promotion_id: id || null,
      p_business_id: businessId,
      p_title: title,
      p_description: description || null,
      p_promotion_type: type,
      p_status: status,
      p_starts_at: startsAt,
      p_ends_at: endsAt,
    });
    if (error) redirect("/admin/promotions?error=save");
    revalidatePath("/admin/promotions");
    revalidatePath("/pharmacies", "page");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/admin/promotions?error=save");
  }
  redirect("/admin/promotions?updated=1");
}

export async function deletePromotionAction(formData: FormData) {
  const id = field(formData, "promotion_id");
  if (!/^[0-9a-f-]{36}$/i.test(id) || formData.get("confirm_delete") !== "on") {
    redirect("/admin/promotions?error=confirm");
  }
  try {
    const { supabase } = await requirePlatformPermission("promotions.manage");
    const { error } = await supabase.rpc("admin_delete_promotion", {
      p_promotion_id: id,
    });
    if (error) redirect("/admin/promotions?error=delete");
    revalidatePath("/admin/promotions");
    revalidatePath("/pharmacies", "page");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/admin/promotions?error=delete");
  }
  redirect("/admin/promotions?updated=deleted");
}
