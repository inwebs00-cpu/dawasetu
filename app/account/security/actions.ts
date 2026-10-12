"use server";

import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { verifyCurrentPassword } from "@/lib/auth/verify-current-password";
import {
  hashSecurityPin,
  hasRecentOtp,
  verifySecurityPinHash,
} from "@/lib/security/security-pin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SecuritySettingsActionState } from "@/types/security";

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function verifiedSensitiveSession(
  supabase: Awaited<ReturnType<typeof requireAuthenticatedUser>>["supabase"],
  email: string | undefined,
  password: string,
  recoveryMode: boolean,
  userId: string,
  securityPin: string,
) {
  let verified = false;
  if (recoveryMode) {
    const { data, error } = await supabase.auth.getClaims();
    verified = !error && hasRecentOtp(data?.claims as Record<string, unknown>);
  } else if (email && password.length >= 12 && password.length <= 128) {
    verified = await verifyCurrentPassword(email, password);
  }
  if (!verified && !recoveryMode && /^\d{6}$/.test(securityPin)) {
    const admin = createSupabaseAdminClient();
    const { data: settings, error } = await admin
      .from("security_settings")
      .select("security_pin_hash, locked_until")
      .eq("user_id", userId)
      .maybeSingle();
    const locked =
      typeof settings?.locked_until === "string" &&
      new Date(settings.locked_until).getTime() > Date.now();
    if (!error && settings?.security_pin_hash && !locked) {
      const correct = await verifySecurityPinHash(
        securityPin,
        settings.security_pin_hash,
      );
      const { data: accepted, error: attemptError } = await admin.rpc(
        "service_record_security_pin_attempt",
        { p_user_id: userId, p_succeeded: correct },
      );
      verified = correct && !attemptError && accepted === true;
    }
  }
  if (!verified && !recoveryMode) {
    const { data, error } = await supabase.auth.getClaims();
    verified = !error && hasRecentOtp(data?.claims as Record<string, unknown>);
  }
  if (!verified) return false;

  const [{ data: factors, error: factorsError }, { data: assurance, error }] =
    await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
  if (factorsError || error) return false;
  const mfaEnrolled = factors.all.some(
    (factor) => factor.status === "verified",
  );
  return !mfaEnrolled || assurance.currentLevel === "aal2";
}

export async function saveSecurityRecoveryContactsAction(
  _previousState: SecuritySettingsActionState,
  formData: FormData,
): Promise<SecuritySettingsActionState> {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const wantsEmail = textValue(formData, "use_email") === "yes";
    const wantsPhone = textValue(formData, "use_phone") === "yes";
    const password = textValue(formData, "current_password");
    if (!wantsEmail && !wantsPhone) {
      return { error: "Choose at least one verified recovery method." };
    }
    if (
      !(await verifiedSensitiveSession(
        supabase,
        user.email,
        password,
        false,
        user.id,
        textValue(formData, "current_security_pin"),
      ))
    ) {
      return {
        error:
          "Confirm your password, use your current security PIN, or verify a fresh one-time code. Complete MFA if enabled.",
      };
    }
    const recoveryEmail = wantsEmail ? user.email?.toLowerCase() : null;
    const recoveryPhone = wantsPhone ? user.phone : null;
    if (
      (wantsEmail && !user.email_confirmed_at) ||
      (wantsPhone && !user.phone_confirmed_at)
    ) {
      return {
        error:
          "Recovery methods must be verified in your Supabase account first.",
      };
    }
    const { error } = await supabase.rpc("save_my_security_recovery_contacts", {
      p_recovery_email: recoveryEmail ?? null,
      p_recovery_phone_e164: recoveryPhone ?? null,
    });
    if (error) return { error: "Recovery settings could not be saved." };
    return { message: "Verified recovery methods saved." };
  } catch {
    return { error: "Recovery settings are temporarily unavailable." };
  }
}

export async function saveSecurityPinAction(
  _previousState: SecuritySettingsActionState,
  formData: FormData,
): Promise<SecuritySettingsActionState> {
  const pin = textValue(formData, "security_pin");
  const confirmation = textValue(formData, "confirm_security_pin");
  const recoveryMode = textValue(formData, "recovery_mode") === "yes";
  if (!/^\d{6}$/.test(pin) || pin !== confirmation) {
    return { error: "Enter the same six-digit security PIN in both fields." };
  }

  try {
    const { supabase, user } = await requireAuthenticatedUser();
    if (
      !(await verifiedSensitiveSession(
        supabase,
        user.email,
        textValue(formData, "current_password"),
        recoveryMode,
        user.id,
        textValue(formData, "current_security_pin"),
      ))
    ) {
      return {
        error: recoveryMode
          ? "Verify a new email or mobile OTP, then try again."
          : "Confirm your password, use your current PIN, or verify a fresh one-time code. Complete MFA if enabled.",
      };
    }
    const pinHash = await hashSecurityPin(pin);
    const admin = createSupabaseAdminClient();
    const { error } = await admin.rpc("service_save_security_pin_hash", {
      p_user_id: user.id,
      p_pin_hash: pinHash,
    });
    if (error) return { error: "The security PIN could not be saved." };
    return { message: "Security PIN saved. It is stored as a one-way hash." };
  } catch {
    return { error: "Security settings are temporarily unavailable." };
  }
}
