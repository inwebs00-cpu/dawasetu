"use client";

import { useActionState } from "react";

import { createHomepageBannerAction } from "@/app/admin/content/banners/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthActionState } from "@/types/auth";

export function HomepageBannerForm() {
  const [state, formAction, pending] = useActionState<
    AuthActionState,
    FormData
  >(createHomepageBannerAction, {});

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-950">
          Add a homepage banner
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Upload a JPG, PNG, or WebP image up to 700 KB. Published banners
          appear above the homepage search section.
        </p>
      </div>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Banner title
        <Input name="title" required minLength={2} maxLength={160} />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Banner image
        <input
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          className="block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:font-semibold file:text-teal-800"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Image description (alt text)
        <Input name="alt_text" required minLength={5} maxLength={240} />
      </label>
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Click destination (optional)
          <Input
            name="target_url"
            type="text"
            placeholder="/pharmacies or https://…"
            maxLength={2048}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Order
          <Input
            name="display_order"
            type="number"
            min={0}
            max={999}
            defaultValue={0}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          name="is_active"
          type="checkbox"
          defaultChecked
          className="size-4 accent-teal-700"
        />
        Publish after saving
      </label>
      {state.error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          {state.message}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Save banner"}
        </Button>
      </div>
    </form>
  );
}
