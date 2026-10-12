import Link from "next/link";
import type { Metadata } from "next";

import { Brand } from "@/components/brand/brand";
import { BusinessDocumentForm } from "@/components/partner/business-document-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireBusinessPermission } from "@/lib/auth/authorization";

import { downloadBusinessDocumentAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verification documents" };

type PageParams = Promise<{ businessId: string }>;
type SearchParams = Promise<{ error?: string }>;

interface BusinessDocument {
  document_id: string;
  document_type: string;
  storage_path: string;
  status: string;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export default async function PartnerDocumentsPage({
  params,
  searchParams,
}: {
  params: PageParams;
  searchParams: SearchParams;
}) {
  const [{ businessId }, query] = await Promise.all([params, searchParams]);
  const { supabase } = await requireBusinessPermission(
    businessId,
    "partners.manage",
  );
  const { data, error } = await supabase.rpc("list_my_business_documents", {
    p_business_id: businessId,
  });
  const documents = (data ?? []) as BusinessDocument[];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Brand compact />
          <Button asChild variant="ghost" size="sm">
            <Link href={`/partner/${businessId}`}>Dashboard</Link>
          </Button>
        </header>
        <p className="text-sm font-semibold text-teal-800">
          Partner verification
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Verification documents
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Upload an operating license or other business verification document.
          Files remain private and are visible only to authorized partner
          reviewers.
        </p>
        {query.error === "download" && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-900"
          >
            That document is unavailable or you are not allowed to access it.
          </p>
        )}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Upload a document</CardTitle>
          </CardHeader>
          <CardContent>
            <BusinessDocumentForm businessId={businessId} />
          </CardContent>
        </Card>
        <section className="mt-8">
          <h2 className="text-xl font-semibold text-slate-950">
            Submitted documents
          </h2>
          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
            >
              Documents are temporarily unavailable.
            </p>
          ) : documents.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No documents uploaded"
                description="When you submit a verification document, its review status will appear here."
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {documents.map((document) => (
                <Card key={document.document_id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-950 capitalize">
                          {document.document_type}
                        </h3>
                        <StatusBadge status={document.status} />
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        Submitted {formatDate(document.created_at)}
                      </p>
                      {document.review_note && (
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          Reviewer note: {document.review_note}
                        </p>
                      )}
                    </div>
                    <form action={downloadBusinessDocumentAction}>
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
                        Download
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
