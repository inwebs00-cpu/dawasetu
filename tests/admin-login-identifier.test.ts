import { describe, expect, it } from "vitest";

import {
  ADMIN_LOGIN_EMAIL,
  resolveAdminLoginEmail,
} from "@/lib/auth/admin-login-identifier";

describe("admin sign-in identifier", () => {
  it("resolves the admin ID to the configured admin email", () => {
    expect(resolveAdminLoginEmail(" Projectmed ")).toBe(ADMIN_LOGIN_EMAIL);
    expect(resolveAdminLoginEmail("PROJECTMED")).toBe(ADMIN_LOGIN_EMAIL);
  });

  it("accepts an email address for password sign-in", () => {
    expect(resolveAdminLoginEmail(ADMIN_LOGIN_EMAIL)).toBe(ADMIN_LOGIN_EMAIL);
    expect(resolveAdminLoginEmail("  Admin@Example.com ")).toBe(
      "admin@example.com",
    );
  });

  it("rejects malformed identifiers", () => {
    expect(resolveAdminLoginEmail("")).toBeNull();
    expect(resolveAdminLoginEmail("Project Med")).toBeNull();
    expect(resolveAdminLoginEmail("x".repeat(255))).toBeNull();
  });
});
