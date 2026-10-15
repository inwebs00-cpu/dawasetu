import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePlatformPermission } from "@/lib/auth/authorization";

import { setUserStatusAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Users and patients" };

type UserRow = {
  user_id: string;
  full_name: string;
  email: string | null;
  phone_e164: string | null;
  account_type: string;
  user_status: string;
  created_at: string;
  last_login_at: string | null;
  business_count: number;
  business_types: string[];
  platform_roles: string[];
};

type SearchParams = Promise<{
  search?: string;
  account_type?: string;
  status?: string;
  page?: string;
  updated?: string;
  error?: string;
}>;

const accountTypes = [
  "customer",
  "partner",
  "distributor",
  "admin",
  "team_member",
  "super_admin",
];
const statuses = ["active", "inactive", "suspended"];

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function PasswordField() {
  return (
    <label className="grid min-w-40 gap-1 text-xs font-medium text-slate-700">
      Confirm current password
      <input
        type="password"
        name="current_password"
        autoComplete="current-password"
        minLength={12}
        maxLength={128}
        required
        className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
      />
    </label>
  );
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const search = (params.search ?? "").trim().slice(0, 120);
  const accountType = accountTypes.includes(params.account_type ?? "")
    ? params.account_type!
    : "";
  const status = statuses.includes(params.status ?? "") ? params.status! : "";
  const page = Math.max(0, Math.min(200, Number(params.page) || 0));
  const { supabase } = await requirePlatformPermission("users.view");
  const [usersResult, managePermission] = await Promise.all([
    supabase.rpc("admin_list_users", {
      p_search: search || null,
      p_account_type: accountType || null,
      p_status: status || null,
      p_limit: 50,
      p_offset: page * 50,
    }),
    supabase.rpc("has_platform_permission", {
      p_permission_key: "users.manage",
    }),
  ]);
  const users = (usersResult.data ?? []) as UserRow[];
  const canManageUsers = managePermission.data === true;
  const errorMessage =
    params.error === "reauth"
      ? "Password confirmation failed. Enter your current password and retry."
      : params.error === "invalid"
        ? "Check the selected status, reason, and password fields."
        : params.error
          ? "The status could not be changed. Confirm your permissions and try again."
          : null;
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (accountType) query.set("account_type", accountType);
  if (status) query.set("status", status);
  const previousQuery = new URLSearchParams(query);
  const nextQuery = new URLSearchParams(query);
  if (page > 0) previousQuery.set("page", String(page - 1));
  nextQuery.set("page", String(page + 1));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin">Dashboard</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">Account directory</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Users and patients
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Search verified DawaSetu accounts and review their partner links.
          Account access changes require current-password confirmation and an
          audit reason.
        </p>

        {params.updated && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"
          >
            Account status updated and recorded in the audit log.
          </p>
        )}
        {errorMessage && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-900"
          >
            {errorMessage}
          </p>
        )}
        {usersResult.error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-900"
          >
            User records are temporarily unavailable.
          </p>
        )}

        <Card className="mt-6">
          <CardContent className="p-4 sm:p-5">
            <form
              method="get"
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <label className="grid gap-1 text-xs font-medium text-slate-700">
                Search name, email, or phone
                <input
                  name="search"
                  defaultValue={search}
                  maxLength={120}
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-700">
                Account type
                <select
                  name="account_type"
                  defaultValue={accountType}
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                >
                  <option value="">All account types</option>
                  {accountTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-700">
                Account status
                <select
                  name="status"
                  defaultValue={status}
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                >
                  <option value="">All statuses</option>
                  {statuses.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end gap-2">
                <Button type="submit">Apply filters</Button>
                <Button asChild type="button" variant="outline">
                  <Link href="/admin/users">Reset</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <section className="mt-6 space-y-3" aria-label="User accounts">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">
              {users.length === 50
                ? "Up to 50 accounts"
                : `${users.length} accounts`}{" "}
              on this page
            </h2>
            <div className="flex gap-2">
              {page > 0 && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/users?${previousQuery.toString()}`}>
                    Previous
                  </Link>
                </Button>
              )}
              {users.length === 50 && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/users?${nextQuery.toString()}`}>
                    Next
                  </Link>
                </Button>
              )}
            </div>
          </div>
          {users.length === 0 ? (
            <EmptyState
              title="No accounts match those filters"
              description="Try a shorter search or clear one of the filters."
            />
          ) : (
            users.map((account) => (
              <Card key={account.user_id}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle>{account.full_name}</CardTitle>
                    <p className="mt-1 text-sm break-all text-slate-600">
                      {account.email ?? "No email"}
                      {account.phone_e164 ? ` · ${account.phone_e164}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={account.user_status} />
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="text-slate-500">Account</dt>
                      <dd className="mt-1 font-medium text-slate-900 capitalize">
                        {account.account_type.replaceAll("_", " ")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Partner businesses</dt>
                      <dd className="mt-1 font-medium text-slate-900">
                        {account.business_count}
                        {account.business_types.length > 0
                          ? ` · ${account.business_types.join(", ")}`
                          : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Platform roles</dt>
                      <dd className="mt-1 font-medium text-slate-900">
                        {account.platform_roles.join(", ") ||
                          "Customer / partner only"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Last sign-in</dt>
                      <dd className="mt-1 font-medium text-slate-900">
                        {formatDate(account.last_login_at)}
                      </dd>
                    </div>
                  </dl>
                  {canManageUsers && (
                    <form
                      action={setUserStatusAction}
                      className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4"
                    >
                      <input
                        type="hidden"
                        name="user_id"
                        value={account.user_id}
                      />
                      <label className="grid gap-1 text-xs font-medium text-slate-700">
                        Set account status
                        <select
                          name="status"
                          defaultValue={account.user_status}
                          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                        >
                          {statuses.map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-slate-700">
                        Reason for audit log
                        <input
                          name="reason"
                          required
                          minLength={5}
                          maxLength={500}
                          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                        />
                      </label>
                      <PasswordField />
                      <div className="flex items-end">
                        <Button type="submit" variant="outline">
                          Save status
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
