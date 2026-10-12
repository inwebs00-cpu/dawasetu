import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePlatformPermission } from "@/lib/auth/authorization";

import {
  assignPlatformRoleAction,
  removePlatformRoleAction,
  savePlatformRoleAction,
  setPlatformTeamStatusAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Team and roles" };

type TeamMemberRole = {
  role_id: string;
  role_name: string;
  role_slug: string;
  role_is_system: boolean;
};
type TeamRow = {
  user_id: string;
  full_name: string;
  email: string | null;
  phone_e164: string | null;
  user_status: string;
  role_id: string;
  role_name: string;
  role_slug: string;
  role_is_system: boolean;
  assigned_at: string;
  last_login_at: string | null;
};
type TeamMember = Omit<
  TeamRow,
  "role_id" | "role_name" | "role_slug" | "role_is_system" | "assigned_at"
> & {
  roles: TeamMemberRole[];
};
type PlatformRole = {
  role_id: string;
  role_slug: string;
  role_name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  assigned_count: number;
  permission_keys: string[];
};
type Permission = {
  permission_key: string;
  module: string;
  description: string | null;
};
type SearchParams = Promise<{ updated?: string; error?: string }>;

function PasswordField() {
  return (
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
  );
}

export default async function AdminTeamPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const { supabase } = await requirePlatformPermission("team.manage");
  const [teamResult, rolesResult, securityResult, userManageResult] =
    await Promise.all([
      supabase.rpc("admin_list_platform_team_members"),
      supabase.rpc("admin_list_platform_roles"),
      supabase.rpc("has_platform_permission", {
        p_permission_key: "security.manage",
      }),
      supabase.rpc("has_platform_permission", {
        p_permission_key: "users.manage",
      }),
    ]);
  const teamRows = (teamResult.data ?? []) as TeamRow[];
  const roles = (rolesResult.data ?? []) as PlatformRole[];
  const canManageRoles = securityResult.data === true;
  const canManageUsers = userManageResult.data === true;
  const { data: permissionData, error: permissionError } = canManageRoles
    ? await supabase.rpc("admin_list_platform_permissions")
    : { data: [], error: null };
  const permissions = (permissionData ?? []) as Permission[];
  const memberMap = new Map<string, TeamMember>();
  for (const row of teamRows) {
    const member = memberMap.get(row.user_id) ?? {
      user_id: row.user_id,
      full_name: row.full_name,
      email: row.email,
      phone_e164: row.phone_e164,
      user_status: row.user_status,
      last_login_at: row.last_login_at,
      roles: [],
    };
    member.roles.push({
      role_id: row.role_id,
      role_name: row.role_name,
      role_slug: row.role_slug,
      role_is_system: row.role_is_system,
    });
    memberMap.set(row.user_id, member);
  }
  const members = [...memberMap.values()];
  const assignableRoles = roles.filter(
    (role) =>
      role.is_active &&
      !["customer", "partner", "distributor", "super_admin"].includes(
        role.role_slug,
      ),
  );
  const permissionGroups = permissions.reduce<Record<string, Permission[]>>(
    (groups, permission) => {
      (groups[permission.module] ??= []).push(permission);
      return groups;
    },
    {},
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin">Dashboard</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">Access control</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Team and roles
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Manage platform staff roles and account access. Role and status
          changes require your current password and are recorded in the audit
          log.
        </p>

        {params.updated && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"
          >
            Team settings updated.
          </p>
        )}
        {params.error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-900"
          >
            {params.error === "reauth"
              ? "Password confirmation failed. Re-enter your current password and retry."
              : "The requested change could not be saved. Check the details and your permissions."}
          </p>
        )}
        {(teamResult.error || rolesResult.error) && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-900"
          >
            Team records are temporarily unavailable.
          </p>
        )}

        {canManageRoles && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Grant a platform role</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm leading-6 text-slate-600">
                The person must already have an active DawaSetu account. New
                users can sign up first; this action grants only the permissions
                your account already has.
              </p>
              <form
                action={assignPlatformRoleAction}
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              >
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Verified account email
                  <input
                    type="email"
                    name="email"
                    required
                    maxLength={320}
                    autoComplete="off"
                    className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Platform role
                  <select
                    name="role_id"
                    required
                    className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                  >
                    <option value="">Choose a role</option>
                    {assignableRoles.map((role) => (
                      <option key={role.role_id} value={role.role_id}>
                        {role.role_name}
                      </option>
                    ))}
                  </select>
                </label>
                <PasswordField />
                <div className="flex items-end">
                  <Button type="submit">Grant role</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <section className="mt-7">
          <h2 className="text-xl font-semibold text-slate-950">
            Platform team accounts
          </h2>
          {members.length === 0 && !teamResult.error && (
            <Card className="mt-4">
              <CardContent className="p-6">
                <EmptyState
                  title="No platform team accounts"
                  description="Grant a platform role to an active DawaSetu account to add it to this list."
                />
              </CardContent>
            </Card>
          )}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {members.map((member) => (
              <Card key={member.user_id}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-950">
                        {member.full_name}
                      </h3>
                      <p className="mt-1 text-sm break-all text-slate-600">
                        {member.email ?? "No email"}
                        {member.phone_e164 ? ` · ${member.phone_e164}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Last login:{" "}
                        {member.last_login_at
                          ? new Date(member.last_login_at).toLocaleString(
                              "en-IN",
                              { dateStyle: "medium", timeStyle: "short" },
                            )
                          : "Not recorded"}
                      </p>
                    </div>
                    <StatusBadge status={member.user_status} />
                  </div>
                  <div className="mt-4 grid gap-2">
                    {member.roles.map((role) => (
                      <div
                        key={role.role_id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
                      >
                        <span className="text-sm font-medium text-slate-700">
                          {role.role_name}
                        </span>
                        {canManageRoles && role.role_slug !== "super_admin" && (
                          <form
                            action={removePlatformRoleAction}
                            className="flex flex-wrap items-end gap-2"
                          >
                            <input
                              type="hidden"
                              name="user_id"
                              value={member.user_id}
                            />
                            <input
                              type="hidden"
                              name="role_id"
                              value={role.role_id}
                            />
                            <input
                              type="password"
                              name="current_password"
                              required
                              minLength={12}
                              maxLength={128}
                              autoComplete="current-password"
                              aria-label="Confirm current password to remove role"
                              placeholder="Current password"
                              className="h-9 w-40 rounded-lg border border-slate-300 bg-white px-2 text-xs"
                            />
                            <Button type="submit" size="sm" variant="outline">
                              Remove role
                            </Button>
                          </form>
                        )}
                      </div>
                    ))}
                  </div>
                  {canManageUsers && (
                    <form
                      action={setPlatformTeamStatusAction}
                      className="mt-4 grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_auto]"
                    >
                      <input
                        type="hidden"
                        name="user_id"
                        value={member.user_id}
                      />
                      <label className="grid gap-1 text-xs font-medium text-slate-700">
                        Account status
                        <select
                          name="status"
                          defaultValue={member.user_status}
                          className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal text-slate-900"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-slate-700">
                        Current password
                        <input
                          type="password"
                          name="current_password"
                          required
                          minLength={12}
                          maxLength={128}
                          autoComplete="current-password"
                          className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal text-slate-900"
                        />
                      </label>
                      <div className="flex items-end">
                        <Button type="submit" size="sm" variant="secondary">
                          Update
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-slate-950">
            Platform roles
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Built-in roles are maintained by migrations. Custom roles can grant
            only permissions available to your own administrator account.
          </p>
          <div className="mt-4 grid gap-4">
            {roles.map((role) => (
              <Card key={role.role_id}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-950">
                        {role.role_name}{" "}
                        <span className="font-normal text-slate-500">
                          ({role.role_slug})
                        </span>
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {role.description ?? "No description"} ·{" "}
                        {role.assigned_count} assignments
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {role.is_system && <StatusBadge status="System role" />}
                      {!role.is_active && <StatusBadge status="inactive" />}
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    {role.permission_keys.length
                      ? role.permission_keys.join(" · ")
                      : "No permissions"}
                  </p>
                  {canManageRoles && !role.is_system && (
                    <details className="mt-4 rounded-xl bg-slate-50 p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                        Edit custom role permissions
                      </summary>
                      {permissionError && (
                        <p role="alert" className="mt-3 text-sm text-rose-800">
                          The permission catalog could not be loaded.
                        </p>
                      )}
                      <form
                        action={savePlatformRoleAction}
                        className="mt-4 grid gap-4"
                      >
                        <input
                          type="hidden"
                          name="role_id"
                          value={role.role_id}
                        />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="grid gap-1 text-xs font-medium text-slate-700">
                            Role name
                            <input
                              name="name"
                              required
                              minLength={2}
                              maxLength={100}
                              defaultValue={role.role_name}
                              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                            />
                          </label>
                          <label className="grid gap-1 text-xs font-medium text-slate-700">
                            Role slug
                            <input
                              name="slug"
                              required
                              pattern="[a-z][a-z0-9_]{1,47}"
                              defaultValue={role.role_slug}
                              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                            />
                          </label>
                        </div>
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Description
                          <textarea
                            name="description"
                            maxLength={500}
                            rows={2}
                            defaultValue={role.description ?? ""}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900"
                          />
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {Object.entries(permissionGroups).map(
                            ([module, modulePermissions]) => (
                              <fieldset
                                key={module}
                                className="rounded-lg border border-slate-200 bg-white p-3"
                              >
                                <legend className="px-1 text-xs font-semibold text-slate-700 capitalize">
                                  {module.replaceAll("_", " ")}
                                </legend>
                                <div className="grid gap-2">
                                  {modulePermissions.map((permission) => (
                                    <label
                                      key={permission.permission_key}
                                      className="flex items-start gap-2 text-xs leading-5 text-slate-700"
                                    >
                                      <input
                                        type="checkbox"
                                        name="permission_keys"
                                        value={permission.permission_key}
                                        defaultChecked={role.permission_keys.includes(
                                          permission.permission_key,
                                        )}
                                        className="mt-1 size-4 shrink-0 accent-teal-700"
                                      />
                                      <span>{permission.permission_key}</span>
                                    </label>
                                  ))}
                                </div>
                              </fieldset>
                            ),
                          )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                          <PasswordField />
                          <Button type="submit">Save role</Button>
                        </div>
                      </form>
                    </details>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          {canManageRoles && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Create a custom role</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={savePlatformRoleAction} className="grid gap-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-medium text-slate-700">
                      Role name
                      <input
                        name="name"
                        required
                        minLength={2}
                        maxLength={100}
                        className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-slate-700">
                      Role slug
                      <input
                        name="slug"
                        required
                        pattern="[a-z][a-z0-9_]{1,47}"
                        maxLength={48}
                        className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                      />
                    </label>
                  </div>
                  <label className="grid gap-1 text-xs font-medium text-slate-700">
                    Description
                    <textarea
                      name="description"
                      maxLength={500}
                      rows={2}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900"
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(permissionGroups).map(
                      ([module, modulePermissions]) => (
                        <fieldset
                          key={module}
                          className="rounded-lg border border-slate-200 bg-white p-3"
                        >
                          <legend className="px-1 text-xs font-semibold text-slate-700 capitalize">
                            {module.replaceAll("_", " ")}
                          </legend>
                          <div className="grid gap-2">
                            {modulePermissions.map((permission) => (
                              <label
                                key={permission.permission_key}
                                className="flex items-start gap-2 text-xs leading-5 text-slate-700"
                              >
                                <input
                                  type="checkbox"
                                  name="permission_keys"
                                  value={permission.permission_key}
                                  className="mt-1 size-4 shrink-0 accent-teal-700"
                                />
                                <span>{permission.permission_key}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      ),
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <PasswordField />
                    <Button type="submit">Create role</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}
