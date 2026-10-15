"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformPermission } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyCurrentPassword } from "@/lib/auth/verify-current-password";

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

export async function setUserStatusAction(formData: FormData) {
  const userId = value(formData, "user_id");
  const status = value(formData, "status");
  const reason = value(formData, "reason");
  const password = value(formData, "current_password");
  if (
    !/^[0-9a-f-]{36}$/i.test(userId) ||
    !new Set(["active", "inactive", "suspended"]).has(status) ||
    reason.length < 5 ||
    reason.length > 500 ||
    password.length < 12
  ) {
    redirect("/admin/users?error=invalid");
  }

  try {
    const { supabase, user } = await requirePlatformPermission("users.manage");
    if (!(await verifyCurrentPassword(user.email ?? "", password))) {
      redirect("/admin/users?error=reauth");
    }
    const admin = createSupabaseAdminClient();
    const { data: authorization, error: authorizationError } = await admin
      .from("admin_action_authorizations")
      .insert({
        user_id: user.id,
        action_key: "user.status.change",
        target_id: userId,
        requested_value: status,
        reason,
      })
      .select("id")
      .single();
    if (authorizationError || !authorization) {
      redirect("/admin/users?error=save");
    }
    const { error } = await supabase.rpc("admin_set_user_status", {
      p_authorization_id: authorization.id,
    });
    if (error) redirect("/admin/users?error=save");
    revalidatePath("/admin/users");
    revalidatePath("/admin");
    revalidatePath("/admin/team");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/admin/users?error=save");
  }
  redirect("/admin/users?updated=1");
}
