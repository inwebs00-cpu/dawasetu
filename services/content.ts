import "server-only";

import { editorialPosts } from "@/lib/content/editorial-posts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/services/medicine-search";

export type {
  EditorialSection,
  EditorialSource,
} from "@/lib/content/editorial-posts";

export interface PublicContentPost {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string;
  sections?: (typeof editorialPosts)[number]["sections"];
  sources?: (typeof editorialPosts)[number]["sources"];
}

export async function getPublishedPosts() {
  if (!isSupabaseConfigured())
    return {
      posts: editorialPosts as PublicContentPost[],
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
        posts: editorialPosts as PublicContentPost[],
        error: true,
        configured: true,
      };
    const databasePosts = (data ?? []) as PublicContentPost[];
    const databaseSlugs = new Set(databasePosts.map((post) => post.slug));
    return {
      posts: [
        ...databasePosts,
        ...editorialPosts.filter((post) => !databaseSlugs.has(post.slug)),
      ].sort(
        (first, second) =>
          new Date(second.published_at).getTime() -
          new Date(first.published_at).getTime(),
      ),
      error: false,
      configured: true,
    };
  } catch {
    return {
      posts: editorialPosts as PublicContentPost[],
      error: true,
      configured: true,
    };
  }
}

export async function getPublishedPost(slug: string) {
  const editorialPost = editorialPosts.find((post) => post.slug === slug);
  if (!isSupabaseConfigured())
    return {
      post: (editorialPost ?? null) as PublicContentPost | null,
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
        post: (editorialPost ?? null) as PublicContentPost | null,
        error: true,
        configured: true,
      };
    return {
      post: (data ?? editorialPost ?? null) as PublicContentPost | null,
      error: false,
      configured: true,
    };
  } catch {
    return {
      post: (editorialPost ?? null) as PublicContentPost | null,
      error: true,
      configured: true,
    };
  }
}
