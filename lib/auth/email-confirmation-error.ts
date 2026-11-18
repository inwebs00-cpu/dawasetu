type SupabaseAuthError = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
};

function errorDetails(error: unknown) {
  const details =
    error && typeof error === "object" ? (error as SupabaseAuthError) : {};
  const code = typeof details.code === "string" ? details.code : "";
  const message = typeof details.message === "string" ? details.message : "";
  const status = typeof details.status === "number" ? details.status : null;
  return {
    code,
    message,
    status,
    normalized: `${code} ${message}`.toLowerCase(),
  };
}

export function getSignupEmailError(error: unknown): string {
  const { normalized, status } = errorDetails(error);

  if (normalized.includes("next_public_site_url")) {
    return "The production verification URL is invalid. Set Vercel NEXT_PUBLIC_SITE_URL to https://www.dawasetu.online and redeploy.";
  }

  if (normalized.includes("supabase server configuration is missing")) {
    return "Email sign-up is not configured on the server. Check the Supabase URL and publishable key in Vercel Production settings.";
  }

  if (
    status === 429 ||
    normalized.includes("over_email_send_rate_limit") ||
    normalized.includes("rate limit")
  ) {
    return "Too many verification emails were requested. Wait a minute, then try again.";
  }

  if (
    normalized.includes("email address not authorized") ||
    normalized.includes("email_address_not_authorized")
  ) {
    return "Supabase’s default mail sender can only email project team addresses. Enable a working custom SMTP provider in Supabase Auth to send signup codes to everyone.";
  }

  if (normalized.includes("redirect") || normalized.includes("redirect_to")) {
    return "Supabase rejected the verification URL. Add https://www.dawasetu.online/auth/callback to Supabase Auth’s allowed Redirect URLs.";
  }

  if (
    normalized.includes("smtp") ||
    normalized.includes("email send") ||
    normalized.includes("mailer")
  ) {
    return "Supabase could not deliver the verification email. Check the Auth SMTP host, port, username, password, and verified sender address.";
  }

  return "We couldn’t start email verification. Check the email and password, then try again. If it continues, the email provider needs attention.";
}

export function logSignupEmailError(error: unknown) {
  const { code, status } = errorDetails(error);
  console.error("[signup] Supabase email confirmation request failed", {
    code: code || "unknown",
    status,
  });
}
