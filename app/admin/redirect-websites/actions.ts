"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformPermission } from "@/lib/auth/authorization";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveRedirectWebsiteAction(formData: FormData) {
  const id = field(formData, "redirect_id");
  const name = field(formData, "name");
  const url = field(formData, "website_url");
  const logoPath = field(formData, "logo_path");
  const description = field(formData, "description");
  const buttonText = field(formData, "button_text");
  const positionValue = field(formData, "display_position");
  const position = Number(positionValue);
  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(url);
  } catch {
    parsedUrl = null;
  }
  if (
    (id && !/^[0-9a-f-]{36}$/i.test(id)) ||
    name.length < 2 ||
    name.length > 100 ||
    !parsedUrl ||
    parsedUrl.protocol !== "https:" ||
    !parsedUrl.hostname ||
    parsedUrl.username.length > 0 ||
    parsedUrl.password.length > 0 ||
    url.length > 2048 ||
    logoPath.length > 1000 ||
    description.length > 1000 ||
    buttonText.length < 2 ||
    buttonText.length > 80 ||
    !Number.isInteger(position) ||
    position < 0 ||
    position > 10000
  ) {
    redirect("/admin/redirect-websites?error=invalid");
  }

  try {
    const { supabase } = await requirePlatformPermission("content.manage");
    const { error } = await supabase.rpc("admin_save_redirect_website", {
      p_redirect_id: id || null,
      p_name: name,
      p_website_url: url,
      p_logo_path: logoPath || null,
      p_description: description || null,
      p_button_text: buttonText,
      p_display_position: position,
      p_open_in_new_tab: formData.get("open_in_new_tab") === "on",
      p_is_active: formData.get("is_active") === "on",
    });
    if (error) redirect("/admin/redirect-websites?error=save");
    revalidatePath("/admin/redirect-websites");
    revalidatePath("/");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/admin/redirect-websites?error=save");
  }
  redirect("/admin/redirect-websites?updated=1");
}

export async function deleteRedirectWebsiteAction(formData: FormData) {
  const id = field(formData, "redirect_id");
  if (!/^[0-9a-f-]{36}$/i.test(id) || formData.get("confirm_delete") !== "on") {
    redirect("/admin/redirect-websites?error=confirm");
  }
  try {
    const { supabase } = await requirePlatformPermission("content.manage");
    const { error } = await supabase.rpc("admin_delete_redirect_website", {
      p_redirect_id: id,
    });
    if (error) redirect("/admin/redirect-websites?error=delete");
    revalidatePath("/admin/redirect-websites");
    revalidatePath("/");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/admin/redirect-websites?error=delete");
  }
  redirect("/admin/redirect-websites?updated=deleted");
}
