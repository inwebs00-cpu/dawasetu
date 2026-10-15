import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePlatformPermission } from "@/lib/auth/authorization";
import { isPaymentConfigEncryptionConfigured } from "@/lib/payments/gateway-secrets";

import {
  deleteSubscriptionPlanAction,
  saveSubscriptionPlanAction,
} from "./actions";
import {
  deleteRazorpayGatewayAction,
  saveRazorpayGatewayAction,
} from "./gateway-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plans and billing" };

interface SubscriptionPlan {
  plan_id: string;
  plan_name: string;
  plan_slug: string;
  plan_description: string | null;
  monthly_price_inr: number;
  yearly_price_inr: number;
  features: Record<string, boolean>;
  team_member_limit: number | null;
  inventory_limit: number | null;
  trial_days: number;
  is_active: boolean;
  display_order: number;
  subscriber_count: number;
  updated_at: string;
}
interface PaymentGateway {
  gateway_id: string;
  provider: string;
  display_name: string;
  key_id: string;
  mode: "test" | "live";
  enabled: boolean;
  key_secret_configured: boolean;
  webhook_secret_configured: boolean;
  updated_at: string;
}
type SearchParams = Promise<{ updated?: string; error?: string }>;

function GatewayForm({
  gateway,
  encryptionConfigured,
  webhookUrl,
}: {
  gateway?: PaymentGateway;
  encryptionConfigured: boolean;
  webhookUrl: string;
}) {
  return (
    <div className="grid gap-5">
      {!encryptionConfigured && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          Before saving credentials, set the server-only
          PAYMENT_CONFIG_ENCRYPTION_KEY environment variable in Vercel and
          locally. Generate a 32-byte key as described in the README.
        </p>
      )}
      <p className="text-sm leading-6 text-slate-600">
        Razorpay is the currently integrated checkout provider. Credentials are
        encrypted before storage and secret values are never shown again. Use
        the exact webhook URL below in Razorpay and subscribe to
        payment.captured, payment.failed, and refund.processed.
      </p>
      <p className="rounded-lg bg-slate-50 p-3 font-mono text-xs break-all text-slate-700">
        {webhookUrl}
      </p>
      <form action={saveRazorpayGatewayAction} className="grid gap-4">
        <input
          type="hidden"
          name="gateway_id"
          value={gateway?.gateway_id ?? ""}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Gateway name
            <input
              name="display_name"
              required
              minLength={2}
              maxLength={80}
              defaultValue={gateway?.display_name ?? "Razorpay"}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Mode
            <select
              name="mode"
              defaultValue={gateway?.mode ?? "test"}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
            >
              <option value="test">Test</option>
              <option value="live">Live</option>
            </select>
          </label>
        </div>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Razorpay Key ID
          <input
            name="key_id"
            required
            minLength={12}
            maxLength={128}
            autoComplete="off"
            defaultValue={gateway?.key_id ?? ""}
            placeholder={gateway?.mode === "live" ? "rzp_live_…" : "rzp_test_…"}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Razorpay Key Secret
            <input
              name="key_secret"
              type="password"
              required={!gateway?.key_secret_configured}
              minLength={8}
              maxLength={512}
              autoComplete="new-password"
              placeholder={
                gateway?.key_secret_configured
                  ? "Saved securely; leave blank to keep it"
                  : "Paste the server-side key secret"
              }
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Webhook Secret
            <input
              name="webhook_secret"
              type="password"
              required={!gateway?.webhook_secret_configured}
              minLength={8}
              maxLength={512}
              autoComplete="new-password"
              placeholder={
                gateway?.webhook_secret_configured
                  ? "Saved securely; leave blank to keep it"
                  : "Paste the webhook signing secret"
              }
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-4 border-t border-slate-100 pt-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={gateway?.enabled ?? false}
              className="size-4 accent-teal-700"
            />
            Enable for new subscription checkouts
          </label>
          <label className="grid w-full max-w-xs gap-1 text-xs font-medium text-slate-700">
            Confirm current password
            <input
              type="password"
              name="current_password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="current-password"
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
            />
          </label>
          <Button type="submit">
            {gateway ? "Save gateway settings" : "Add Razorpay gateway"}
          </Button>
        </div>
      </form>
      {gateway && (
        <form
          action={deleteRazorpayGatewayAction}
          className="grid gap-3 border-t border-rose-100 pt-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"
        >
          <input type="hidden" name="gateway_id" value={gateway.gateway_id} />
          <label className="flex items-center gap-2 text-sm text-rose-900">
            <input
              type="checkbox"
              name="confirm_remove"
              value="yes"
              required
              className="size-4 accent-rose-700"
            />
            Remove from new checkouts; keep credentials for payment verification
            and refunds
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Confirm current password
            <input
              type="password"
              name="current_password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="current-password"
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
            />
          </label>
          <Button type="submit" variant="destructive">
            Remove gateway
          </Button>
        </form>
      )}
    </div>
  );
}

const features = [
  ["medicine_requests", "Medicine request access"],
  ["analytics", "Analytics"],
  ["featured_listing", "Featured listing"],
  ["promotions", "Promotions"],
  ["profile_media", "Profile photos and media"],
  ["team_members", "Additional team members"],
  ["inventory_exports", "Inventory exports"],
] as const;

function PlanForm({ plan }: { plan?: SubscriptionPlan }) {
  return (
    <form action={saveSubscriptionPlanAction} className="grid gap-4">
      <input type="hidden" name="plan_id" value={plan?.plan_id ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Plan name
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            defaultValue={plan?.plan_name}
            placeholder="Starter"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          URL slug
          <input
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={100}
            defaultValue={plan?.plan_slug}
            placeholder="starter"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Monthly price (₹)
          <input
            name="monthly_price_inr"
            type="number"
            required
            min="0"
            max="10000000"
            step="0.01"
            defaultValue={plan?.monthly_price_inr ?? 199}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Yearly price (₹)
          <input
            name="yearly_price_inr"
            type="number"
            required
            min="0"
            max="10000000"
            step="0.01"
            defaultValue={plan?.yearly_price_inr ?? 1990}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          />
        </label>
      </div>
      <label className="grid gap-1 text-xs font-medium text-slate-700">
        Description
        <textarea
          name="description"
          maxLength={1000}
          rows={2}
          defaultValue={plan?.plan_description ?? ""}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Team member limit
          <input
            name="team_member_limit"
            type="number"
            min="0"
            max="100000"
            defaultValue={plan?.team_member_limit ?? ""}
            placeholder="Unlimited"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Inventory item limit
          <input
            name="inventory_limit"
            type="number"
            min="0"
            max="10000000"
            defaultValue={plan?.inventory_limit ?? ""}
            placeholder="Unlimited"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Trial days
          <input
            name="trial_days"
            type="number"
            required
            min="0"
            max="90"
            defaultValue={plan?.trial_days ?? 0}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Display order
          <input
            name="display_order"
            type="number"
            required
            min="0"
            max="10000"
            defaultValue={plan?.display_order ?? 0}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          />
        </label>
      </div>
      <fieldset className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-2 text-xs font-semibold text-slate-700">
          Plan features
        </legend>
        {features.map(([key, label]) => (
          <label
            key={key}
            className="flex items-center gap-2 text-sm text-slate-700"
          >
            <input
              type="checkbox"
              name="feature_keys"
              value={key}
              defaultChecked={plan?.features?.[key] === true}
              className="size-4 accent-teal-700"
            />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-end gap-4 border-t border-slate-100 pt-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={plan?.is_active ?? true}
            className="size-4 accent-teal-700"
          />
          Plan is active
        </label>
        <label className="grid w-full max-w-xs gap-1 text-xs font-medium text-slate-700">
          Confirm current password
          <input
            type="password"
            name="current_password"
            required
            minLength={12}
            maxLength={128}
            autoComplete="current-password"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          />
        </label>
        <Button type="submit">{plan ? "Save plan" : "Create plan"}</Button>
      </div>
    </form>
  );
}

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const { supabase } = await requirePlatformPermission("payments.manage");
  const [planResult, gatewayResult] = await Promise.all([
    supabase.rpc("admin_list_subscription_plans"),
    supabase.rpc("admin_list_payment_gateways"),
  ]);
  const { data, error } = planResult;
  const plans = (data ?? []) as SubscriptionPlan[];
  const gateways = (gatewayResult.data ?? []) as PaymentGateway[];
  const gateway = gateways[0];
  const encryptionConfigured = isPaymentConfigEncryptionConfigured();
  const legacyEnvironmentConfigured = Boolean(
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET &&
    process.env.RAZORPAY_WEBHOOK_SECRET,
  );
  const webhookUrl = `${(process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-domain").replace(/\/$/, "")}/api/webhooks/razorpay`;
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin">Dashboard</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Finance administration
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Plans and billing
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Manage editable INR subscription plans. Prices apply to new
          subscriptions; recorded payment amounts remain unchanged.
        </p>
        {params.updated && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"
          >
            {params.updated === "gateway"
              ? "Razorpay settings saved. New checkouts now follow these settings."
              : params.updated === "removed"
                ? "Razorpay removed from new checkouts. Encrypted credentials remain available for existing payment verification and refunds."
                : "Plan settings updated."}
          </p>
        )}
        {params.error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-900"
          >
            {params.error === "reauth"
              ? "Password confirmation failed."
              : params.error === "encryption"
                ? "Payment credentials were not saved. Set a valid PAYMENT_CONFIG_ENCRYPTION_KEY in the server environment first."
                : params.error === "secrets"
                  ? "Enter both Razorpay secrets. On edit, leave saved values blank to keep them unchanged."
                  : params.error === "delete"
                    ? "The gateway could not be removed. Refresh the page and try again."
                    : params.error === "invalid"
                      ? "Check the gateway fields, mode, Key ID prefix, and confirmation values."
                      : "The settings could not be saved. Check the form and try again."}
          </p>
        )}
        {gatewayResult.error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
          >
            Payment gateway settings are unavailable. Apply the latest Supabase
            migration before managing provider credentials.
          </p>
        )}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Payment gateway</CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Add, update, enable, or remove the provider used for new
                  subscription checkouts.
                </p>
              </div>
              {gateway && (
                <StatusBadge status={gateway.enabled ? "active" : "inactive"} />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {gateway && (
              <p className="mb-4 text-sm text-slate-600">
                {gateway.display_name} · {gateway.mode.toUpperCase()} mode · key
                ID ending {gateway.key_id.slice(-4)} · secret values stored
                encrypted
              </p>
            )}
            {!gateway && legacyEnvironmentConfigured && (
              <p className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                Existing server environment credentials are currently in use.
                Add a gateway here to switch to admin-managed credentials.
              </p>
            )}
            <GatewayForm
              gateway={gateway}
              encryptionConfigured={encryptionConfigured}
              webhookUrl={webhookUrl}
            />
          </CardContent>
        </Card>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Subscription plans are temporarily unavailable.
          </p>
        )}
        {!error && plans.length === 0 && (
          <Card className="mt-5">
            <CardContent className="p-6">
              <EmptyState
                title="No plans configured"
                description="Create the first plan and set its prices, limits, trial, and features."
              />
            </CardContent>
          </Card>
        )}
        {!error && (
          <section className="mt-5 grid gap-4">
            {plans.map((plan) => (
              <Card key={plan.plan_id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{plan.plan_name}</CardTitle>
                      <p className="mt-1 text-sm text-slate-500">
                        /{plan.plan_slug} · {plan.subscriber_count} subscription
                        records
                      </p>
                    </div>
                    <StatusBadge
                      status={plan.is_active ? "active" : "inactive"}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <PlanForm plan={plan} />
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className="mb-3 text-xs leading-5 text-slate-500">
                      Delete is available only after deactivation and only when
                      there is no subscription history.
                    </p>
                    {!plan.is_active && Number(plan.subscriber_count) === 0 && (
                      <form
                        action={deleteSubscriptionPlanAction}
                        className="flex flex-wrap items-end gap-3"
                      >
                        <input
                          type="hidden"
                          name="plan_id"
                          value={plan.plan_id}
                        />
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Confirm current password
                          <input
                            type="password"
                            name="current_password"
                            required
                            minLength={12}
                            maxLength={128}
                            autoComplete="current-password"
                            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                          />
                        </label>
                        <Button type="submit" variant="destructive">
                          Delete unused plan
                        </Button>
                      </form>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
        <Card className="mt-7">
          <CardHeader>
            <CardTitle>Create subscription plan</CardTitle>
          </CardHeader>
          <CardContent>
            <PlanForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
