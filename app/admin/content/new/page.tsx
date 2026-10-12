import Link from "next/link";
import type { Metadata } from "next";

import { ContentPostForm } from "@/components/admin/content-post-form";
import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { requirePlatformPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Write an update" };

export default async function NewContentPage() {
  await requirePlatformPermission("content.manage");
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/content">All posts</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Content management
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Write an update
        </h1>
        <div className="mt-6">
          <ContentPostForm postId={null} />
        </div>
      </div>
    </main>
  );
}
