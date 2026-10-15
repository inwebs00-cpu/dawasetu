"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformPermission } from "@/lib/auth/authorization";
import { verifyCurrentPassword } from "@/lib/auth/verify-current-password";
import {
  createRazorpayRefund,
  isRazorpayRefundConfigured,
} from "@/lib/payments/razorpay";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item.trim() : "";
}

function parseAmountPaise(value: string) {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) return null;
  const [rupees, paise = ""] = value.split(".");
  const amount = Number(rupees) * 100 + Number((paise + "00").slice(0, 2));
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 2_147_483_647
    ? amount
    : null;
}

export async function requestPaymentRefundAction(formData: FormData) {
  const paymentId = value(formData, "payment_id");
  const refundAmount = value(formData, "amount_inr");
  const reason = value(formData, "reason");
  const password = value(formData, "current_password");
  const amountPaise = parseAmountPaise(refundAmount);
  if (
    !/^[0-9a-f-]{36}$/i.test(paymentId) ||
    amountPaise === null ||
    reason.length < 1 ||
    reason.length > 500 ||
    password.length < 12 ||
    value(formData, "confirm_refund") !== "yes"
  ) {
    redirect("/admin/refunds?error=invalid");
  }

  const { supabase, user } = await requirePlatformPermission("payments.manage");
  if (!user.email || !(await verifyCurrentPassword(user.email, password))) {
    redirect("/admin/refunds?error=reauth");
  }
  if (!(await isRazorpayRefundConfigured())) {
    redirect("/admin/refunds?error=unconfigured");
  }

  let refundRequestId = "";
  let providerPaymentId = "";
  try {
    const { data, error } = await supabase.rpc("admin_reserve_payment_refund", {
      p_payment_id: paymentId,
      p_amount_paise: amountPaise,
      p_reason: reason,
    });
    const reservation = Array.isArray(data) ? data[0] : null;
    if (
      error ||
      !reservation ||
      typeof reservation.refund_request_id !== "string" ||
      typeof reservation.provider_payment_id !== "string"
    ) {
      redirect("/admin/refunds?error=reserve");
    }
    refundRequestId = reservation.refund_request_id;
    providerPaymentId = reservation.provider_payment_id;
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/admin/refunds?error=reserve");
  }

  try {
    const providerResponse = await createRazorpayRefund({
      paymentId: providerPaymentId,
      amountPaise,
      refundRequestId,
      reason,
    });
    const admin = createSupabaseAdminClient();
    if (providerResponse.status >= 400 && providerResponse.status < 500) {
      await admin.rpc("service_update_payment_refund_request", {
        p_refund_request_id: refundRequestId,
        p_status: "failed",
        p_provider_refund_id: null,
      });
      redirect("/admin/refunds?error=provider_rejected");
    }
    const refund = providerResponse.refund;
    if (
      providerResponse.status < 200 ||
      providerResponse.status >= 300 ||
      !refund ||
      !/^rfnd_[A-Za-z0-9]+$/.test(refund.id) ||
      refund.payment_id !== providerPaymentId ||
      refund.amount !== amountPaise ||
      refund.currency !== "INR"
    ) {
      redirect("/admin/refunds?error=pending");
    }

    if (refund.status === "processed") {
      const { error } = await admin.rpc(
        "service_process_payment_refund_event",
        {
          p_event_id: `api-${refund.id}`,
          p_refund_request_id: refundRequestId,
          p_provider_payment_id: providerPaymentId,
          p_provider_refund_id: refund.id,
          p_amount_paise: refund.amount,
          p_currency: refund.currency,
        },
      );
      if (error) redirect("/admin/refunds?error=pending");
    } else {
      const { error } = await admin.rpc(
        "service_update_payment_refund_request",
        {
          p_refund_request_id: refundRequestId,
          p_status: "pending",
          p_provider_refund_id: refund.id,
        },
      );
      if (error) redirect("/admin/refunds?error=pending");
    }
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    // A timeout or 5xx response can be ambiguous, so the reserved amount stays
    // locked until a finance operator reconciles it in the Razorpay dashboard.
    redirect("/admin/refunds?error=pending");
  }

  revalidatePath("/admin/refunds");
  revalidatePath("/admin/analytics");
  redirect("/admin/refunds?updated=1");
}
