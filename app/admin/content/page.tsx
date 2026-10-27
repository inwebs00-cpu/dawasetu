import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePlatformPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Content management" };

interface ContentPost {
  post_id: string;
  slug: string;
  title: string;
  summary: string;
  status: string;
  published_at: string | null;
  updated_at: string;
}

export default async function AdminContentPage() {
  const { supabase } = await requirePlatformPermission("content.manage");
  const { data, error } = await supabase.rpc("admin_list_content_posts", {
    p_query: null,
    p_limit: 100,
    p_offset: 0,
  });
  const posts = (data ?? []) as ContentPost[];
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/content/banners">Homepage banners</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin">Dashboard</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/content/new">New post</Link>
            </Button>
          </div>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Content management
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          DawaSetu updates
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Write plain-text updates, set SEO metadata, and publish or archive
          posts.
        </p>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Content records are temporarily unavailable.
          </p>
        )}
        {!error && posts.length === 0 && (
          <Card className="mt-5">
            <CardContent className="p-6">
              <EmptyState
                title="No posts yet"
                description="Create a draft or publish an update for the DawaSetu blog."
              />
            </CardContent>
          </Card>
        )}
        {!error && (
          <section className="mt-5 grid gap-3">
            {posts.map((post) => (
              <Card key={post.post_id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-slate-950">
                        {post.title}
                      </h2>
                      <StatusBadge status={post.status} />
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {post.summary}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      /{post.slug} · Updated{" "}
                      {new Date(post.updated_at).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/content/${post.post_id}/edit`}>
                        Edit
                      </Link>
                    </Button>
                    {post.status === "published" && (
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/blog/${post.slug}`} target="_blank">
                          View
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
