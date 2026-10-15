import { NextResponse } from "next/server";

import {
  fetchRazorpayPayment,
  verifyCheckoutSignature,
} from "@/lib/payments/razorpay";
import { isSameOriginRequest } from "@/lib/payments/request-origin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }
  let body: {
    razorpay_order_id?: unknown;
    razorpay_payment_id?: unknown;
    razorpay_signature?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid payment response." },
      { status: 400 },
    );
  }
  const orderId = body.razorpay_order_id;
  const paymentId = body.razorpay_payment_id;
  const signature = body.razorpay_signature;
  if (
    typeof orderId !== "string" ||
    !/^order_[A-Za-z0-9]+$/.test(orderId) ||
    typeof paymentId !== "string" ||
    !/^pay_[A-Za-z0-9]+$/.test(paymentId) ||
    typeof signature !== "string"
  ) {
    return NextResponse.json(
      { error: "Invalid payment response." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Sign in to verify this payment." },
        { status: 401 },
      );
    }
    const { data: paymentRows, error: paymentError } = await supabase.rpc(
      "get_my_razorpay_order",
      { p_razorpay_order_id: orderId },
    );
    const paymentRecord = Array.isArray(paymentRows) ? paymentRows[0] : null;
    if (paymentError || !paymentRecord) {
      return NextResponse.json(
        { error: "Payment order was not found for this account." },
        { status: 404 },
      );
    }
    if (!(await verifyCheckoutSignature(orderId, paymentId, signature))) {
      return NextResponse.json(
        { error: "Payment signature could not be verified." },
        { status: 400 },
      );
    }
    const providerPayment = await fetchRazorpayPayment(paymentId);
    if (
      providerPayment.order_id !== orderId ||
      providerPayment.amount !== Number(paymentRecord.amount_paise) ||
      providerPayment.currency !== "INR"
    ) {
      return NextResponse.json(
        { error: "Payment details do not match the subscription order." },
        { status: 400 },
      );
    }
    if (providerPayment.status !== "captured" || !providerPayment.captured) {
      return NextResponse.json(
        {
          status: providerPayment.status,
          message: "Payment is awaiting capture confirmation.",
        },
        { status: 202, headers: { "cache-control": "no-store" } },
      );
    }
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc(
      "service_process_razorpay_payment_event",
      {
        p_event_id: `checkout-${paymentId}`,
        p_razorpay_order_id: orderId,
        p_razorpay_payment_id: paymentId,
        p_amount_paise: providerPayment.amount,
        p_currency: providerPayment.currency,
        p_event_type: "payment.captured",
      },
    );
    if (error || !data) {
      return NextResponse.json(
        { error: "Payment could not be applied to the subscription." },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { status: data },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Payment verification is temporarily unavailable." },
      { status: 503 },
    );
  }
}
