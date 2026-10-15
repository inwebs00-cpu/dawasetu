import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPublishedPosts } from "@/services/content";

export const metadata: Metadata = {
  title: "Medicine and Pharmacy Guides",
  description:
    "Practical pharmacy, medicine availability and health information from DawaSetu, with trusted references and clear limits on medical advice.",
  keywords: [
    "medicine availability guide India",
    "nearby pharmacy medicine stock",
    "pharmacy guides India",
    "medicine storage information",
    "antibiotic use information",
  ],
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Medicine and Pharmacy Guides | DawaSetu",
    description:
      "Practical pharmacy and medicine availability information from DawaSetu.",
    url: "/blog",
    type: "website",
  },
};

export const dynamic = "force-dynamic";

function safeJsonLd(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export default async function BlogPage() {
  const result = await getPublishedPosts();
  const itemList = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "DawaSetu Medicine and Pharmacy Guides",
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://dawasetu-omega.vercel.app"}/blog`,
    blogPost: result.posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      description: post.summary,
      url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://dawasetu-omega.vercel.app"}/blog/${encodeURIComponent(post.slug)}`,
      datePublished: post.published_at,
    })),
  };
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(itemList) }}
      />
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Home</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">Updates</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Medicine · Pharmacy · Health information
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Practical information for finding local medicine availability and
          speaking with a pharmacy. These articles do not diagnose, prescribe,
          or recommend medicine substitutions.
        </p>
        {result.error && (
          <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            Live blog updates are temporarily unavailable. The DawaSetu
            editorial guides are still available below.
          </p>
        )}
        {result.posts.length === 0 ? (
          <div className="mt-7">
            <EmptyState
              title="No posts have been published yet"
              description="New DawaSetu guides will appear here when the team publishes them."
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
