import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/services/medicine-search";

export interface PublicContentPost {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string;
}

export async function getPublishedPosts() {
  if (!isSupabaseConfigured())
    return {
      posts: [] as PublicContentPost[],
      error: false,
      configured: false,
    };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("content_posts")
      .select(
        "id, slug, title, summary, content, seo_title, seo_description, published_at",
      )
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(50);
    if (error)
      return {
        posts: [] as PublicContentPost[],
        error: true,
        configured: true,
      };
    return {
      posts: (data ?? []) as PublicContentPost[],
      error: false,
      configured: true,
    };
  } catch {
    return { posts: [] as PublicContentPost[], error: true, configured: true };
  }
}

export async function getPublishedPost(slug: string) {
  if (!isSupabaseConfigured())
    return {
      post: null as PublicContentPost | null,
      error: false,
      configured: false,
    };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("content_posts")
      .select(
        "id, slug, title, summary, content, seo_title, seo_description, published_at",
      )
      .eq("slug", slug)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .maybeSingle();
    if (error)
      return {
        post: null as PublicContentPost | null,
        error: true,
        configured: true,
      };
    return {
      post: (data ?? null) as PublicContentPost | null,
      error: false,
      configured: true,
    };
  } catch {
    return {
      post: null as PublicContentPost | null,
      error: true,
      configured: true,
    };
  }
}
