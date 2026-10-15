import "server-only";

import { decryptPaymentSecret } from "@/lib/payments/gateway-secrets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface RazorpayConfiguration {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  enabled: boolean;
  mode: "test" | "live";
}

function environmentConfiguration(): RazorpayConfiguration | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  if (!keyId || !keySecret) return null;
  return {
    keyId,
    keySecret,
    webhookSecret,
    enabled: true,
    mode: keyId.startsWith("rzp_live_") ? "live" : "test",
  };
}

export async function getRazorpayConfiguration(): Promise<RazorpayConfiguration | null> {
  const fallback = environmentConfiguration();
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return fallback;
  }

  let adminManaged = false;
  try {
    const admin = createSupabaseAdminClient();
    const { data: state, error: stateError } = await admin
      .from("payment_gateway_state")
      .select("admin_managed")
      .eq("id", true)
      .maybeSingle();
    if (stateError) {
      if (["42P01", "PGRST205"].includes(stateError.code ?? "")) {
        return fallback;
      }
      throw new Error("Could not load payment gateway status.");
    }
    adminManaged = state?.admin_managed === true;
    if (!adminManaged) return fallback;

    const { data: config, error } = await admin
      .from("payment_gateway_configurations")
      .select(
        "key_id, encrypted_key_secret, encrypted_webhook_secret, mode, enabled",
      )
      .eq("provider", "razorpay")
      .maybeSingle();
    if (error) throw new Error("Could not load payment gateway settings.");
    if (!config) return null;

    return {
      keyId: config.key_id,
      keySecret: decryptPaymentSecret(config.encrypted_key_secret),
      webhookSecret: decryptPaymentSecret(config.encrypted_webhook_secret),
      enabled: config.enabled,
      mode: config.mode,
    };
  } catch (error) {
    if (adminManaged) throw error;
    return fallback;
  }
}

export async function isRazorpayCheckoutConfigured() {
  try {
    const config = await getRazorpayConfiguration();
    return Boolean(config?.enabled && config.webhookSecret);
  } catch {
    return false;
  }
}

export async function isRazorpayRefundConfigured() {
  try {
    const config = await getRazorpayConfiguration();
    return Boolean(config?.keyId && config.keySecret && config.webhookSecret);
  } catch {
    return false;
  }
}
