"use server";

import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AuthActionState } from "@/types/auth";

export async function syncMyMfaSettingAction(
  enabled: boolean,
): Promise<AuthActionState> {
  if (typeof enabled !== "boolean") {
    return { error: "The security setting could not be verified." };
  }

  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const [{ data: factors, error: factorsError }, { data: assurance }] =
      await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
    if (factorsError) {
      return { error: "Authenticator status could not be verified." };
    }
    const verifiedFactors = factors.all.filter(
      (factor) => factor.status === "verified",
    );
    if (
      (enabled &&
        (!factors.totp.some((factor) => factor.status === "verified") ||
          assurance?.currentLevel !== "aal2")) ||
      (!enabled && verifiedFactors.length > 0)
    ) {
      return {
        error: enabled
          ? "Verify an authenticator code before enabling MFA."
          : "Remove all verified factors before disabling MFA.",
      };
    }

    const admin = createSupabaseAdminClient();
    const { error } = await admin.rpc("service_sync_security_mfa", {
      p_user_id: user.id,
      p_enabled: enabled,
    });
    if (error) {
      return {
        error: "MFA could not be saved. Contact support before signing out.",
      };
    }
    return { message: enabled ? "MFA is enabled." : "MFA is disabled." };
  } catch {
    return {
      error: "MFA settings are unavailable. Check the server configuration.",
    };
  }
}
