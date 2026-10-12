import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePlatformPermission } from "@/lib/auth/authorization";

import {
  downloadAdminBusinessDocumentAction,
  reviewBusinessDocumentAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Partner verification documents" };

type PageParams = Promise<{ businessId: string }>;
type SearchParams = Promise<{ updated?: string; error?: string }>;

interface BusinessDocument {
  document_id: string;
  document_type: string;
  storage_path: string;
  status: string;
  review_note: string | null;
  uploaded_by_name: string;
  created_at: string;
  reviewed_at: string | null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export default async function AdminPartnerDocumentsPage({
  params,
  searchParams,
}: {
  params: PageParams;
  searchParams: SearchParams;
}) {
  const [{ businessId }, query] = await Promise.all([params, searchParams]);
  const { supabase } = await requirePlatformPermission("partners.view");
  const [{ data: business }, documentsResult, reviewPermission] =
    await Promise.all([
      supabase
        .from("businesses")
        .select("business_name")
        .eq("id", businessId)
        .maybeSingle(),
      supabase.rpc("admin_list_business_documents", {
        p_business_id: businessId,
      }),
      supabase.rpc("has_platform_permission", {
        p_permission_key: "partners.approve",
      }),
    ]);
  const documents = (documentsResult.data ?? []) as BusinessDocument[];
  const canReview = reviewPermission.data === true;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/partners">Partner businesses</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Partner verification
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          {business?.business_name ?? "Business documents"}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Verification files are private and available only to authorized
          partner reviewers and the business team.
        </p>
        {query.updated && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"
          >
            Document review saved.
          </p>
        )}
        {query.error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-900"
          >
            {query.error === "download"
              ? "The private file could not be opened."
              : "The document action could not be completed."}
          </p>
        )}
        {documentsResult.error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
          >
            Verification documents are temporarily unavailable.
          </p>
        )}
        {!documentsResult.error && documents.length === 0 ? (
          <Card className="mt-6">
            <CardContent className="p-6">
              <EmptyState
                title="No documents submitted"
                description="Partner teams can submit private verification documents from their dashboard."
              />
            </CardContent>
          </Card>
        ) : (
          <section className="mt-6 grid gap-4">
            {documents.map((document) => (
              <Card key={document.document_id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="capitalize">
                        {document.document_type}
                      </CardTitle>
                      <p className="mt-1 text-sm text-slate-600">
                        Uploaded by {document.uploaded_by_name} ·{" "}
                        {formatDate(document.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={document.status} />
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {document.review_note && (
                    <p className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                      Review note: {document.review_note}
                    </p>
                  )}
                  {document.reviewed_at && (
                    <p className="text-xs text-slate-500">
                      Reviewed {formatDate(document.reviewed_at)}
                    </p>
                  )}
                  <div className="flex flex-wrap items-end gap-3">
                    <form action={downloadAdminBusinessDocumentAction}>
                      <input
                        type="hidden"
                        name="business_id"
                        value={businessId}
                      />
                      <input
                        type="hidden"
                        name="document_id"
                        value={document.document_id}
                      />
                      <Button type="submit" variant="outline" size="sm">
                        Download private file
                      </Button>
                    </form>
                    {canReview && (
                      <form
                        action={reviewBusinessDocumentAction}
                        className="grid w-full gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
                      >
                        <input
                          type="hidden"
                          name="business_id"
                          value={businessId}
                        />
                        <input
                          type="hidden"
                          name="document_id"
                          value={document.document_id}
                        />
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Decision
                          <select
                            name="status"
                            defaultValue={
                              document.status === "rejected"
                                ? "rejected"
                                : "approved"
                            }
                            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                          >
                            <option value="approved">Approve</option>
                            <option value="rejected">Reject</option>
                          </select>
                        </label>
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Note for the partner
                          <input
                            name="review_note"
                            maxLength={1000}
                            defaultValue={document.review_note ?? ""}
                            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
                          />
                        </label>
                        <Button type="submit" size="sm">
                          Save review
                        </Button>
                      </form>
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
