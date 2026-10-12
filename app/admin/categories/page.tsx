import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { requirePlatformPermission } from "@/lib/auth/authorization";
import { saveMedicineCategoryAction } from "@/app/admin/categories/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Medicine categories" };

type SearchParams = Promise<{ error?: string; saved?: string }>;

interface MedicineCategoryRow {
  category_id: string;
  slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  medicine_count: number;
}

function messageFor(params: Awaited<SearchParams>) {
  if (params.saved) return "Category saved.";
  if (params.error === "invalid")
    return "Check the category fields and try again.";
  if (params.error === "duplicate")
    return "That category name or URL is already in use.";
  if (params.error) return "Category could not be saved. Try again.";
  return "";
}

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { supabase } = await requirePlatformPermission("content.manage");
  const [params, { data, error }] = await Promise.all([
    searchParams,
    supabase.rpc("admin_list_medicine_categories"),
  ]);
  const categories = (data ?? []) as MedicineCategoryRow[];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin">Dashboard</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Content management
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Medicine categories
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Categories control public browsing and medicine classification.
          Deactivate a category to hide it from public browsing while keeping
          existing medicine records intact.
        </p>
        {messageFor(params) && (
          <p
            role={params.error ? "alert" : "status"}
            className={`mt-5 rounded-xl p-4 text-sm ${params.error ? "bg-rose-50 text-rose-900" : "bg-emerald-50 text-emerald-900"}`}
          >
            {messageFor(params)}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Category records are temporarily unavailable.
          </p>
        )}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">Add category</h2>
          <form
            action={saveMedicineCategoryAction}
            className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
          >
            <label className="grid gap-1 text-xs font-medium text-slate-700 lg:col-span-2">
              Name
              <input
                name="name"
                required
                maxLength={100}
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-700 lg:col-span-2">
              URL slug
              <input
                name="slug"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={100}
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-700">
              Display order
              <input
                name="display_order"
                type="number"
                required
                min={0}
                max={9999}
                defaultValue={100}
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-700">
              Visibility
              <select
                name="is_active"
                defaultValue="true"
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-700 sm:col-span-2 lg:col-span-5">
              Description
              <input
                name="description"
                maxLength={500}
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal"
              />
            </label>
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                Add category
              </Button>
            </div>
          </form>
        </section>

        <section className="mt-6 grid gap-4">
          {categories.map((category) => (
            <form
              key={category.category_id}
              action={saveMedicineCategoryAction}
              className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-6"
            >
              <input
                type="hidden"
                name="category_id"
                value={category.category_id}
              />
              <label className="grid gap-1 text-xs font-medium text-slate-700 lg:col-span-2">
                Name
                <input
                  name="name"
                  required
                  maxLength={100}
                  defaultValue={category.name}
                  className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-700 lg:col-span-2">
                URL slug
                <input
                  name="slug"
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  maxLength={100}
                  defaultValue={category.slug}
                  className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-700">
                Display order
                <input
                  name="display_order"
                  type="number"
                  required
                  min={0}
                  max={9999}
                  defaultValue={category.display_order}
                  className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-700">
                Visibility
                <select
                  name="is_active"
                  defaultValue={String(category.is_active)}
                  className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-700 sm:col-span-2 lg:col-span-5">
                Description · {category.medicine_count} medicines linked
                <input
                  name="description"
                  maxLength={500}
                  defaultValue={category.description ?? ""}
                  className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal"
                />
              </label>
              <div className="flex items-end">
                <Button type="submit" variant="outline" className="w-full">
                  Save changes
                </Button>
              </div>
            </form>
          ))}
          {!error && categories.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
              No categories found.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
