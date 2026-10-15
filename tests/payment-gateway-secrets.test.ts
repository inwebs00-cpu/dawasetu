// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  decryptPaymentSecret,
  encryptPaymentSecret,
  isPaymentConfigEncryptionConfigured,
} from "@/lib/payments/gateway-secrets";

describe("payment gateway secret encryption", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("encrypts secrets with the configured key and decrypts them server-side", () => {
    const encryptionKey = Buffer.alloc(32, 7).toString("base64");
    vi.stubEnv("PAYMENT_CONFIG_ENCRYPTION_KEY", encryptionKey);

    const secret = "razorpay-server-secret-never-returned-to-the-client";
    const encrypted = encryptPaymentSecret(secret);

    expect(isPaymentConfigEncryptionConfigured()).toBe(true);
    expect(encrypted).not.toContain(secret);
    expect(encrypted.split(".")).toHaveLength(4);
    expect(decryptPaymentSecret(encrypted)).toBe(secret);
  });

  it("rejects tampered ciphertext and invalid encryption keys", () => {
    vi.stubEnv(
      "PAYMENT_CONFIG_ENCRYPTION_KEY",
      Buffer.alloc(32, 7).toString("base64"),
    );
    const encrypted = encryptPaymentSecret("gateway-secret");
    vi.stubEnv(
      "PAYMENT_CONFIG_ENCRYPTION_KEY",
      Buffer.alloc(32, 8).toString("base64"),
    );
    expect(() => decryptPaymentSecret(encrypted)).toThrow();
    vi.stubEnv("PAYMENT_CONFIG_ENCRYPTION_KEY", "not-a-key");
    expect(isPaymentConfigEncryptionConfigured()).toBe(false);
    expect(() => encryptPaymentSecret("gateway-secret")).toThrow();
  });
});
