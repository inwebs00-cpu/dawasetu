import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const encryptionKeyPattern = /^[A-Za-z0-9+/]{43}=?$/;

function encryptionKey() {
  const encoded = process.env.PAYMENT_CONFIG_ENCRYPTION_KEY;
  if (!encoded || !encryptionKeyPattern.test(encoded)) {
    throw new Error("Payment configuration encryption is not configured.");
  }
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("Payment configuration encryption is not configured.");
  }
  return key;
}

export function isPaymentConfigEncryptionConfigured() {
  try {
    encryptionKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptPaymentSecret(secret: string) {
  if (!secret || secret.length > 512) {
    throw new Error("Invalid payment gateway secret.");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptPaymentSecret(value: string) {
  const [version, encodedIv, encodedTag, encodedCiphertext, extra] =
    value.split(".");
  if (
    version !== "v1" ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext ||
    extra !== undefined
  ) {
    throw new Error("Stored payment gateway secret is invalid.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(encodedIv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
