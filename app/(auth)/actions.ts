"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ADMIN_LOGIN_EMAIL,
  resolveAdminLoginEmail,
} from "@/lib/auth/admin-login-identifier";
import {
  getLoginDestination,
  isLoginPortal,
  type LoginBusiness,
  type LoginPortal,
} from "@/lib/auth/login-portals";
import { getSafeNextPath } from "@/lib/auth/safe-next-path";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AuthActionState } from "@/types/auth";

function textField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function normalizedEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return email;
}

function validPassword(value: string): boolean {
  return value.length >= 12 && value.length <= 128;
}

function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const origin =
    configured ||
    (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  if (!origin)
    throw new Error("NEXT_PUBLIC_SITE_URL is required in production.");
  const parsed = new URL(origin);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS.");
  }
  return parsed.origin;
}

function clientError(): AuthActionState {
  return {
    error:
      "Authentication is temporarily unavailable. Please try again shortly.",
  };
}

function adminOtpDeliveryFailure(error: unknown): AuthActionState {
  const details =
    error && typeof error === "object"
      ? (error as { message?: unknown; status?: unknown; code?: unknown })
      : {};
  const message = typeof details.message === "string" ? details.message : "";
  const code = typeof details.code === "string" ? details.code : "";
  const status = typeof details.status === "number" ? details.status : null;
  const failure = `${code} ${message}`.toLowerCase();

  console.error("[admin-otp] Supabase email delivery failed", {
    status,
    code: code || "unknown",
  });

  if (
    status === 429 ||
    failure.includes("over_email_send_rate_limit") ||
    failure.includes("rate limit")
  ) {
    return {
      error:
        "Supabase has temporarily limited sign-in emails. Its built-in sender is rate-limited; wait before retrying or configure custom SMTP in Supabase.",
    };
  }

  if (
    failure.includes("email address not authorized") ||
    failure.includes("email_address_not_authorized")
  ) {
    return {
      error:
        "Supabase's built-in mail service cannot send to this inbox. Configure a custom SMTP provider in Supabase Auth settings, then try again.",
    };
  }

  if (failure.includes("redirect") || failure.includes("redirect_to")) {
    return {
      error:
        "Supabase rejected the admin sign-in callback URL. Add the production callback URL to Supabase Auth's Redirect URLs, then retry.",
    };
  }

  return {
    error:
      "Supabase could not send the admin sign-in email. Check Supabase Auth logs and email delivery settings; no email was sent.",
  };
}

async function redirectAfterAuthentication(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  nextPath: string,
) {
  const [{ data: factors, error: factorsError }, { data: assurance, error }] =
    await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
  if (factorsError || error) {
    await supabase.auth.signOut();
    return { error: "Security checks are unavailable. Please sign in again." };
  }
  const hasVerifiedFactor = factors.all.some(
    (factor) => factor.status === "verified",
  );
  if (hasVerifiedFactor && assurance.currentLevel !== "aal2") {
    redirect(`/mfa?next=${encodeURIComponent(nextPath)}`);
  }
  redirect(nextPath);
}

export async function signInAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const portalValue = textField(formData, "portal") || "customer";
  if (!isLoginPortal(portalValue)) {
    return { error: "Choose a valid sign-in page." };
  }
  const portal: LoginPortal = portalValue;
  const email =
    portal === "admin"
      ? resolveAdminLoginEmail(textField(formData, "identifier"))
      : normalizedEmail(textField(formData, "email"));
  const password = textField(formData, "password");
  if (!email || password.length < 1 || password.length > 128) {
    return {
      error:
        portal === "admin"
          ? "Enter a valid admin ID or email and password."
          : "Enter a valid email and password.",
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !signInData.user)
      return { error: "Email or password is incorrect." };

    let destination: string | null = null;
    if (portal === "admin") {
      const { data, error: permissionError } = await supabase.rpc(
        "can_access_admin_portal",
      );
      if (permissionError) {
        await supabase.auth.signOut();
        return {
          error: "Admin access could not be verified. Please try again.",
        };
      }
      destination = getLoginDestination(portal, [], data === true);
    } else if (portal === "partner" || portal === "distributor") {
      const { data, error: businessesError } =
        await supabase.rpc("list_my_businesses");
      if (businessesError) {
        await supabase.auth.signOut();
        return {
          error: "Business access could not be verified. Please try again.",
        };
      }
      destination = getLoginDestination(
        portal,
        (data ?? []) as LoginBusiness[],
      );
    } else {
      destination =
        (portal === "customer"
          ? getSafeNextPath(textField(formData, "next"))
          : null) ?? getLoginDestination(portal);
    }

    if (!destination) {
      await supabase.auth.signOut();
      return {
        error:
          portal === "admin"
            ? "This account is not assigned to the admin workspace."
            : portal === "partner"
              ? "No pharmacy, clinic, or nursing-home business is linked to this account yet."
              : "No distributor business is linked to this account yet.",
      };
    }
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("password_change_required")
      .eq("id", signInData.user.id)
      .maybeSingle();
    if (profileError || !profile) {
      await supabase.auth.signOut();
      return { error: "Account security could not be verified. Please retry." };
    }
    const nextPath = profile.password_change_required
      ? `/change-password?next=${encodeURIComponent(destination)}`
      : destination;
    return await redirectAfterAuthentication(supabase, nextPath);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return clientError();
  }
}

export async function requestAdminOtpAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = normalizedEmail(textField(formData, "email"));
  if (email !== ADMIN_LOGIN_EMAIL) {
    return { error: "Use the configured DawaSetu admin email address." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${siteOrigin()}/auth/callback?next=%2Fadmin`,
      },
    });
    if (error) return adminOtpDeliveryFailure(error);
  } catch (error) {
    return adminOtpDeliveryFailure(error);
  }
  return {
    otpRequested: true,
    message:
      "Supabase accepted the email request. Check your inbox and spam folder. If it does not arrive, the email provider may still block delivery; ask the platform operator to configure custom SMTP.",
  };
}
export async function verifyAdminOtpAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = normalizedEmail(textField(formData, "email"));
  const token = textField(formData, "token").trim();
  if (email !== ADMIN_LOGIN_EMAIL || !/^\d{6,10}$/.test(token)) {
    return {
      error: "Enter the email code sent to the DawaSetu admin address.",
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    if (error || !data.user) {
      return { error: "That code is invalid or expired. Request a new code." };
    }

    const { data: canAccessAdmin, error: permissionError } = await supabase.rpc(
      "can_access_admin_portal",
    );
    if (permissionError || canAccessAdmin !== true) {
      await supabase.auth.signOut();
      return {
        error: "This email is not assigned to the DawaSetu admin workspace.",
      };
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("password_change_required")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profileError || !profile) {
      await supabase.auth.signOut();
      return { error: "Account security could not be verified. Please retry." };
    }

    const destination = profile.password_change_required
      ? "/change-password?next=%2Fadmin"
      : "/admin";
    return await redirectAfterAuthentication(supabase, destination);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return clientError();
  }
}

export async function signUpAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const fullName = textField(formData, "full_name").trim();
  const email = normalizedEmail(textField(formData, "email"));
  const password = textField(formData, "password");
  if (fullName.length < 2 || fullName.length > 160) {
    return { error: "Enter your name (2 to 160 characters)." };
  }
  if (!email) return { error: "Enter a valid email address." };
  if (!validPassword(password)) {
    return { error: "Use a password between 12 and 128 characters." };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${siteOrigin()}/auth/callback?next=/account`,
      },
    });
    if (error)
      return {
        error:
          "We could not create the account. Check your details and try again.",
      };
    if (data.session)
      return await redirectAfterAuthentication(supabase, "/account");
    // Supabase may return a user without identities for an existing email. Keep
    // the response identical so the registration form cannot enumerate users.
    redirect("/check-email");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return clientError();
  }
}

export async function requestPasswordResetAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = normalizedEmail(textField(formData, "email"));
  if (!email) return { error: "Enter a valid email address." };

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteOrigin()}/auth/callback?next=/reset-password`,
    });
  } catch {
    // Do not reveal whether the account exists or whether mail delivery failed.
  }
  return {
    message:
      "If an account matches that email, password reset instructions will arrive shortly.",
  };
}

export async function updatePasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = textField(formData, "password");
  const confirmation = textField(formData, "confirm_password");
  if (!validPassword(password))
    return { error: "Use a password between 12 and 128 characters." };
  if (password !== confirmation)
    return { error: "The passwords do not match." };

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user)
      return {
        error: "This reset link is invalid or has expired. Request a new one.",
      };
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("password_change_required")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile)
      return { error: "Account security could not be verified. Please retry." };

    // Check that privileged configuration exists before changing the password,
    // so an admin cannot be left locked out after a successful Auth update.
    const admin = profile.password_change_required
      ? createSupabaseAdminClient()
      : null;
    const { error } = await supabase.auth.updateUser({ password });
    if (error)
      return {
        error:
          "The password could not be updated. Request a new reset link and try again.",
      };
    if (admin) {
      const { error: clearError } = await admin
        .from("users")
        .update({ password_change_required: false })
        .eq("id", user.id)
        .eq("password_change_required", true);
      if (clearError)
        return {
          error:
            "Your password changed, but account setup could not finish. Submit your new password once more or contact support.",
        };
    }
    const nextPath = getSafeNextPath(textField(formData, "next"));
    redirect(nextPath ?? "/account");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return clientError();
  }
}

export async function signOutAction(): Promise<never> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
