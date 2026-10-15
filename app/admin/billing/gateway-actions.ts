"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformPermission } from "@/lib/auth/authorization";
import { verifyCurrentPassword } from "@/lib/auth/verify-current-password";
import {
  encryptPaymentSecret,
  isPaymentConfigEncryptionConfigured,
} from "@/lib/payments/gateway-secrets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

async function verifyFinancePassword(password: string) {
  const context = await requirePlatformPermission("payments.manage");
  const { user } = context;
  if (!user.email || !(await verifyCurrentPassword(user.email, password))) {
    redirect("/admin/billing?error=reauth");
  }
  return context;
}

export async function saveRazorpayGatewayAction(formData: FormData) {
  const gatewayId = value(formData, "gateway_id");
  const displayName = value(formData, "display_name");
  const keyId = value(formData, "key_id");
  const keySecret = value(formData, "key_secret");
  const webhookSecret = value(formData, "webhook_secret");
  const mode = value(formData, "mode");
  const password = value(formData, "current_password");
  const enabled = formData.get("enabled") === "on";

  if (
    (gatewayId && !/^[0-9a-f-]{36}$/i.test(gatewayId)) ||
    displayName.length < 2 ||
    displayName.length > 80 ||
    keyId.length < 12 ||
    keyId.length > 128 ||
    (mode !== "test" && mode !== "live") ||
    (mode === "test" && !keyId.startsWith("rzp_test_")) ||
    (mode === "live" && !keyId.startsWith("rzp_live_")) ||
    keySecret.length > 512 ||
    webhookSecret.length > 512 ||
    password.length < 12
  ) {
    redirect("/admin/billing?error=invalid");
  }

  const { supabase } = await verifyFinancePassword(password);

  const admin = createSupabaseAdminClient();
  let existing: {
    encrypted_key_secret: string;
    encrypted_webhook_secret: string;
  } | null = null;
  if (gatewayId) {
    const { data, error } = await admin
      .from("payment_gateway_configurations")
      .select("encrypted_key_secret, encrypted_webhook_secret")
      .eq("id", gatewayId)
      .eq("provider", "razorpay")
      .maybeSingle();
    if (error || !data) redirect("/admin/billing?error=save");
    existing = data;
  }

  if (!gatewayId && (!keySecret || !webhookSecret)) {
    redirect("/admin/billing?error=secrets");
  }
  if ((keySecret || webhookSecret) && !isPaymentConfigEncryptionConfigured()) {
    redirect("/admin/billing?error=encryption");
  }

  let encryptedKeySecret = existing?.encrypted_key_secret ?? "";
  let encryptedWebhookSecret = existing?.encrypted_webhook_secret ?? "";
  try {
    if (keySecret) encryptedKeySecret = encryptPaymentSecret(keySecret);
    if (webhookSecret) {
      encryptedWebhookSecret = encryptPaymentSecret(webhookSecret);
    }
  } catch {
    redirect("/admin/billing?error=encryption");
  }
  if (!encryptedKeySecret || !encryptedWebhookSecret) {
    redirect("/admin/billing?error=secrets");
  }

  const { error } = await supabase.rpc("admin_save_payment_gateway", {
    p_gateway_id: gatewayId || null,
    p_provider: "razorpay",
    p_display_name: displayName,
    p_key_id: keyId,
    p_encrypted_key_secret: encryptedKeySecret,
    p_encrypted_webhook_secret: encryptedWebhookSecret,
    p_mode: mode,
    p_enabled: enabled,
  });
  if (error) redirect("/admin/billing?error=save");

  revalidatePath("/admin/billing");
  redirect("/admin/billing?updated=gateway");
}

export async function deleteRazorpayGatewayAction(formData: FormData) {
  const gatewayId = value(formData, "gateway_id");
  const password = value(formData, "current_password");
  if (
    !/^[0-9a-f-]{36}$/i.test(gatewayId) ||
    password.length < 12 ||
    value(formData, "confirm_remove") !== "yes"
  ) {
    redirect("/admin/billing?error=invalid");
  }

  const { supabase } = await verifyFinancePassword(password);
  const { error } = await supabase.rpc("admin_delete_payment_gateway", {
    p_gateway_id: gatewayId,
  });
  if (error) redirect("/admin/billing?error=delete");

  revalidatePath("/admin/billing");
  redirect("/admin/billing?updated=removed");
}
