"use server";

import { revalidatePath } from "next/cache";

import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { notifySupportTeamOfCustomerReply } from "@/lib/notifications/support-email";
import type { AuthActionState } from "@/types/auth";

export async function replyToSupportTicketAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const ticketValue = formData.get("ticket_id");
  const messageValue = formData.get("message");
  const ticketId = typeof ticketValue === "string" ? ticketValue : "";
  const message = typeof messageValue === "string" ? messageValue.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(ticketId)) {
    return { error: "Choose a valid support ticket." };
  }
  if (message.length < 1 || message.length > 5000) {
    return { error: "Enter a reply between 1 and 5,000 characters." };
  }
  try {
    const { supabase } = await requireAuthenticatedUser();
    const { data: ticketNumber, error } = await supabase.rpc(
      "add_my_support_ticket_message",
      {
        p_ticket_id: ticketId,
        p_message: message,
      },
    );
    if (error) {
      if (error.message.toLowerCase().includes("closed")) {
        return {
          error: "This ticket is closed and can no longer receive replies.",
        };
      }
      if (error.message.toLowerCase().includes("wait")) {
        return {
          error: "Please wait a few minutes before sending another reply.",
        };
      }
      return { error: "Your reply could not be sent. Refresh and try again." };
    }
    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("subject")
      .eq("id", ticketId)
      .maybeSingle();
    const notification = ticket
      ? await notifySupportTeamOfCustomerReply({
          ticketNumber: Number(ticketNumber),
          subject: ticket.subject,
        })
      : { sent: false, configured: false };
    revalidatePath("/account/support");
    return {
      message: notification.sent
        ? "Your reply was added and the support team was notified by email."
        : "Your reply was added. The support team can see it in the support inbox.",
    };
  } catch {
    return { error: "Support is temporarily unavailable. Try again shortly." };
  }
}
