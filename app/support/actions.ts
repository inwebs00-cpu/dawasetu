"use server";

import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/authorization";

export async function downloadSupportAttachmentAction(formData: FormData) {
  const ticketId = formData.get("ticket_id");
  const returnTo = formData.get("return_to");
  const destination =
    returnTo === "admin" ? "/admin/support" : "/account/support";
  if (typeof ticketId !== "string" || !/^[0-9a-f-]{36}$/i.test(ticketId)) {
    redirect(`${destination}?error=attachment`);
  }

  const { supabase } = await requireAuthenticatedUser();
  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .select("attachment_path")
    .eq("id", ticketId)
    .maybeSingle();
  if (error || !ticket?.attachment_path) {
    redirect(`${destination}?error=attachment`);
  }

  const { data, error: signedUrlError } = await supabase.storage
    .from("support-attachments")
    .createSignedUrl(ticket.attachment_path, 60, { download: true });
  if (signedUrlError || !data?.signedUrl) {
    redirect(`${destination}?error=attachment`);
  }

  redirect(data.signedUrl);
}
