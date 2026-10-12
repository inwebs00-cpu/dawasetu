import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function safeHexEqual(expected: string, received: string) {
  if (
    !/^[a-f0-9]{64}$/i.test(received) ||
    expected.length !== received.length
  ) {
    return false;
  }
  return timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(received, "hex"),
  );
}

export function matchesCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string,
) {
  const expected = createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeHexEqual(expected, signature);
}

export function matchesWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
) {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeHexEqual(expected, signature);
}

export function paymentWebhookEventId(
  rawBody: string,
  headerValue: string | null,
) {
  if (headerValue && /^[A-Za-z0-9_-]{1,255}$/.test(headerValue))
    return headerValue;
  return createHash("sha256").update(rawBody).digest("hex");
}
