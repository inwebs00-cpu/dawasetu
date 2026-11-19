import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface AuthUserDirectoryFallbackRow {
  user_id: string;
  full_name: string;
  email: string | null;
  phone_e164: string | null;
  account_type: string;
  user_status: string;
  email_confirmed_at: string | null;
  verification_status: string;
  created_at: string;
  last_login_at: string | null;
  business_count: number;
  business_types: string[];
  platform_roles: string[];
}

/**
 * Emergency read path for a missing/unapplied admin user-directory migration.
 * This runs only in server code after the caller checks users.view. The result
 * is capped at 1,000 auth users; the SQL RPC remains the full directory path.
 */
export async function listAuthUserDirectoryFallback(): Promise<
  AuthUserDirectoryFallbackRow[]
> {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) throw error;

  return data.users
    .map((user) => {
      const metadata = user.user_metadata ?? {};
      const displayName = ["display_name", "full_name", "name"]
        .map((key) => metadata[key])
        .find(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        );
      const email = user.email ?? null;

      return {
        user_id: user.id,
        full_name:
          displayName?.trim() || email?.split("@")[0] || "DawaSetu User",
        email,
        phone_e164: user.phone ?? null,
        account_type: "customer",
        user_status: "active",
        email_confirmed_at: user.email_confirmed_at ?? null,
        verification_status: !email
          ? "no_email"
          : user.email_confirmed_at
            ? "verified"
            : "pending",
        created_at: user.created_at,
        last_login_at: user.last_sign_in_at ?? null,
        business_count: 0,
        business_types: [],
        platform_roles: [],
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
