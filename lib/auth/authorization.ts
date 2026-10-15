import "server-only";

import { redirect } from "next/navigation";

import { getLoginDestination } from "@/lib/auth/login-portals";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select(
      "id, full_name, phone_e164, preferred_language, account_type, status, password_change_required",
    )
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.status !== "active") {
    await supabase.auth.signOut();
    redirect("/login");
  }

  if (profile.password_change_required) {
    const { data: hasAdminAccess } = await supabase.rpc(
      "can_access_admin_portal",
    );
    let nextPath = hasAdminAccess === true ? "/admin" : null;
    if (!nextPath) {
      const { data: businesses } = await supabase.rpc("list_my_businesses");
      nextPath =
        getLoginDestination("partner", businesses ?? []) ??
        getLoginDestination("distributor", businesses ?? []) ??
        "/account";
    }
    redirect(`/change-password?next=${encodeURIComponent(nextPath)}`);
  }

  return { supabase, user: data.user, profile };
}

export async function requirePlatformPermission(permissionKey: string) {
  const context = await requireAuthenticatedUser();
  const { data, error } = await context.supabase.rpc(
    "has_platform_permission",
    {
      p_permission_key: permissionKey,
    },
  );
  if (error || data !== true) {
    const [{ data: factors }, { data: assurance }] = await Promise.all([
      context.supabase.auth.mfa.listFactors(),
      context.supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    const hasVerifiedFactor =
      factors?.all.some((factor) => factor.status === "verified") ?? false;
    if (hasVerifiedFactor && assurance?.currentLevel !== "aal2") {
      redirect(`/mfa?next=${encodeURIComponent("/admin")}`);
    }
    redirect("/account");
  }
  return context;
}

export async function requireBusinessPermission(
  businessId: string,
  permissionKey: string,
) {
  const context = await requireAuthenticatedUser();
  const { data, error } = await context.supabase.rpc(
    "has_business_permission",
    {
      p_business_id: businessId,
      p_permission_key: permissionKey,
    },
  );
  if (error || data !== true) redirect("/account");
  return context;
}
