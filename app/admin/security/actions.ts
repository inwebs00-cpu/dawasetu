"use server";

import { revalidatePath } from "next/cache";

import {
  requireAuthenticatedUser,
  requirePlatformPermission,
} from "@/lib/auth/authorization";
import { verifyCurrentPassword } from "@/lib/auth/verify-current-password";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AuthActionState } from "@/types/auth";

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function changeAdminPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const currentPassword = formText(formData, "current_password");
  const newPassword = formText(formData, "new_password");
  const confirmation = formText(formData, "confirm_password");
  if (
    currentPassword.length < 12 ||
    currentPassword.length > 128 ||
    newPassword.length < 12 ||
    newPassword.length > 128 ||
    newPassword !== confirmation ||
    newPassword === currentPassword
  ) {
    return {
      error:
        "Enter your current password and matching new passwords (12–128 characters). Choose a new password.",
    };
  }

  try {
    const { supabase, user } =
      await requirePlatformPermission("security.manage");
    if (
      !user.email ||
      !(await verifyCurrentPassword(user.email, currentPassword))
    ) {
      return { error: "Your current password could not be verified." };
    }

    const [{ data: factors, error: factorsError }, { data: assurance, error }] =
      await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
    if (factorsError || error) {
      return { error: "Security status could not be verified. Please retry." };
    }
    if (
      factors.all.some((factor) => factor.status === "verified") &&
      assurance.currentLevel !== "aal2"
    ) {
      return {
        error:
          "Complete your authenticator check before changing this password.",
      };
    }

    const admin = createSupabaseAdminClient();
    const { error: passwordError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (passwordError) {
      return { error: "The password could not be changed. Please retry." };
    }

    const { error: auditError } = await admin.from("audit_logs").insert({
      actor_user_id: user.id,
      action: "auth.password.change",
      module: "security",
      record_table: "users",
      record_id: user.id,
      metadata: { source: "admin_security_settings" },
    });
    revalidatePath("/admin/security");
    return auditError
      ? {
          message:
            "Password changed. The security event could not be logged; contact support if this continues.",
        }
      : { message: "Admin password changed successfully." };
  } catch {
    return {
      error: "Password settings are temporarily unavailable. Please retry.",
    };
  }
}

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
