import Link from "next/link";
import type { Metadata } from "next";

import {
  ContentPostForm,
  type ContentPostValue,
} from "@/components/admin/content-post-form";
import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { requirePlatformPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit update" };
type PageParams = Promise<{ postId: string }>;

export default async function EditContentPage({
  params,
}: {
  params: PageParams;
}) {
  const { postId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(postId))
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title="Post not found"
            description="The post identifier is invalid."
          />
        </div>
      </main>
    );
  const { supabase } = await requirePlatformPermission("content.manage");
  const { data, error } = await supabase.rpc("admin_get_content_post", {
    p_post_id: postId,
  });
  const post = ((data ?? [])[0] ?? null) as ContentPostValue | null;
  if (error || !post)
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title="Post not found"
            description="This post is unavailable or may have been deleted."
          />
          <div className="mt-5 text-center">
            <Button asChild variant="outline">
              <Link href="/admin/content">All posts</Link>
            </Button>
          </div>
        </div>
      </main>
    );
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
          Edit update
        </h1>
        <Card className="mt-6">
          <CardContent className="p-0">
            <ContentPostForm postId={postId} initial={post} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
