import "server-only";

import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

function derive(pin: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      pin,
      salt,
      64,
      { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error);
        else resolve(key as Buffer);
      },
    );
  });
}

export async function hashSecurityPin(pin: string) {
  if (!/^\d{6}$/.test(pin)) throw new Error("Invalid security PIN.");
  const salt = randomBytes(16);
  const hash = await derive(pin, salt);
  return `scrypt$16384$8$1$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifySecurityPinHash(pin: string, encodedHash: string) {
  const match = /^scrypt\$16384\$8\$1\$([0-9a-f]{32})\$([0-9a-f]{128})$/.exec(
    encodedHash,
  );
  if (!/^\d{6}$/.test(pin) || !match) return false;
  const expected = Buffer.from(match[2], "hex");
  const actual = await derive(pin, Buffer.from(match[1], "hex"));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hasRecentOtp(claims: Record<string, unknown> | undefined) {
  if (!claims || !Array.isArray(claims.amr)) return false;
  const now = Math.floor(Date.now() / 1000);
  return claims.amr.some((item) => {
    if (!item || typeof item !== "object") return false;
    const method = (item as { method?: unknown }).method;
    const timestamp = (item as { timestamp?: unknown }).timestamp;
    return (
      (method === "otp" || method === "magiclink") &&
      typeof timestamp === "number" &&
      timestamp <= now + 30 &&
      now - timestamp <= 10 * 60
    );
  });
}
