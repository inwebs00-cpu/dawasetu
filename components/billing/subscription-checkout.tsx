"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    Razorpay?: new (
      options: RazorpayCheckoutOptions,
    ) => RazorpayCheckoutInstance;
  }
}

interface RazorpayCallback {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  handler: (response: RazorpayCallback) => void;
  modal: { ondismiss: () => void };
}

interface RazorpayCheckoutInstance {
  open: () => void;
  on: (event: string, callback: (response: unknown) => void) => void;
}

interface PlanOption {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_price_inr: number;
  yearly_price_inr: number;
  trial_days: number;
  features: Record<string, boolean>;
  team_member_limit: number | null;
  inventory_limit: number | null;
}

export function SubscriptionCheckout({
  businessId,
  plans,
  enabled,
}: {
  businessId: string;
  plans: PlanOption[];
  enabled: boolean;
}) {
  const router = useRouter();
  const [scriptReady, setScriptReady] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function startTrial(plan: PlanOption) {
    setBusy(`${plan.id}:trial`);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/billing/trial", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessId,
          planId: plan.id,
          interval: "monthly",
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Trial could not be started.");
      setMessage(`${plan.trial_days}-day trial started.`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Trial could not be started.",
      );
    } finally {
      setBusy("");
    }
  }

  async function checkout(plan: PlanOption, interval: "monthly" | "yearly") {
    setBusy(`${plan.id}:${interval}`);
    setError("");
    setMessage("");
    try {
      if (!scriptReady || !window.Razorpay) {
        throw new Error(
          "Secure checkout is still loading. Try again in a moment.",
        );
      }
      const response = await fetch("/api/billing/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ businessId, planId: plan.id, interval }),
      });
      const order = (await response.json()) as {
        error?: string;
        keyId: string;
        orderId: string;
        amountPaise: number;
        currency: string;
        planName: string;
        businessName: string;
        prefill: { name: string; email: string; contact: string };
      };
      if (!response.ok)
        throw new Error(order.error ?? "Checkout could not be started.");
      const checkoutWindow = new window.Razorpay({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: "DawaSetu",
        description: `${order.planName} for ${order.businessName}`,
        order_id: order.orderId,
        prefill: order.prefill,
        theme: { color: "#0f766e" },
        handler: async (result) => {
          setBusy(`${plan.id}:verify`);
          try {
            const verification = await fetch("/api/billing/verify", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(result),
            });
            const verified = (await verification.json()) as {
              error?: string;
              status?: string;
              message?: string;
            };
            if (verification.status === 202) {
              setMessage(
                verified.message ?? "Payment is awaiting confirmation.",
              );
              router.refresh();
              return;
            }
            if (!verification.ok)
              throw new Error(verified.error ?? "Payment verification failed.");
            setMessage("Payment confirmed. Your subscription is active.");
            router.refresh();
          } catch (caught) {
            setError(
              caught instanceof Error
                ? caught.message
                : "Payment verification is pending.",
            );
          } finally {
            setBusy("");
          }
        },
        modal: { ondismiss: () => setBusy("") },
      });
      checkoutWindow.on("payment.failed", () => {
        setBusy("");
        setError("Payment did not complete. You can retry from this page.");
      });
      checkoutWindow.open();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Checkout is unavailable.",
      );
      setBusy("");
    }
  }

  return (
    <div>
      {enabled && (
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
          onLoad={() => setScriptReady(true)}
          onError={() =>
            setError("Secure checkout could not load. Please retry later.")
          }
        />
      )}
      {!enabled && (
        <p className="mb-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          Online payments are not configured for this deployment. Add Razorpay
          test or live keys and the webhook secret to enable checkout.
        </p>
      )}
      {message && (
        <p
          role="status"
          className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-900"
        >
          {error}
        </p>
      )}
      {plans.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          No active subscription plans are available.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <h3 className="text-lg font-semibold text-slate-950">
                {plan.name}
              </h3>
              {plan.description && (
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {plan.description}
                </p>
              )}
              <ul className="mt-3 grid gap-1 text-sm text-slate-600">
                <li>Team members: {plan.team_member_limit ?? "No limit"}</li>
                <li>Inventory items: {plan.inventory_limit ?? "No limit"}</li>
                {Object.entries(plan.features)
                  .filter(([, active]) => active)
                  .map(([feature]) => (
                    <li key={feature}>{feature.replaceAll("_", " ")}</li>
                  ))}
              </ul>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  disabled={!enabled || busy !== ""}
                  onClick={() => checkout(plan, "monthly")}
                >
                  ₹{Number(plan.monthly_price_inr).toLocaleString("en-IN")} /
                  month
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!enabled || busy !== ""}
                  onClick={() => checkout(plan, "yearly")}
                >
                  ₹{Number(plan.yearly_price_inr).toLocaleString("en-IN")} /
                  year
                </Button>
              </div>
              {enabled && plan.trial_days > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-2 w-full"
                  disabled={busy !== ""}
                  onClick={() => startTrial(plan)}
                >
                  Start {plan.trial_days}-day trial
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
