"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformPermission } from "@/lib/auth/authorization";
import type { AuthActionState } from "@/types/auth";

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

export async function saveContentPostAction(
  postId: string | null,
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const title = field(formData, "title");
  const slug = toSlug(field(formData, "slug") || title);
  const summary = field(formData, "summary");
  const content = field(formData, "content");
  const seoTitle = field(formData, "seo_title");
  const seoDescription = field(formData, "seo_description");
  const status = field(formData, "status");
  if (postId && !/^[0-9a-f-]{36}$/i.test(postId))
    return { error: "Choose a valid post." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    return { error: "Enter a title that can form a valid URL slug." };
  if (
    title.length < 1 ||
    title.length > 200 ||
    summary.length < 1 ||
    summary.length > 500 ||
    content.length < 1 ||
    content.length > 30000
  )
    return { error: "Check the title, summary, and content lengths." };
  if (seoTitle.length > 200 || seoDescription.length > 320)
    return { error: "SEO title or description is too long." };
  if (!new Set(["draft", "published", "archived"]).has(status))
    return { error: "Choose a valid publication status." };
  try {
    const { supabase } = await requirePlatformPermission("content.manage");
    const { error } = await supabase.rpc("admin_save_content_post", {
      p_post_id: postId,
      p_slug: slug,
      p_title: title,
      p_summary: summary,
      p_content: content,
      p_seo_title: seoTitle || null,
      p_seo_description: seoDescription || null,
      p_status: status,
    });
    if (error)
      return {
        error: "Post could not be saved. The URL slug may already be in use.",
      };
    revalidatePath("/admin/content");
    revalidatePath("/blog");
    revalidatePath(`/blog/${slug}`);
    return {
      message:
        status === "published"
          ? "Post published."
          : status === "archived"
            ? "Post archived."
            : "Draft saved.",
    };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "Content administration is temporarily unavailable." };
  }
}
