"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SecurityRecoveryOtpState } from "@/types/security";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function requestSecurityPinOtpAction(
  _previousState: SecurityRecoveryOtpState,
  formData: FormData,
): Promise<SecurityRecoveryOtpState> {
  const identifier = field(formData, "identifier");
  const email = identifier.toLowerCase();
  const isEmail =
    email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPhone = /^\+[1-9]\d{7,14}$/.test(identifier);
  if (!isEmail && !isPhone) {
    return {
      error: "Enter a valid account email or mobile number with country code.",
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    if (isEmail) {
      await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
    } else {
      await supabase.auth.signInWithOtp({
        phone: identifier,
        options: { shouldCreateUser: false },
      });
    }
  } catch {
    // Keep the response uniform for unknown accounts and unavailable providers.
  }

  return {
    step: "verify",
    channel: isEmail ? "email" : "phone",
    identifier: isEmail ? email : identifier,
    message:
      "If this is a verified account contact, an OTP will arrive shortly. Enter it here to continue.",
  };
}

export async function verifySecurityPinOtpAction(
  _previousState: SecurityRecoveryOtpState,
  formData: FormData,
): Promise<SecurityRecoveryOtpState> {
  const channel = field(formData, "channel");
  const identifier = field(formData, "identifier");
  const token = field(formData, "token");
  if (
    (channel !== "email" && channel !== "phone") ||
    token.length < 6 ||
    token.length > 12 ||
    !/^\d+$/.test(token)
  ) {
    return {
      step: "verify",
      channel: channel === "phone" ? "phone" : "email",
      identifier,
      error: "Enter the OTP from your email or mobile message.",
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp(
      channel === "email"
        ? { email: identifier.toLowerCase(), token, type: "email" }
        : { phone: identifier, token, type: "sms" },
    );
    if (error || !data.user) {
      return {
        step: "verify",
        channel,
        identifier,
        error:
          "That OTP is invalid or expired. Request a new one and try again.",
      };
    }

    const [
      { data: factors, error: factorsError },
      { data: assurance, error: assuranceError },
    ] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (factorsError || assuranceError) {
      await supabase.auth.signOut();
      return {
        step: "verify",
        channel,
        identifier,
        error: "Security checks are unavailable. Request a new OTP later.",
      };
    }
    const hasVerifiedFactor = factors.all.some(
      (factor) => factor.status === "verified",
    );
    if (hasVerifiedFactor && assurance.currentLevel !== "aal2") {
      redirect(
        `/mfa?next=${encodeURIComponent("/account/security?pin=reset")}`,
      );
    }
    redirect("/account/security?pin=reset");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return {
      step: "verify",
      channel,
      identifier,
      error: "OTP verification is temporarily unavailable.",
    };
  }
}
