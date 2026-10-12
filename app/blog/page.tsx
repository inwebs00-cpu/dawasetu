import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPublishedPosts } from "@/services/content";

export const metadata: Metadata = {
  title: "DawaSetu updates",
  description:
    "News and helpful updates from the DawaSetu medicine availability network.",
};

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const result = await getPublishedPosts();
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Home</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">Updates</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          DawaSetu blog
        </h1>
        {result.error ? (
          <div className="mt-7">
            <EmptyState
              title="Updates are temporarily unavailable"
              description="Please return later to see DawaSetu news and updates."
            />
          </div>
        ) : !result.configured || result.posts.length === 0 ? (
          <div className="mt-7">
            <EmptyState
              title={
                result.configured
                  ? "No posts have been published yet"
                  : "Updates are not connected yet"
              }
              description={
                result.configured
                  ? "Updates will appear here when the DawaSetu team publishes them."
                  : "Configure Supabase and apply the DawaSetu migrations to connect published updates."
              }
            />
          </div>
        ) : (
          <section className="mt-7 grid gap-4 sm:grid-cols-2">
            {result.posts.map((post) => (
              <Card key={post.id}>
                <CardContent className="p-5">
                  <p className="text-xs font-medium text-teal-800">
                    {new Date(post.published_at).toLocaleDateString("en-IN", {
                      dateStyle: "medium",
                    })}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">
                    {post.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {post.summary}
                  </p>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="mt-3 px-0"
                  >
                    <Link href={`/blog/${encodeURIComponent(post.slug)}`}>
                      Read update
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
