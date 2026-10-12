import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { requirePlatformPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Audit log" };

type SearchParams = Promise<{ module?: string; page?: string }>;
interface AuditEntry {
  log_id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  role_slug: string | null;
  action: string;
  module: string;
  record_table: string | null;
  record_id: string | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const modules = [
    "partners",
    "inventory",
    "medicines",
    "requests",
    "distributors",
    "locations",
    "content",
  ];
  const selectedModule = modules.includes(params.module ?? "")
    ? params.module!
    : null;
  const parsedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(parsedPage) && parsedPage > 0
      ? Math.min(parsedPage, 10000)
      : 1;
  const { supabase } = await requirePlatformPermission("audit_logs.view");
  const { data, error } = await supabase.rpc("admin_list_audit_logs", {
    p_module: selectedModule,
    p_limit: 51,
    p_offset: (page - 1) * 50,
  });
  const entries = (data ?? []) as AuditEntry[];
  const hasNext = entries.length > 50;
  const logs = entries.slice(0, 50);
  function pageUrl(nextPage: number) {
    const query = new URLSearchParams();
    if (selectedModule) query.set("module", selectedModule);
    query.set("page", String(nextPage));
    return `/admin/audit-logs?${query.toString()}`;
  }
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
          Security and accountability
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Audit log
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Administrative and inventory changes are recorded with actor, time,
          and before/after values when available.
        </p>
        <form
          method="get"
          className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto]"
        >
          <label className="grid gap-1 text-xs font-medium text-slate-700">
            Module
            <select
              name="module"
              defaultValue={selectedModule ?? ""}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
            >
              <option value="">All modules</option>
              {modules.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <Button type="submit" variant="secondary">
              Filter log
            </Button>
          </div>
        </form>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Audit records are temporarily unavailable.
          </p>
        )}
        {!error && logs.length === 0 && (
          <Card className="mt-5">
            <CardContent className="p-6">
              <EmptyState
                title="No audit entries"
                description="Changes recorded by DawaSetu workflows will appear here."
              />
            </CardContent>
          </Card>
        )}
        {!error && (
          <section className="mt-5 grid gap-3">
            {logs.map((entry) => (
              <Card key={entry.log_id}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-slate-950">
                        {entry.action.replaceAll(".", " ").replaceAll("_", " ")}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {entry.module}
                        {entry.record_table ? ` · ${entry.record_table}` : ""}
                        {entry.record_id ? ` · ${entry.record_id}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {entry.actor_name ?? "System or deleted user"}
                        {entry.role_slug
                          ? ` · ${entry.role_slug.replaceAll("_", " ")}`
                          : ""}{" "}
                        ·{" "}
                        {new Date(entry.created_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                  </div>
                  {(entry.previous_value ||
                    entry.new_value ||
                    Object.keys(entry.metadata ?? {}).length > 0) && (
                    <details className="mt-4 rounded-xl bg-slate-50 p-3">
                      <summary className="cursor-pointer text-sm font-medium text-slate-700">
                        Review change details
                      </summary>
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        {entry.previous_value && (
                          <section>
                            <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                              Previous value
                            </h3>
                            <pre className="mt-1 max-h-72 overflow-auto rounded-lg bg-white p-3 text-xs leading-5 break-words whitespace-pre-wrap text-slate-700">
                              {JSON.stringify(entry.previous_value, null, 2)}
                            </pre>
                          </section>
                        )}
                        {entry.new_value && (
                          <section>
                            <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                              New value
                            </h3>
                            <pre className="mt-1 max-h-72 overflow-auto rounded-lg bg-white p-3 text-xs leading-5 break-words whitespace-pre-wrap text-slate-700">
                              {JSON.stringify(entry.new_value, null, 2)}
                            </pre>
                          </section>
                        )}
                      </div>
                      {Object.keys(entry.metadata ?? {}).length > 0 && (
                        <section className="mt-3">
                          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                            Additional context
                          </h3>
                          <pre className="mt-1 max-h-72 overflow-auto rounded-lg bg-white p-3 text-xs leading-5 break-words whitespace-pre-wrap text-slate-700">
                            {JSON.stringify(entry.metadata, null, 2)}
                          </pre>
                        </section>
                      )}
                    </details>
                  )}
                </CardContent>
              </Card>
            ))}
          </section>
        )}
        <nav
          aria-label="Audit log pages"
          className="mt-6 flex items-center justify-between"
        >
          <p className="text-sm text-slate-600">
            Page {page} · {logs.length} entries
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild size="sm" variant="outline">
                <Link href={pageUrl(page - 1)}>Previous</Link>
              </Button>
            )}
            {hasNext && (
              <Button asChild size="sm" variant="outline">
                <Link href={pageUrl(page + 1)}>Next</Link>
              </Button>
            )}
          </div>
        </nav>
      </div>
    </main>
  );
}
