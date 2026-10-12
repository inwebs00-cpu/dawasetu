// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createRazorpayRefund } from "@/lib/payments/razorpay";

describe("Razorpay refund requests", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends only server credentials and includes an idempotent reconciliation reference", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "key_test_dawasetu");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "server_secret_for_tests");
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: "rfnd_Refund123",
            payment_id: "pay_Refund123",
            amount: 12550,
            currency: "INR",
            status: "pending",
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createRazorpayRefund({
      paymentId: "pay_Refund123",
      amountPaise: 12550,
      refundRequestId: "2ec8b53e-2bc2-4cd0-bec1-46d05e179c44",
      reason: "Duplicate subscription payment",
    });

    expect(result.status).toBe(200);
    expect(result.refund).toMatchObject({
      id: "rfnd_Refund123",
      payment_id: "pay_Refund123",
      amount: 12550,
      currency: "INR",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "https://api.razorpay.com/v1/payments/pay_Refund123/refund",
    );
    expect(options.method).toBe("POST");
    expect(new Headers(options.headers).get("authorization")).toBe(
      `Basic ${Buffer.from("key_test_dawasetu:server_secret_for_tests").toString("base64")}`,
    );
    expect(JSON.parse(String(options.body))).toEqual({
      amount: 12550,
      notes: {
        dawasetu_refund_request_id: "2ec8b53e-2bc2-4cd0-bec1-46d05e179c44",
        dawasetu_reason: "Duplicate subscription payment",
      },
    });
  });

  it("preserves the provider response status so ambiguous failures remain reserved", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "key_test_dawasetu");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "server_secret_for_tests");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 503 })),
    );

    const result = await createRazorpayRefund({
      paymentId: "pay_Refund123",
      amountPaise: 10000,
      refundRequestId: "2ec8b53e-2bc2-4cd0-bec1-46d05e179c44",
      reason: "Customer cancellation",
    });

    expect(result).toEqual({ status: 503, refund: null });
  });
});
