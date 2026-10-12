import { NextResponse } from "next/server";

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
        { error: "Sign in to start a trial." },
        { status: 401 },
      );
    }
    const { data, error } = await supabase.rpc("start_my_subscription_trial", {
      p_business_id: body.businessId,
      p_plan_id: body.planId,
      p_billing_interval: body.interval,
    });
    if (error || !data) {
      return NextResponse.json(
        { error: "This business is not eligible for this plan trial." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { started: true },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Trials are temporarily unavailable." },
      { status: 503 },
    );
  }
}
