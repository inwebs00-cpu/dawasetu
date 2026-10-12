import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { createRazorpayOrder } from "@/lib/payments/razorpay";
import { isSameOriginRequest } from "@/lib/payments/request-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f-]{36}$/i;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }
  let body: { businessId?: unknown; planId?: unknown; interval?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (
    typeof body.businessId !== "string" ||
    !uuidPattern.test(body.businessId) ||
    typeof body.planId !== "string" ||
    !uuidPattern.test(body.planId) ||
    (body.interval !== "monthly" && body.interval !== "yearly")
  ) {
    return NextResponse.json(
      { error: "Choose a valid plan." },
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
        { error: "Sign in to continue." },
        { status: 401 },
      );
    }
    const { data: profile } = await supabase
      .from("users")
      .select("status, full_name, phone_e164")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.status !== "active") {
      return NextResponse.json(
        { error: "This account cannot make payments." },
        { status: 403 },
      );
    }

    const { data: quoteRows, error: quoteError } = await supabase.rpc(
      "get_my_subscription_purchase_quote",
      {
        p_business_id: body.businessId,
        p_plan_id: body.planId,
        p_billing_interval: body.interval,
      },
    );
    const quote = Array.isArray(quoteRows) ? quoteRows[0] : null;
    if (quoteError || !quote) {
      return NextResponse.json(
        { error: "This business or plan is not eligible for checkout." },
        { status: 403 },
      );
    }

    const receipt = `ds_${randomUUID().replaceAll("-", "")}`;
    const { order, keyId } = await createRazorpayOrder({
      amountPaise: Number(quote.amount_paise),
      receipt,
      businessId: body.businessId,
      planId: body.planId,
    });
    const { error: recordError } = await supabase.rpc(
      "create_my_subscription_payment_order",
      {
        p_business_id: body.businessId,
        p_plan_id: body.planId,
        p_billing_interval: body.interval,
        p_razorpay_order_id: order.id,
        p_amount_paise: order.amount,
      },
    );
    if (recordError) {
      return NextResponse.json(
        {
          error: "The payment order could not be linked to this subscription.",
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        keyId,
        orderId: order.id,
        amountPaise: order.amount,
        currency: order.currency,
        planName: quote.plan_name,
        businessName: quote.business_name,
        prefill: {
          name: profile.full_name,
          email: user.email ?? "",
          contact: profile.phone_e164 ?? "",
        },
      },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Checkout is temporarily unavailable." },
      { status: 503 },
    );
  }
}
