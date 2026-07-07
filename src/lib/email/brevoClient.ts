import { KEY_API_BREVO, EMAIL_PARTICIPANT_ONLY_RECIPIENT } from "astro:env/server";
import { recordFailedEmail } from "@lib/email/failedEmailStore";

type BrevoRecipient = { email: string; name?: string };

export type BrevoEmailPayload = {
  sender: { email: string; name?: string };
  to: BrevoRecipient[];
  subject: string;
  htmlContent: string;
  attachment?: Array<{ name: string; content: string }>;
};

export type SendBrevoEmailOptions = {
  route: string;
  requestId: string;
  kind: "participant" | "admin";
  programSlug?: string;
  stripeSessionId?: string;
};

export async function sendBrevoEmail(
  payload: BrevoEmailPayload,
  options: SendBrevoEmailOptions,
): Promise<{ ok: true } | { ok: false; status?: number; reason: string }> {
  const brevoKey = (KEY_API_BREVO ?? "").trim();
  if (!brevoKey) {
    const reason = "KEY_API_BREVO is not configured";
    recordFailedEmail({
      ...options,
      to: payload.to.map((recipient) => recipient.email),
      subject: payload.subject,
      reason,
    });
    return { ok: false, reason };
  }

  // Safety valve for tests/staging: force all participant emails to a single recipient.
  // Admin emails are already handled separately via EMAIL_ADMIN_ONLY_RECIPIENT in programAdminRecipients().
  const onlyParticipant = (EMAIL_PARTICIPANT_ONLY_RECIPIENT ?? "").trim();
  if (onlyParticipant && options.kind === "participant") {
    payload = { ...payload, to: [{ email: onlyParticipant }] };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": brevoKey,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) return { ok: true };

    const errorText = await response.text().catch(() => "");
    const reason = `Brevo ${response.status}: ${errorText.slice(0, 500)}`;
    recordFailedEmail({
      ...options,
      to: payload.to.map((recipient) => recipient.email),
      subject: payload.subject,
      reason,
    });
    return { ok: false, status: response.status, reason };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    recordFailedEmail({
      ...options,
      to: payload.to.map((recipient) => recipient.email),
      subject: payload.subject,
      reason,
    });
    return { ok: false, reason };
  }
}
