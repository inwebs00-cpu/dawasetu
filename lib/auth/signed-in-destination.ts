import "server-only";

import {
  getLoginDestination,
  type LoginBusiness,
  type LoginPortal,
} from "@/lib/auth/login-portals";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getSignedInDestination(
  portal: LoginPortal,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("status, password_change_required")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile || profile.status !== "active") return null;

  if (portal === "customer") return "/account";

  if (portal === "admin") {
    const { data, error } = await supabase.rpc("can_access_admin_portal");
    if (error || data !== true) return "/account";
    return profile.password_change_required
      ? "/change-password?next=%2Fadmin"
      : "/admin";
  }

  const { data, error } = await supabase.rpc("list_my_businesses");
  if (error) return "/account";
  const destination =
    getLoginDestination(portal, (data ?? []) as LoginBusiness[]) ?? "/account";
  return profile.password_change_required
    ? `/change-password?next=${encodeURIComponent(destination)}`
    : destination;
}
