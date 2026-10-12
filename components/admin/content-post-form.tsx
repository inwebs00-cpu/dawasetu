"use client";

import { useActionState } from "react";

import { saveContentPostAction } from "@/app/admin/content/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthActionState } from "@/types/auth";

export interface ContentPostValue {
  slug: string;
  title: string;
  summary: string;
  content: string;
  seo_title: string | null;
  seo_description: string | null;
  status: string;
}

export function ContentPostForm({
  postId,
  initial,
}: {
  postId: string | null;
  initial?: ContentPostValue;
}) {
  const action = saveContentPostAction.bind(null, postId);
  const [state, formAction, pending] = useActionState<
    AuthActionState,
    FormData
  >(action, {});
  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 sm:p-7"
    >
      <p className="text-sm leading-6 text-slate-600 sm:col-span-2">
        Post body is stored and rendered as plain text. HTML and scripts are
        escaped by React.
      </p>
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        Title
        <Input
          name="title"
          defaultValue={initial?.title ?? ""}
          required
          maxLength={200}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        URL slug
        <Input
          name="slug"
          defaultValue={initial?.slug ?? ""}
          maxLength={120}
          placeholder="Leave blank to create from title"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-800 sm:col-span-2">
        Summary
        <textarea
          name="summary"
          defaultValue={initial?.summary ?? ""}
          required
          maxLength={500}
          rows={3}
          className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-normal"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-800 sm:col-span-2">
        Content
        <textarea
          name="content"
          defaultValue={initial?.content ?? ""}
          required
          maxLength={30000}
          rows={14}
          className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm leading-6 font-normal"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        SEO title
        <Input
          name="seo_title"
          defaultValue={initial?.seo_title ?? ""}
          maxLength={200}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        SEO description
        <Input
          name="seo_description"
          defaultValue={initial?.seo_description ?? ""}
          maxLength={320}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-800">
        Publication status
        <select
          name="status"
          defaultValue={initial?.status ?? "draft"}
          className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900"
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 sm:col-span-2"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          role="status"
          className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900 sm:col-span-2"
        >
          {state.message}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save post"}
        </Button>
      </div>
    </form>
  );
}
