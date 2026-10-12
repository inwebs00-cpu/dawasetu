import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePlatformPermission } from "@/lib/auth/authorization";

import {
  deleteRedirectWebsiteAction,
  saveRedirectWebsiteAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Redirect websites" };

interface RedirectWebsite {
  redirect_id: string;
  website_name: string;
  website_url: string;
  logo_path: string | null;
  description: string | null;
  button_text: string;
  display_position: number;
  open_in_new_tab: boolean;
  is_active: boolean;
  updated_at: string;
}

type SearchParams = Promise<{ updated?: string; error?: string }>;

function RedirectWebsiteForm({ website }: { website?: RedirectWebsite }) {
  return (
    <form action={saveRedirectWebsiteAction} className="grid gap-4">
      <input
        type="hidden"
        name="redirect_id"
        value={website?.redirect_id ?? ""}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Website name
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            defaultValue={website?.website_name}
            placeholder="Click2Book"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          HTTPS website URL
          <input
            type="url"
            name="website_url"
            required
            maxLength={2048}
            pattern="https://.*"
            defaultValue={website?.website_url}
            placeholder="https://click2book.in"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Logo URL or storage path
          <input
            name="logo_path"
            maxLength={1000}
            defaultValue={website?.logo_path ?? ""}
            placeholder="Optional"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Button text
          <input
            name="button_text"
            required
            minLength={2}
            maxLength={80}
            defaultValue={website?.button_text}
            placeholder="Book Doctor Appointment"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-700">
          Display position
          <input
            type="number"
            name="display_position"
            required
            min="0"
            max="10000"
            defaultValue={website?.display_position ?? 0}
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
          defaultValue={website?.description ?? ""}
          placeholder="Doctor appointment and booking platform"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900"
        />
      </label>
      <div className="flex flex-wrap items-center gap-5 border-t border-slate-100 pt-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={website?.is_active ?? false}
            className="size-4 accent-teal-700"
          />
          Show this link publicly
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="open_in_new_tab"
            defaultChecked={website?.open_in_new_tab ?? true}
            className="size-4 accent-teal-700"
          />
          Open in a new tab
        </label>
        <Button type="submit" size="sm">
          {website ? "Save changes" : "Add website"}
        </Button>
      </div>
    </form>
  );
}

export default async function AdminRedirectWebsitesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const { supabase } = await requirePlatformPermission("content.manage");
  const { data, error } = await supabase.rpc("admin_list_redirect_websites");
  const websites = (data ?? []) as RedirectWebsite[];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin">Dashboard</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">Network services</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Redirect websites
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Configure external services shown to customers. Links are opened only
          when a customer chooses them; DawaSetu does not claim to book or
          confirm an appointment.
        </p>
        {params.updated && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"
          >
            {params.updated === "deleted"
              ? "Website removed."
              : "Website saved."}
          </p>
        )}
        {params.error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-900"
          >
            {params.error === "confirm"
              ? "Confirm the removal before deleting this website."
              : "The website could not be saved. Check its fields and ensure its name is unique."}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Redirect websites are temporarily unavailable.
          </p>
        )}
        {!error && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Add a redirect website</CardTitle>
            </CardHeader>
            <CardContent>
              <RedirectWebsiteForm />
            </CardContent>
          </Card>
        )}
        {!error && websites.length === 0 && (
          <Card className="mt-5">
            <CardContent className="p-6">
              <EmptyState
                title="No redirect websites configured"
                description="Add a booking or health service to show a clearly labelled external link on the customer homepage."
              />
            </CardContent>
          </Card>
        )}
        {!error && websites.length > 0 && (
          <section className="mt-5 grid gap-4">
            {websites.map((website) => (
              <Card key={website.redirect_id}>
                <CardHeader className="flex flex-wrap items-start justify-between gap-3 sm:flex-row">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{website.website_name}</CardTitle>
                      <StatusBadge
                        status={website.is_active ? "active" : "inactive"}
                      />
                    </div>
                    <a
                      href={website.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-sm break-all text-teal-800 underline"
                    >
                      {website.website_url}
                    </a>
                    <p className="mt-1 text-xs text-slate-500">
                      Position {website.display_position} · Updated{" "}
                      {new Date(website.updated_at).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-5">
                  <RedirectWebsiteForm website={website} />
                  <form
                    action={deleteRedirectWebsiteAction}
                    className="flex flex-wrap items-center gap-3 border-t border-rose-100 pt-4"
                  >
                    <input
                      type="hidden"
                      name="redirect_id"
                      value={website.redirect_id}
                    />
                    <label className="flex items-center gap-2 text-sm text-rose-800">
                      <input
                        type="checkbox"
                        name="confirm_delete"
                        required
                        className="size-4 accent-rose-700"
                      />
                      Confirm removal
                    </label>
                    <Button type="submit" size="sm" variant="destructive">
                      Delete website
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
