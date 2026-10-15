import { NextResponse } from "next/server";

import {
  verifyWebhookSignature,
  webhookEventId,
} from "@/lib/payments/razorpay";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RazorpayWebhook {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: unknown;
        order_id?: unknown;
        amount?: unknown;
        currency?: unknown;
        status?: unknown;
      };
    };
    refund?: {
      entity?: {
        id?: unknown;
        payment_id?: unknown;
        amount?: unknown;
        currency?: unknown;
        status?: unknown;
        notes?: Record<string, unknown>;
      };
    };
  };
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 1_000_000) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }
  const rawBody = await request.text();
  if (rawBody.length > 1_000_000) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 401 },
    );
  }
  try {
    if (!(await verifyWebhookSignature(rawBody, signature))) {
      return NextResponse.json(
        { error: "Invalid webhook signature." },
        { status: 401 },
      );
    }
    const event = JSON.parse(rawBody) as RazorpayWebhook;
    if (event.event === "refund.processed") {
      const refund = event.payload?.refund?.entity;
      const refundRequestId = refund?.notes?.dawasetu_refund_request_id;
      if (typeof refundRequestId !== "string") {
        return NextResponse.json({ received: true, ignored: true });
      }
      if (
        typeof refund?.id !== "string" ||
        !/^rfnd_[A-Za-z0-9]+$/.test(refund.id) ||
        typeof refund.payment_id !== "string" ||
        !/^pay_[A-Za-z0-9]+$/.test(refund.payment_id) ||
        typeof refund.amount !== "number" ||
        !Number.isSafeInteger(refund.amount) ||
        refund.currency !== "INR" ||
        refund.status !== "processed" ||
        !/^[0-9a-f-]{36}$/i.test(refundRequestId)
      ) {
        return NextResponse.json(
          { error: "Invalid refund event." },
          { status: 400 },
        );
      }
      const admin = createSupabaseAdminClient();
      const { error } = await admin.rpc(
        "service_process_payment_refund_event",
        {
          p_event_id: webhookEventId(
            rawBody,
            request.headers.get("x-razorpay-event-id"),
          ),
          p_refund_request_id: refundRequestId,
          p_provider_payment_id: refund.payment_id,
          p_provider_refund_id: refund.id,
          p_amount_paise: refund.amount,
          p_currency: refund.currency,
        },
      );
      if (error) {
        return NextResponse.json(
          { error: "Refund webhook processing failed." },
          { status: 500 },
        );
      }
      return NextResponse.json({ received: true });
    }
    if (
      event.event !== "payment.captured" &&
      event.event !== "payment.failed"
    ) {
      return NextResponse.json({ received: true, ignored: true });
    }
    const entity = event.payload?.payment?.entity;
    if (
      typeof entity?.id !== "string" ||
      !/^pay_[A-Za-z0-9]+$/.test(entity.id) ||
      typeof entity.order_id !== "string" ||
      !/^order_[A-Za-z0-9]+$/.test(entity.order_id) ||
      typeof entity.amount !== "number" ||
      entity.currency !== "INR" ||
      (event.event === "payment.captured" && entity.status !== "captured")
    ) {
      return NextResponse.json(
        { error: "Invalid payment event." },
        { status: 400 },
      );
    }
    const id = webhookEventId(
      rawBody,
      request.headers.get("x-razorpay-event-id"),
    );
    const admin = createSupabaseAdminClient();
    const { error } = await admin.rpc(
      "service_process_razorpay_payment_event",
      {
        p_event_id: id,
        p_razorpay_order_id: entity.order_id,
        p_razorpay_payment_id: entity.id,
        p_amount_paise: entity.amount,
        p_currency: entity.currency,
        p_event_type: event.event,
      },
    );
    if (error)
      return NextResponse.json(
        { error: "Webhook processing failed." },
        { status: 500 },
      );
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }
}
