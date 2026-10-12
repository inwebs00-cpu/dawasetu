"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformPermission } from "@/lib/auth/authorization";
import { verifyCurrentPassword } from "@/lib/auth/verify-current-password";

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

function numberOrNull(input: string) {
  if (!input) return null;
  const number = Number(input);
  return Number.isFinite(number) ? number : NaN;
}

async function verify(password: string) {
  const { supabase, user } = await requirePlatformPermission("payments.manage");
  if (!user.email || !(await verifyCurrentPassword(user.email, password))) {
    redirect("/admin/billing?error=reauth");
  }
  return supabase;
}

export async function saveSubscriptionPlanAction(formData: FormData) {
  const planId = value(formData, "plan_id");
  const name = value(formData, "name");
  const slug = value(formData, "slug").toLowerCase();
  const description = value(formData, "description");
  const monthlyPrice = numberOrNull(value(formData, "monthly_price_inr"));
  const yearlyPrice = numberOrNull(value(formData, "yearly_price_inr"));
  const teamLimit = numberOrNull(value(formData, "team_member_limit"));
  const inventoryLimit = numberOrNull(value(formData, "inventory_limit"));
  const trialDays = numberOrNull(value(formData, "trial_days"));
  const displayOrder = numberOrNull(value(formData, "display_order"));
  const password = value(formData, "current_password");
  const featureKeys = formData
    .getAll("feature_keys")
    .filter((item): item is string => typeof item === "string");
  if (
    (planId && !/^[0-9a-f-]{36}$/i.test(planId)) ||
    name.length < 2 ||
    name.length > 100 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    description.length > 1000 ||
    monthlyPrice === null ||
    yearlyPrice === null ||
    Number.isNaN(monthlyPrice) ||
    Number.isNaN(yearlyPrice) ||
    Number.isNaN(teamLimit) ||
    Number.isNaN(inventoryLimit) ||
    Number.isNaN(trialDays) ||
    trialDays === null ||
    Number.isNaN(displayOrder) ||
    displayOrder === null ||
    password.length < 12
  ) {
    redirect("/admin/billing?error=invalid");
  }

  try {
    const supabase = await verify(password);
    const { error } = await supabase.rpc("admin_save_subscription_plan", {
      p_plan_id: planId || null,
      p_name: name,
      p_slug: slug,
      p_description: description || null,
      p_monthly_price_inr: monthlyPrice,
      p_yearly_price_inr: yearlyPrice,
      p_team_member_limit: teamLimit,
      p_inventory_limit: inventoryLimit,
      p_trial_days: trialDays,
      p_feature_keys: featureKeys,
      p_is_active: formData.get("is_active") === "on",
      p_display_order: displayOrder,
    });
    if (error) redirect("/admin/billing?error=save");
    revalidatePath("/admin/billing");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/admin/billing?error=save");
  }
  redirect("/admin/billing?updated=plan");
}

export async function deleteSubscriptionPlanAction(formData: FormData) {
  const planId = value(formData, "plan_id");
  const password = value(formData, "current_password");
  if (!/^[0-9a-f-]{36}$/i.test(planId) || password.length < 12) {
    redirect("/admin/billing?error=invalid");
  }
  try {
    const supabase = await verify(password);
    const { error } = await supabase.rpc("admin_delete_subscription_plan", {
      p_plan_id: planId,
    });
    if (error) redirect("/admin/billing?error=delete");
    revalidatePath("/admin/billing");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/admin/billing?error=delete");
  }
  redirect("/admin/billing?updated=deleted");
}
