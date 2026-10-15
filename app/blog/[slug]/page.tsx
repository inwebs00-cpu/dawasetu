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
        alternates: { canonical: `/blog/${encodeURIComponent(post.slug)}` },
        openGraph: {
          title: post.seo_title || post.title,
          description: post.seo_description || post.summary,
          type: "article",
          publishedTime: post.published_at,
        },
        twitter: {
          card: "summary_large_image",
          title: post.seo_title || post.title,
          description: post.seo_description || post.summary,
        },
      }
    : { title: "DawaSetu update" };
}

function safeJsonLd(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
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
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://dawasetu-omega.vercel.app"
  ).replace(/\/$/, "");
  const articleStructuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seo_description || post.summary,
    datePublished: post.published_at,
    dateModified: post.published_at,
    mainEntityOfPage: `${siteUrl}/blog/${encodeURIComponent(post.slug)}`,
    author: { "@type": "Organization", name: "DawaSetu Editorial Team" },
    publisher: { "@type": "Organization", name: "DawaSetu" },
  };
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(articleStructuredData) }}
      />
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
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-base leading-8 text-slate-700 sm:p-8">
          {post.sections ? (
            <div className="space-y-8">
              {post.sections.map((section) => (
                <section key={section.heading}>
                  <h2 className="text-xl leading-7 font-semibold text-slate-950">
                    {section.heading}
                  </h2>
                  <div className="mt-3 space-y-4">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                  {section.bullets && (
                    <ul className="mt-4 list-disc space-y-2 pl-6">
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="whitespace-pre-wrap">{post.content}</div>
          )}
          {post.sources && post.sources.length > 0 && (
            <section className="mt-8 border-t border-slate-200 pt-6">
              <h2 className="text-lg font-semibold text-slate-950">
                Trusted references
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                {post.sources.map((source) => (
                  <li key={source.url}>
                    <a
                      className="text-teal-800 underline underline-offset-2 hover:text-teal-950"
                      href={source.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {source.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="mt-8 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            General information only; it is not a diagnosis, prescription or
            substitute for advice from your doctor or pharmacist. Availability
            shown on DawaSetu is partner-reported and can change. Confirm it
            directly with the pharmacy before visiting.
          </p>
        </div>
      </article>
    </main>
  );
}
