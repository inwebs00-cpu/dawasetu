import "server-only";

type EmailContent = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export interface EmailDeliveryResult {
  sent: boolean;
  configured: boolean;
}

const defaultSupportEmail = "dawasetuofficial@gmail.com";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function absoluteSiteUrl(path: string): string {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol === "https:" || parsed.hostname === "localhost") {
        return new URL(path, parsed.origin).toString();
      }
    } catch {
      // Fall through to Vercel's deployment URL or a relative path.
    }
  }
  const vercelUrl = process.env.VERCEL_URL?.trim();
  return vercelUrl ? `https://${vercelUrl}${path}` : path;
}

async function sendEmail(content: EmailContent): Promise<EmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const recipient = content.to.trim();
  if (!apiKey || !from || !validEmail(from) || !validEmail(recipient)) {
    return { sent: false, configured: false };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        from: `DawaSetu Support <${from}>`,
        to: [recipient],
        subject: content.subject,
        text: content.text,
        html: content.html,
      }),
    });
    if (!response.ok) {
      console.error("DawaSetu support email delivery failed", response.status);
      return { sent: false, configured: true };
    }
    return { sent: true, configured: true };
  } catch {
    console.error("DawaSetu support email delivery failed");
    return { sent: false, configured: true };
  }
}

export function getSupportNotificationEmail(): string {
  return process.env.SUPPORT_NOTIFICATION_EMAIL?.trim() || defaultSupportEmail;
}

export async function notifySupportTeamOfNewTicket(input: {
  ticketNumber: number;
  subject: string;
  category: string;
}): Promise<EmailDeliveryResult> {
  const ticketUrl = absoluteSiteUrl("/admin/support");
  const subject = `New DawaSetu support ticket #${input.ticketNumber}`;
  const text = [
    "A new support ticket was submitted to DawaSetu.",
    `Ticket: #${input.ticketNumber}`,
    `Category: ${input.category}`,
    `Subject: ${input.subject}`,
    `Open the support inbox: ${ticketUrl}`,
  ].join("\n");
  const html = `
    <p>A new support ticket was submitted to DawaSetu.</p>
    <p><strong>Ticket:</strong> #${input.ticketNumber}<br>
    <strong>Category:</strong> ${escapeHtml(input.category)}<br>
    <strong>Subject:</strong> ${escapeHtml(input.subject)}</p>
    <p><a href="${escapeHtml(ticketUrl)}">Open the support inbox</a></p>
  `;
  return sendEmail({
    to: getSupportNotificationEmail(),
    subject,
    text,
    html,
  });
}

export async function notifySupportTeamOfCustomerReply(input: {
  ticketNumber: number;
  subject: string;
}): Promise<EmailDeliveryResult> {
  const ticketUrl = absoluteSiteUrl("/admin/support");
  const subject = `Customer replied to DawaSetu ticket #${input.ticketNumber}`;
  const text = [
    `A customer added a reply to DawaSetu ticket #${input.ticketNumber}.`,
    `Ticket subject: ${input.subject}`,
    `Open the support inbox: ${ticketUrl}`,
  ].join("\n");
  const html = `
    <p>A customer added a reply to support ticket #${input.ticketNumber}.</p>
    <p><strong>Ticket subject:</strong> ${escapeHtml(input.subject)}</p>
    <p><a href="${escapeHtml(ticketUrl)}">Open the support inbox</a></p>
  `;
  return sendEmail({
    to: getSupportNotificationEmail(),
    subject,
    text,
    html,
  });
}

export async function notifyRequesterOfSupportUpdate(input: {
  to: string;
  ticketNumber: number;
  subject: string;
  status: string;
  publicReply?: string;
}): Promise<EmailDeliveryResult> {
  const ticketUrl = absoluteSiteUrl("/account/support");
  const reply = input.publicReply?.trim();
  const subject = `DawaSetu support ticket #${input.ticketNumber} updated`;
  const text = [
    `Your DawaSetu support ticket #${input.ticketNumber} has been updated.`,
    `Subject: ${input.subject}`,
    `Status: ${input.status.replaceAll("_", " ")}`,
    ...(reply ? ["DawaSetu support reply:", reply] : []),
    `Sign in to view the ticket: ${ticketUrl}`,
  ].join("\n\n");
  const html = `
    <p>Your DawaSetu support ticket #${input.ticketNumber} has been updated.</p>
    <p><strong>Subject:</strong> ${escapeHtml(input.subject)}<br>
    <strong>Status:</strong> ${escapeHtml(input.status.replaceAll("_", " "))}</p>
    ${reply ? `<p><strong>DawaSetu support reply:</strong></p><p>${escapeHtml(reply).replaceAll("\n", "<br>")}</p>` : ""}
    <p><a href="${escapeHtml(ticketUrl)}">Sign in to view your ticket</a></p>
  `;
  return sendEmail({ to: input.to, subject, text, html });
}
