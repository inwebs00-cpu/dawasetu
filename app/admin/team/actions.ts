"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformPermission } from "@/lib/auth/authorization";
import { verifyCurrentPassword } from "@/lib/auth/verify-current-password";

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

async function verifyPassword(email: string | undefined, password: string) {
  return email ? verifyCurrentPassword(email, password) : false;
}

export async function savePlatformRoleAction(formData: FormData) {
  const password = value(formData, "current_password");
  const roleId = value(formData, "role_id");
  const slug = value(formData, "slug").toLowerCase();
  const name = value(formData, "name");
  const description = value(formData, "description");
  const permissionKeys = formData
    .getAll("permission_keys")
    .filter((entry): entry is string => typeof entry === "string");
  if (
    password.length < 12 ||
    (roleId && !/^[0-9a-f-]{36}$/i.test(roleId)) ||
    !/^[a-z][a-z0-9_]{1,47}$/.test(slug) ||
    name.length < 2 ||
    name.length > 100 ||
    description.length > 500
  ) {
    redirect("/admin/team?error=invalid");
  }

  try {
    const { supabase, user } =
      await requirePlatformPermission("security.manage");
    if (!(await verifyPassword(user.email, password)))
      redirect("/admin/team?error=reauth");
    const { error } = await supabase.rpc("admin_save_platform_role", {
      p_role_id: roleId || null,
      p_slug: slug,
      p_name: name,
      p_description: description || null,
      p_permission_keys: permissionKeys,
    });
    if (error) redirect("/admin/team?error=save");
    revalidatePath("/admin/team");
    revalidatePath("/admin");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/admin/team?error=save");
  }
  redirect("/admin/team?updated=role");
}

export async function assignPlatformRoleAction(formData: FormData) {
  const email = value(formData, "email").toLowerCase();
  const roleId = value(formData, "role_id");
  const password = value(formData, "current_password");
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !/^[0-9a-f-]{36}$/i.test(roleId) ||
    password.length < 12
  ) {
    redirect("/admin/team?error=invalid");
  }

  try {
    const { supabase, user } =
      await requirePlatformPermission("security.manage");
    if (!(await verifyPassword(user.email, password)))
      redirect("/admin/team?error=reauth");
    const { error } = await supabase.rpc("admin_assign_platform_role", {
      p_email: email,
      p_role_id: roleId,
    });
    if (error) redirect("/admin/team?error=assign");
    revalidatePath("/admin/team");
    revalidatePath("/admin");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/admin/team?error=assign");
  }
  redirect("/admin/team?updated=assigned");
}

export async function removePlatformRoleAction(formData: FormData) {
  const userId = value(formData, "user_id");
  const roleId = value(formData, "role_id");
  const password = value(formData, "current_password");
  if (
    !/^[0-9a-f-]{36}$/i.test(userId) ||
    !/^[0-9a-f-]{36}$/i.test(roleId) ||
    password.length < 12
  ) {
    redirect("/admin/team?error=invalid");
  }

  try {
    const { supabase, user } =
      await requirePlatformPermission("security.manage");
    if (!(await verifyPassword(user.email, password)))
      redirect("/admin/team?error=reauth");
    const { error } = await supabase.rpc("admin_remove_platform_role", {
      p_user_id: userId,
      p_role_id: roleId,
    });
    if (error) redirect("/admin/team?error=remove");
    revalidatePath("/admin/team");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/admin/team?error=remove");
  }
  redirect("/admin/team?updated=removed");
}

export async function setPlatformTeamStatusAction(formData: FormData) {
  const userId = value(formData, "user_id");
  const status = value(formData, "status");
  const password = value(formData, "current_password");
  if (
    !/^[0-9a-f-]{36}$/i.test(userId) ||
    !new Set(["active", "inactive", "suspended"]).has(status) ||
    password.length < 12
  ) {
    redirect("/admin/team?error=invalid");
  }

  try {
    const { supabase, user } = await requirePlatformPermission("users.manage");
    if (!(await verifyPassword(user.email, password)))
      redirect("/admin/team?error=reauth");
    const { error } = await supabase.rpc("admin_set_platform_team_status", {
      p_user_id: userId,
      p_status: status,
    });
    if (error) redirect("/admin/team?error=status");
    revalidatePath("/admin/team");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/admin/team?error=status");
  }
  redirect("/admin/team?updated=status");
}
