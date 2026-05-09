export const prerender = false;

import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import {
  CONTACT_EMAIL,
  SMTP_FROM,
} from "astro:env/server";
import { escapeHtml } from "@lib/htmlEscape";
import { apiLog, getRequestId, jsonResponse } from "@lib/server/apiRequestLog";
import { getProgramPathSlug } from "@lib/programPaths";
import { programIsPublished } from "@lib/programPublished";
import {
  guardPublicPost,
  hasHoneypotValue,
  honeypotResponse,
} from "@lib/server/publicEndpointGuards";
import { sendBrevoEmail } from "@lib/email/brevoClient";
import { sanitizeEmailSubjectLine } from "@lib/email/outboundMailGuards";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s().-]{7,24}$/;

function clean(value: unknown, max: number): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max)
    : "";
}

function isSafePublicPdfPath(value: string): boolean {
  return (
    value.startsWith("/") &&
    value.toLowerCase().endsWith(".pdf") &&
    !value.includes("..") &&
    !/^\/\//.test(value)
  );
}

export const POST: APIRoute = async ({ request }) => {
  const requestId = getRequestId(request);
  const route = "POST /api/brochure-download";
  const guarded = guardPublicPost(request, {
    route,
    requestId,
    rateLimitKey: "brochure",
    limit: 5,
    windowMs: 10 * 60_000,
    expectedContentType: "json",
  });
  if (guarded) return guarded;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (hasHoneypotValue(body)) {
    return honeypotResponse(route, requestId);
  }

  const name = clean(body?.name, 120);
  const email = clean(body?.email, 254).toLowerCase();
  const phone = clean(body?.phone, 30);
  const message = clean(body?.message, 800);
  const programTitle = clean(body?.programTitle, 180);
  const programSlug = clean(body?.programSlug, 120);
  const brochure = clean(body?.brochure, 240);

  if (!name || !EMAIL_RE.test(email) || !PHONE_RE.test(phone) || !programTitle) {
    return jsonResponse(
      {
        error: "Completa nombre, correo, teléfono y programa.",
        code: "invalid_brochure_lead",
      },
      400,
      requestId,
    );
  }

  if (!isSafePublicPdfPath(brochure)) {
    return jsonResponse(
      {
        error: "Brochure no válido.",
        code: "invalid_brochure",
      },
      400,
      requestId,
    );
  }

  const programs = await getCollection("programas");
  const program = programs.find(
    (entry) =>
      getProgramPathSlug(entry) === programSlug ||
      String(entry.data.title ?? "") === programTitle,
  );
  const configuredBrochure =
    typeof program?.data.brochure === "string"
      ? program.data.brochure.trim()
      : "";

  if (
    !program ||
    !programIsPublished(program) ||
    configuredBrochure !== brochure ||
    !isSafePublicPdfPath(configuredBrochure)
  ) {
    apiLog("warn", route, "brochure_program_mismatch", {
      requestId,
      programSlug,
      brochure,
      code: "brochure_program_mismatch",
    });
    return jsonResponse(
      {
        error: "Brochure no disponible para este programa.",
        code: "brochure_program_mismatch",
      },
      400,
      requestId,
    );
  }

  const toEmail = (CONTACT_EMAIL ?? "").trim();
  if (!toEmail) {
    apiLog("error", route, "brochure_email_not_configured", { requestId });
    return jsonResponse(
      {
        error: "No pudimos registrar tu solicitud. Intenta de nuevo más tarde.",
        code: "email_not_configured",
      },
      503,
      requestId,
    );
  }

  const senderEmail = (SMTP_FROM ?? "").trim() || "desarrolloweb@ceprija.edu.mx";
  const safeProgram = escapeHtml(programTitle);
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone);
  const safeBrochure = escapeHtml(brochure);
  const safeMessage = escapeHtml(message || "Sin mensaje adicional");

  const emailResult = await sendBrevoEmail(
    {
      sender: { email: senderEmail, name: "CEPRIJA Web" },
      to: [{ email: toEmail }],
      subject: sanitizeEmailSubjectLine(`Descarga de brochure: ${programTitle}`),
      htmlContent: `
        <h2>Nueva descarga de brochure</h2>
        <p><strong>Programa:</strong> ${safeProgram}</p>
        <p><strong>Slug:</strong> ${escapeHtml(programSlug || "N/A")}</p>
        <p><strong>Brochure:</strong> ${safeBrochure}</p>
        <hr>
        <p><strong>Nombre:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Teléfono:</strong> ${safePhone}</p>
        <p><strong>Mensaje:</strong> ${safeMessage}</p>
      `,
    },
    {
      route,
      requestId,
      kind: "admin",
      programSlug,
    },
  );

  if (!emailResult.ok) {
    apiLog("error", route, "brochure_email_failed", {
      requestId,
      programSlug,
      brevoStatus: emailResult.status,
    });
    return jsonResponse(
      {
        error: "No pudimos registrar tu solicitud. Intenta de nuevo más tarde.",
        code: "brochure_email_failed",
      },
      502,
      requestId,
    );
  }

  apiLog("info", route, "brochure_lead_registered", {
    requestId,
    programSlug,
  });

  return jsonResponse({ success: true, brochure }, 200, requestId);
};
