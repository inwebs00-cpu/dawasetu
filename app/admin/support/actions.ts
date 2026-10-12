"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformPermission } from "@/lib/auth/authorization";

export async function updateSupportTicketAction(formData: FormData) {
  const ticketId = formData.get("ticket_id");
  const status = formData.get("status");
  const priority = formData.get("priority");
  const messageValue = formData.get("message");
  const message = typeof messageValue === "string" ? messageValue.trim() : "";
  const internal = formData.get("internal") === "on";
  const assignToMe = formData.get("assign_to_me") === "on";

  if (
    typeof ticketId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(ticketId) ||
    typeof status !== "string" ||
    typeof priority !== "string" ||
    message.length > 5000 ||
    (internal && !message)
  ) {
    redirect("/admin/support?error=invalid");
  }

  try {
    const { supabase } = await requirePlatformPermission("support.manage");
    const { error } = await supabase.rpc("admin_update_support_ticket", {
      p_ticket_id: ticketId,
      p_status: status,
      p_priority: priority,
      p_message: message || null,
      p_internal: internal,
      p_assign_to_me: assignToMe,
    });
    if (error) redirect("/admin/support?error=save");
    revalidatePath("/admin/support");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/admin/support?error=save");
  }

  redirect("/admin/support?updated=1");
}

export async function assignSupportTicketAction(formData: FormData) {
  const ticketId = formData.get("ticket_id");
  const assignedValue = formData.get("assigned_to");
  const assignedTo =
    typeof assignedValue === "string" && assignedValue ? assignedValue : null;
  if (
    typeof ticketId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(ticketId) ||
    (assignedTo !== null && !/^[0-9a-f-]{36}$/i.test(assignedTo))
  ) {
    redirect("/admin/support?error=invalid");
  }
  try {
    const { supabase } = await requirePlatformPermission("support.manage");
    const { error } = await supabase.rpc("admin_assign_support_ticket", {
      p_ticket_id: ticketId,
      p_assigned_to: assignedTo,
    });
    if (error) redirect("/admin/support?error=assign");
    revalidatePath("/admin/support");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/admin/support?error=assign");
  }
  redirect("/admin/support?updated=assigned");
}
