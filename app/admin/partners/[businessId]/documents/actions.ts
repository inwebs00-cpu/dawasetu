"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformPermission } from "@/lib/auth/authorization";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function reviewBusinessDocumentAction(formData: FormData) {
  const businessId = field(formData, "business_id");
  const documentId = field(formData, "document_id");
  const status = field(formData, "status");
  const reviewNote = field(formData, "review_note");
  if (
    !/^[0-9a-f-]{36}$/i.test(businessId) ||
    !/^[0-9a-f-]{36}$/i.test(documentId) ||
    !new Set(["approved", "rejected"]).has(status) ||
    reviewNote.length > 1000
  ) {
    redirect(`/admin/partners/${businessId}/documents?error=invalid`);
  }
  try {
    const { supabase } = await requirePlatformPermission("partners.approve");
    const { error } = await supabase.rpc("admin_review_business_document", {
      p_document_id: documentId,
      p_status: status,
      p_review_note: reviewNote || null,
    });
    if (error) {
      redirect(`/admin/partners/${businessId}/documents?error=review`);
    }
    revalidatePath(`/admin/partners/${businessId}/documents`);
    revalidatePath("/admin/partners");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`/admin/partners/${businessId}/documents?error=review`);
  }
  redirect(`/admin/partners/${businessId}/documents?updated=1`);
}

export async function downloadAdminBusinessDocumentAction(formData: FormData) {
  const businessId = field(formData, "business_id");
  const documentId = field(formData, "document_id");
  if (
    !/^[0-9a-f-]{36}$/i.test(businessId) ||
    !/^[0-9a-f-]{36}$/i.test(documentId)
  ) {
    redirect("/admin/partners?error=document");
  }
  try {
    const { supabase } = await requirePlatformPermission("partners.view");
    const { data, error } = await supabase.rpc(
      "get_authorized_business_document_path",
      { p_document_id: documentId },
    );
    const storagePath = data?.[0]?.storage_path;
    if (error || !storagePath || !storagePath.startsWith(`${businessId}/`)) {
      redirect(`/admin/partners/${businessId}/documents?error=download`);
    }
    const { data: signed, error: signedError } = await supabase.storage
      .from("business-documents")
      .createSignedUrl(storagePath, 60, { download: true });
    if (signedError || !signed?.signedUrl) {
      redirect(`/admin/partners/${businessId}/documents?error=download`);
    }
    redirect(signed.signedUrl);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`/admin/partners/${businessId}/documents?error=download`);
  }
}
