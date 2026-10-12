import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { getPublishedPost } from "@/services/content";

export const dynamic = "force-dynamic";
type PageParams = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const { post } = await getPublishedPost(slug);
  return post
    ? {
        title: post.seo_title || post.title,
        description: post.seo_description || post.summary,
        openGraph: {
          title: post.seo_title || post.title,
          description: post.seo_description || post.summary,
          type: "article",
          publishedTime: post.published_at,
        },
      }
    : { title: "DawaSetu update" };
}

export default async function BlogPostPage({ params }: { params: PageParams }) {
  const { slug } = await params;
  const result = await getPublishedPost(slug);
  if (!result.post && !result.error && result.configured) notFound();
  if (!result.post)
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title={
              result.configured
                ? "This update is unavailable"
                : "Updates are not connected"
            }
            description="Return to the DawaSetu blog to view published updates."
          />
          <div className="mt-5 text-center">
            <Button asChild variant="outline">
              <Link href="/blog">Back to updates</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  const { post } = result;
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <article className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/blog">All updates</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          DawaSetu updates ·{" "}
          {new Date(post.published_at).toLocaleDateString("en-IN", {
            dateStyle: "long",
          })}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          {post.title}
        </h1>
        <p className="mt-4 text-lg leading-7 text-slate-600">{post.summary}</p>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-base leading-8 whitespace-pre-wrap text-slate-700 sm:p-8">
          {post.content}
        </div>
      </article>
    </main>
  );
}
