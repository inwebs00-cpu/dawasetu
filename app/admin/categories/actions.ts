"use server";

import { redirect } from "next/navigation";

import { requirePlatformPermission } from "@/lib/auth/authorization";

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveMedicineCategoryAction(formData: FormData) {
  const categoryId = field(formData, "category_id");
  const slug = field(formData, "slug");
  const name = field(formData, "name");
  const description = field(formData, "description");
  const displayOrderText = field(formData, "display_order");
  const active = field(formData, "is_active");
  const displayOrder = Number(displayOrderText);

  if (
    (categoryId && !/^[0-9a-f-]{36}$/i.test(categoryId)) ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    name.length < 1 ||
    name.length > 100 ||
    description.length > 500 ||
    !Number.isInteger(displayOrder) ||
    displayOrder < 0 ||
    displayOrder > 9999 ||
    (active !== "true" && active !== "false")
  ) {
    redirect("/admin/categories?error=invalid");
  }

  const { supabase } = await requirePlatformPermission("content.manage");
  let errorCode = "";
  try {
    const { error } = await supabase.rpc("admin_save_medicine_category", {
      p_category_id: categoryId || null,
      p_slug: slug,
      p_name: name,
      p_description: description || null,
      p_is_active: active === "true",
      p_display_order: displayOrder,
    });
    if (error) {
      errorCode = /duplicate|unique/i.test(error.message)
        ? "duplicate"
        : "save";
    }
  } catch {
    errorCode = "save";
  }

  if (errorCode) redirect(`/admin/categories?error=${errorCode}`);
  redirect("/admin/categories?saved=1");
}
