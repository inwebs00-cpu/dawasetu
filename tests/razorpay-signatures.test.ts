// @vitest-environment node

import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  matchesCheckoutSignature,
  matchesWebhookSignature,
  paymentWebhookEventId,
} from "@/lib/payments/signatures";

describe("Razorpay signature verification", () => {
  it("checks the server order and payment callback signature", () => {
    const input = "order_test123|pay_test456";
    const signature = createHmac("sha256", "checkout-secret")
      .update(input)
      .digest("hex");
    expect(
      matchesCheckoutSignature(
        "order_test123",
        "pay_test456",
        signature,
        "checkout-secret",
      ),
    ).toBe(true);
    expect(
      matchesCheckoutSignature(
        "order_wrong",
        "pay_test456",
        signature,
        "checkout-secret",
      ),
    ).toBe(false);
    expect(
      matchesCheckoutSignature(
        "order_test123",
        "pay_test456",
        "not-a-signature",
        "checkout-secret",
      ),
    ).toBe(false);
  });

  it("verifies webhook signatures against the exact raw payload", () => {
    const body = '{"event":"payment.captured","payload":{}}';
    const signature = createHmac("sha256", "webhook-secret")
      .update(body)
      .digest("hex");
    expect(matchesWebhookSignature(body, signature, "webhook-secret")).toBe(
      true,
    );
    expect(
      matchesWebhookSignature(`${body} `, signature, "webhook-secret"),
    ).toBe(false);
  });

  it("uses a provider event id or a stable body digest for deduplication", () => {
    const body = "signed payload";
    expect(paymentWebhookEventId(body, "evt_event123")).toBe("evt_event123");
    expect(paymentWebhookEventId(body, "invalid event id")).toBe(
      paymentWebhookEventId(body, null),
    );
    expect(paymentWebhookEventId(body, null)).not.toBe(
      paymentWebhookEventId(`${body}!`, null),
    );
  });
});
