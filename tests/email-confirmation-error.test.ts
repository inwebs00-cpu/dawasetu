import { describe, expect, it, vi } from "vitest";

import {
  getSignupEmailError,
  logSignupEmailError,
} from "@/lib/auth/email-confirmation-error";

describe("signup confirmation errors", () => {
  it("explains when Supabase's default sender cannot send to public addresses", () => {
    expect(
      getSignupEmailError({
        code: "email_address_not_authorized",
        message: "Email address not authorized",
        status: 403,
      }),
    ).toContain("custom SMTP provider");
  });

  it("explains rate limits and redirect allow-list errors", () => {
    expect(
      getSignupEmailError({ status: 429, message: "Too many requests" }),
    ).toContain("Wait a minute");
    expect(getSignupEmailError({ code: "redirect_to_not_allowed" })).toContain(
      "allowed Redirect URLs",
    );
  });

  it("explains missing server configuration without exposing details", () => {
    expect(
      getSignupEmailError(
        new Error("Supabase server configuration is missing."),
      ),
    ).toContain("publishable key in Vercel Production settings");
  });

  it("logs only non-sensitive error metadata", () => {
    const error = new Error("SMTP rejected recipient@example.com");
    Object.assign(error, { code: "smtp_error", status: 502 });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    logSignupEmailError(error);

    expect(log).toHaveBeenCalledWith(
      "[signup] Supabase email confirmation request failed",
      { code: "smtp_error", status: 502 },
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain(
      "recipient@example.com",
    );
    log.mockRestore();
  });
});
