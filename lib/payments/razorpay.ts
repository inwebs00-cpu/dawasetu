import "server-only";

import {
  matchesCheckoutSignature,
  matchesWebhookSignature,
  paymentWebhookEventId,
} from "@/lib/payments/signatures";
import { getRazorpayConfiguration } from "@/lib/payments/gateway-config";
export { isRazorpayRefundConfigured } from "@/lib/payments/gateway-config";

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface RazorpayPayment {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: string;
  captured: boolean;
}

export interface RazorpayRefund {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status?: string;
}

async function credentials(requireEnabled = false) {
  const config = await getRazorpayConfiguration();
  if (
    !config?.keyId ||
    !config.keySecret ||
    (requireEnabled && (!config.enabled || !config.webhookSecret))
  ) {
    throw new Error("Razorpay is not configured.");
  }
  return { keyId: config.keyId, keySecret: config.keySecret };
}

function authorizationHeader(keyId: string, keySecret: string) {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

export async function createRazorpayOrder(input: {
  amountPaise: number;
  receipt: string;
  businessId: string;
  planId: string;
}) {
  const { keyId, keySecret } = await credentials(true);
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      authorization: authorizationHeader(keyId, keySecret),
      "content-type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.receipt,
      partial_payment: false,
      notes: {
        dawasetu_business_id: input.businessId,
        dawasetu_plan_id: input.planId,
      },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Could not create the payment order.");
  const order = (await response.json()) as RazorpayOrder;
  if (
    !/^order_[A-Za-z0-9]+$/.test(order.id) ||
    order.amount !== input.amountPaise ||
    order.currency !== "INR"
  ) {
    throw new Error("Payment provider returned an invalid order.");
  }
  return { order, keyId };
}

export async function fetchRazorpayPayment(paymentId: string) {
  const { keyId, keySecret } = await credentials();
  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: {
        authorization: authorizationHeader(keyId, keySecret),
        accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) throw new Error("Could not verify the payment status.");
  return (await response.json()) as RazorpayPayment;
}

export async function createRazorpayRefund(input: {
  paymentId: string;
  amountPaise: number;
  refundRequestId: string;
  reason: string;
}) {
  if (
    !/^pay_[A-Za-z0-9]+$/.test(input.paymentId) ||
    !Number.isSafeInteger(input.amountPaise) ||
    input.amountPaise <= 0 ||
    input.amountPaise > 2_147_483_647 ||
    !/^[0-9a-f-]{36}$/i.test(input.refundRequestId) ||
    !input.reason.trim()
  ) {
    throw new Error("Invalid refund request.");
  }
  const { keyId, keySecret } = await credentials();
  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(input.paymentId)}/refund`,
    {
      method: "POST",
      headers: {
        authorization: authorizationHeader(keyId, keySecret),
        "content-type": "application/json",
        accept: "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        amount: input.amountPaise,
        notes: {
          dawasetu_refund_request_id: input.refundRequestId,
          dawasetu_reason: input.reason.slice(0, 200),
        },
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) return { status: response.status, refund: null };
  const refund = (await response.json()) as RazorpayRefund;
  return { status: response.status, refund };
}

export async function verifyCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string,
) {
  const { keySecret } = await credentials();
  return matchesCheckoutSignature(orderId, paymentId, signature, keySecret);
}

export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
) {
  const config = await getRazorpayConfiguration();
  if (!config?.webhookSecret) {
    throw new Error("Razorpay webhook is not configured.");
  }
  return matchesWebhookSignature(rawBody, signature, config.webhookSecret);
}

export function webhookEventId(rawBody: string, headerValue: string | null) {
  return paymentWebhookEventId(rawBody, headerValue);
}
