import Link from "next/link";
import type { Metadata } from "next";

import { SubscriptionCheckout } from "@/components/billing/subscription-checkout";
import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireBusinessPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Subscription and payments" };

type PageParams = Promise<{ businessId: string }>;

interface BusinessSummary {
  business_id: string;
  business_name: string;
  business_status: string;
}
interface PlanOption {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_price_inr: number;
  yearly_price_inr: number;
  features: Record<string, boolean>;
  team_member_limit: number | null;
  inventory_limit: number | null;
  trial_days: number;
}
interface SubscriptionHistory {
  subscription_id: string;
  plan_name: string;
  status: string;
  billing_interval: string;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
}
interface PaymentHistory {
  payment_id: string;
  plan_name: string | null;
  amount_inr: number;
  currency: string;
  status: string;
  provider: string;
  paid_at: string | null;
  created_at: string;
}

export default async function PartnerBillingPage({
  params,
}: {
  params: PageParams;
}) {
  const { businessId } = await params;
  const { supabase } = await requireBusinessPermission(
    businessId,
    "payments.manage",
  );
  const [businessResult, plansResult, subscriptionsResult, paymentsResult] =
    await Promise.all([
      supabase.rpc("list_my_businesses"),
      supabase
        .from("subscription_plans")
        .select(
          "id, name, slug, description, monthly_price_inr, yearly_price_inr, features, team_member_limit, inventory_limit, trial_days",
        )
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase.rpc("list_my_subscription_history", {
        p_business_id: businessId,
      }),
      supabase.rpc("list_my_payment_history", { p_business_id: businessId }),
    ]);
  const business = ((businessResult.data ?? []) as BusinessSummary[]).find(
    (item) => item.business_id === businessId,
  );
  if (!business)
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title="Business billing unavailable"
            description="This business is not in your active permissions."
          />
        </div>
      </main>
    );
  const plans = (plansResult.data ?? []) as PlanOption[];
  const subscriptions = (subscriptionsResult.data ??
    []) as SubscriptionHistory[];
  const payments = (paymentsResult.data ?? []) as PaymentHistory[];
  const currentSubscription = subscriptions.find(
    (item) =>
      ["active", "trialing"].includes(item.status) &&
      (!item.current_period_end ||
        new Date(item.current_period_end).getTime() > Date.now()),
  );
  const checkoutEnabled = Boolean(
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET &&
    process.env.RAZORPAY_WEBHOOK_SECRET,
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/partner/${businessId}`}>Dashboard</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/account">Account</Link>
            </Button>
          </div>
        </header>
        <p className="text-sm font-semibold text-teal-800">Business billing</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Subscription and payments
        </h1>
        <p className="mt-2 text-sm text-slate-600">{business.business_name}</p>
        {business.business_status !== "approved" && (
          <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            This business must be approved before it can start a paid plan or
            trial.
          </p>
        )}
        {currentSubscription ? (
          <Card className="mt-6">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>
                  Current plan: {currentSubscription.plan_name}
                </CardTitle>
                <StatusBadge status={currentSubscription.status} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Billing interval: {currentSubscription.billing_interval}
              </p>
              {currentSubscription.current_period_end && (
                <p className="mt-1 text-sm text-slate-600">
                  Access until{" "}
                  {new Date(
                    currentSubscription.current_period_end,
                  ).toLocaleDateString("en-IN", { dateStyle: "long" })}
                </p>
              )}
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Plans renew manually from this page. Payment credentials stay on
                the server.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-6">
            <EmptyState
              title="No active subscription"
              description="Choose a plan below to start access. Your current plan remains active until its period ends or a replacement payment succeeds."
            />
          </div>
        )}
        <section className="mt-7">
          <h2 className="mb-3 text-xl font-semibold text-slate-950">
            Available plans
          </h2>
          <SubscriptionCheckout
            businessId={businessId}
            plans={plans}
            enabled={checkoutEnabled && business.business_status === "approved"}
          />
        </section>
        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Subscription history</CardTitle>
            </CardHeader>
            <CardContent>
              {subscriptionsResult.error ? (
                <p className="text-sm text-rose-800">
                  Subscription history is temporarily unavailable.
                </p>
              ) : subscriptions.length === 0 ? (
                <p className="text-sm text-slate-600">
                  No subscription records yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {subscriptions.map((subscription) => (
                    <div
                      key={subscription.subscription_id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {subscription.plan_name} ·{" "}
                          {subscription.billing_interval}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {subscription.current_period_end
                            ? `Until ${new Date(subscription.current_period_end).toLocaleDateString("en-IN")}`
                            : `Created ${new Date(subscription.created_at).toLocaleDateString("en-IN")}`}
                        </p>
                      </div>
                      <StatusBadge status={subscription.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Payment history</CardTitle>
            </CardHeader>
            <CardContent>
              {paymentsResult.error ? (
                <p className="text-sm text-rose-800">
                  Payment history is temporarily unavailable.
                </p>
              ) : payments.length === 0 ? (
                <p className="text-sm text-slate-600">No payments recorded.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {payments.map((payment) => (
                    <div
                      key={payment.payment_id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {payment.plan_name ?? "DawaSetu subscription"} · ₹
                          {Number(payment.amount_inr).toLocaleString("en-IN")}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {payment.paid_at
                            ? `Paid ${new Date(payment.paid_at).toLocaleDateString("en-IN")}`
                            : `Created ${new Date(payment.created_at).toLocaleDateString("en-IN")}`}{" "}
                          · {payment.provider}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={payment.status} />
                        {payment.status === "paid" && (
                          <Button asChild size="sm" variant="outline">
                            <Link
                              href={`/partner/${businessId}/billing/invoices/${payment.payment_id}`}
                            >
                              Receipt
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
