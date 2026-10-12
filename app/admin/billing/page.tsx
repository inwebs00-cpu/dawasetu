import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePlatformPermission } from "@/lib/auth/authorization";

import {
  deleteSubscriptionPlanAction,
  saveSubscriptionPlanAction,
} from "./actions";

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
type SearchParams = Promise<{ updated?: string; error?: string }>;

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
  const { data, error } = await supabase.rpc("admin_list_subscription_plans");
  const plans = (data ?? []) as SubscriptionPlan[];
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
            Plan settings updated.
          </p>
        )}
        {params.error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-900"
          >
            {params.error === "reauth"
              ? "Password confirmation failed."
              : "The plan could not be saved. Check the slug, price, and subscription history."}
          </p>
        )}
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
