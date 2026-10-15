"use server";

import { randomUUID } from "node:crypto";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validatePrivateUpload } from "@/lib/files/validate-private-upload";
import { notifySupportTeamOfNewTicket } from "@/lib/notifications/support-email";
import type { AuthActionState } from "@/types/auth";

const ticketCategories = new Set([
  "account",
  "partner onboarding",
  "medicine availability",
  "billing or payments",
  "privacy or safety",
  "other",
]);

export async function createSupportTicketAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const subjectValue = formData.get("subject");
  const categoryValue = formData.get("category");
  const descriptionValue = formData.get("description");
  const attachmentValue = formData.get("attachment");
  const subject = typeof subjectValue === "string" ? subjectValue.trim() : "";
  const category =
    typeof categoryValue === "string" ? categoryValue.trim().toLowerCase() : "";
  const description =
    typeof descriptionValue === "string" ? descriptionValue.trim() : "";
  const attachment =
    attachmentValue instanceof File && attachmentValue.size > 0
      ? attachmentValue
      : null;

  if (subject.length < 3 || subject.length > 200) {
    return { error: "Enter a subject between 3 and 200 characters." };
  }
  if (!ticketCategories.has(category)) {
    return { error: "Choose a valid support category." };
  }
  if (description.length < 10 || description.length > 5000) {
    return { error: "Describe the issue in 10 to 5,000 characters." };
  }
  let attachmentType: {
    extension: "pdf" | "jpg" | "png";
    contentType: "application/pdf" | "image/jpeg" | "image/png";
  } | null = null;
  if (attachment) {
    const validation = await validatePrivateUpload(attachment);
    if (!validation.valid) return { error: validation.error };
    attachmentType = validation.file;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: "Sign in again to create a support ticket." };
    }
    const { data: profile } = await supabase
      .from("users")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.status !== "active") {
      return { error: "This account cannot create support tickets right now." };
    }

    const attachmentPath = attachmentType
      ? `${user.id}/${randomUUID()}.${attachmentType.extension}`
      : null;
    if (attachment && attachmentType && attachmentPath) {
      const { error: uploadError } = await supabase.storage
        .from("support-attachments")
        .upload(attachmentPath, attachment, {
          contentType: attachmentType.contentType,
          upsert: false,
        });
      if (uploadError) {
        return {
          error: "The attachment could not be uploaded. Please try again.",
        };
      }
    }

    const { data, error } = await supabase
      .from("support_tickets")
      .insert({
        requester_user_id: user.id,
        category,
        subject,
        description,
        attachment_path: attachmentPath,
        priority: "normal",
      })
      .select("ticket_number")
      .single();
    if (error || !data) {
      if (attachmentPath) {
        await supabase.storage
          .from("support-attachments")
          .remove([attachmentPath]);
      }
      return { error: "Your ticket could not be created. Please try again." };
    }
    const delivery = await notifySupportTeamOfNewTicket({
      ticketNumber: data.ticket_number,
      subject,
      category,
    });
    return {
      message: delivery.sent
        ? `Support ticket #${data.ticket_number} has been submitted. The support team has been notified by email.`
        : delivery.configured
          ? `Support ticket #${data.ticket_number} has been saved, but the email alert could not be sent. You can still track replies in your account.`
          : `Support ticket #${data.ticket_number} has been saved. Email alerts are not configured yet; you can track replies in your account.`,
    };
  } catch {
    return {
      error: "Support is temporarily unavailable. Please try again shortly.",
    };
  }
}
