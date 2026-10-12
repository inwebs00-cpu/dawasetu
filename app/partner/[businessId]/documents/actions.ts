"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireBusinessPermission } from "@/lib/auth/authorization";
import { validatePrivateUpload } from "@/lib/files/validate-private-upload";
import type { AuthActionState } from "@/types/auth";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function uploadBusinessDocumentAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const businessId = field(formData, "business_id");
  const documentType = field(formData, "document_type");
  const attachmentValue = formData.get("attachment");
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) {
    return { error: "Choose a valid business." };
  }
  if (
    !new Set(["license", "registration", "insurance", "other"]).has(
      documentType,
    )
  ) {
    return { error: "Choose a document type." };
  }
  if (!(attachmentValue instanceof File) || attachmentValue.size === 0) {
    return { error: "Choose a document to upload." };
  }

  const validation = await validatePrivateUpload(attachmentValue);
  if (!validation.valid) return { error: validation.error };

  try {
    const { supabase, user } = await requireBusinessPermission(
      businessId,
      "partners.manage",
    );
    const storagePath = `${businessId}/${user.id}/${randomUUID()}.${validation.file.extension}`;
    const { error: uploadError } = await supabase.storage
      .from("business-documents")
      .upload(storagePath, attachmentValue, {
        contentType: validation.file.contentType,
        upsert: false,
      });
    if (uploadError) {
      return { error: "The document could not be uploaded. Please try again." };
    }

    const { error } = await supabase.rpc("save_my_business_document", {
      p_business_id: businessId,
      p_document_type: documentType,
      p_storage_path: storagePath,
    });
    if (error) {
      await supabase.storage.from("business-documents").remove([storagePath]);
      return {
        error: "The document could not be attached to this business.",
      };
    }
    revalidatePath(`/partner/${businessId}/documents`);
    revalidatePath(`/admin/partners/${businessId}/documents`);
    return { message: "Document uploaded and sent for review." };
  } catch {
    return { error: "Document upload is temporarily unavailable." };
  }
}

export async function downloadBusinessDocumentAction(formData: FormData) {
  const businessId = field(formData, "business_id");
  const documentId = field(formData, "document_id");
  if (
    !/^[0-9a-f-]{36}$/i.test(businessId) ||
    !/^[0-9a-f-]{36}$/i.test(documentId)
  ) {
    redirect("/partner?error=document");
  }
  try {
    const { supabase } = await requireBusinessPermission(
      businessId,
      "partners.manage",
    );
    const { data, error } = await supabase.rpc(
      "get_authorized_business_document_path",
      { p_document_id: documentId },
    );
    const storagePath = data?.[0]?.storage_path;
    if (error || !storagePath || !storagePath.startsWith(`${businessId}/`)) {
      redirect(`/partner/${businessId}/documents?error=download`);
    }
    const { data: signed, error: signedError } = await supabase.storage
      .from("business-documents")
      .createSignedUrl(storagePath, 60, { download: true });
    if (signedError || !signed?.signedUrl) {
      redirect(`/partner/${businessId}/documents?error=download`);
    }
    redirect(signed.signedUrl);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`/partner/${businessId}/documents?error=download`);
  }
}
