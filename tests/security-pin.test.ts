// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  hasRecentOtp,
  hashSecurityPin,
  verifySecurityPinHash,
} from "@/lib/security/security-pin";

describe("security PIN handling", () => {
  it("stores a unique salted scrypt hash for six-digit PINs", async () => {
    const first = await hashSecurityPin("804291");
    const second = await hashSecurityPin("804291");

    expect(first).toMatch(/^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(second).toMatch(
      /^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/,
    );
    expect(first).not.toBe(second);
    expect(first).not.toContain("804291");
    await expect(verifySecurityPinHash("804291", first)).resolves.toBe(true);
    await expect(verifySecurityPinHash("804292", first)).resolves.toBe(false);
    await expect(hashSecurityPin("12345")).rejects.toThrow(/invalid/i);
  });

  it("accepts only a recent OTP authentication claim", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(
      hasRecentOtp({ amr: [{ method: "otp", timestamp: now - 30 }] }),
    ).toBe(true);
    expect(
      hasRecentOtp({ amr: [{ method: "password", timestamp: now - 30 }] }),
    ).toBe(false);
    expect(
      hasRecentOtp({ amr: [{ method: "otp", timestamp: now - 601 }] }),
    ).toBe(false);
    expect(
      hasRecentOtp({ amr: [{ method: "otp", timestamp: now + 31 }] }),
    ).toBe(false);
  });
});
