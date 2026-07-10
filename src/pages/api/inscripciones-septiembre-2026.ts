export const prerender = false;

import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { SMTP_FROM } from "astro:env/server";
import { escapeHtml } from "@lib/htmlEscape";
import { apiLog, getRequestId, jsonResponse } from "@lib/server/apiRequestLog";
import { getProgramPathSlug } from "@lib/programPaths";
import { getProgramStatus } from "@lib/programPayments";
import {
  guardPublicPost,
  hasHoneypotValue,
  honeypotResponse,
} from "@lib/server/publicEndpointGuards";
import { sendBrevoEmail } from "@lib/email/brevoClient";
import { programAdminRecipients } from "@lib/email/programAdminRecipients";
import { sanitizeEmailSubjectLine } from "@lib/email/outboundMailGuards";
import { persistSubmission, logEmailAttempt } from "@lib/db/submissions";
import { logPersistenceFailure } from "@lib/db/logPersistenceFailure";
import { programSubmissionMeta } from "@lib/programSubmissionMeta";
import {
  validateEmail,
  validateParticipantName,
} from "@lib/validation/enrollment";
import { MAX_FULL_NAME_LEN, TEXT_MAX_LENGTH_BY_NAME } from "@lib/validation/formFieldLimits";
import { isValidPhone } from "@lib/validation/phone";
import crypto from "node:crypto";

const CAMPAIGN = "septiembre_2026";
const START_CYCLE = "Septiembre 2026";

const ALLOWED_PROGRAMS = [
  "Maestría en Derecho Internacional de Derechos Humanos y Litigio Estratégico",
  "Especialidad en Criminalística y Ciencias Forenses",
  "Maestría en Derecho Civil y Familiar",
  "Doctorado en Derecho Procesal y Sistemas Contemporáneos",
] as const;

function clean(value: unknown, max: number): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max)
    : "";
}

export const POST: APIRoute = async ({ request }) => {
  const requestId = getRequestId(request);
  const route = "POST /api/inscripciones-septiembre-2026";
  const guarded = guardPublicPost(request, {
    route,
    requestId,
    rateLimitKey: "inscripciones-septiembre-2026",
    limit: 8,
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

  const name = clean(body?.name, MAX_FULL_NAME_LEN);
  const email = clean(body?.email, 254).toLowerCase();
  const phone = clean(body?.phone, 30);
  const carrera = clean(body?.carrera, TEXT_MAX_LENGTH_BY_NAME.carrera ?? 150);
  const programTitle = clean(body?.program, 180);
  const startCycle = clean(body?.startCycle, 40) || START_CYCLE;

  const nameErr = validateParticipantName(name, "name", MAX_FULL_NAME_LEN);
  if (nameErr) {
    return jsonResponse(
      { message: nameErr.error, code: nameErr.code, field: nameErr.field },
      400,
      requestId,
    );
  }

  const emailErr = validateEmail(email);
  if (emailErr) {
    return jsonResponse(
      { message: emailErr.error, code: emailErr.code, field: emailErr.field },
      400,
      requestId,
    );
  }

  if (!isValidPhone(phone)) {
    return jsonResponse(
      {
        message:
          "Teléfono no válido (10 dígitos en México o +52 / 521…)",
        code: "invalid_phone",
        field: "phone",
      },
      400,
      requestId,
    );
  }

  if (!carrera) {
    return jsonResponse(
      { message: "Indica la carrera que estudiaste.", code: "missing_carrera", field: "carrera" },
      400,
      requestId,
    );
  }

  if (!ALLOWED_PROGRAMS.includes(programTitle as (typeof ALLOWED_PROGRAMS)[number])) {
    return jsonResponse(
      {
        message: "Programa no válido para esta campaña.",
        code: "invalid_program",
        field: "program",
      },
      400,
      requestId,
    );
  }

  if (startCycle !== START_CYCLE) {
    return jsonResponse(
      {
        message: "Ciclo de inicio no válido.",
        code: "invalid_start_cycle",
        field: "startCycle",
      },
      400,
      requestId,
    );
  }

  const programs = await getCollection("programas");
  const program = programs.find((p) => p.data.title === programTitle);
  if (program && getProgramStatus(program) === "disabled") {
    return jsonResponse(
      { message: "Programa no disponible", code: "program_unavailable" },
      400,
      requestId,
    );
  }

  const programSlug = program ? getProgramPathSlug(program) : programTitle;
  const submissionRequestId = crypto.randomUUID();

  const submission = await persistSubmission(
    {
      requestId: submissionRequestId,
      flow: "register",
      personKind: "applicant",
      workflowStatus: "received",
      email,
      phone,
      programSlug,
      programTitle,
      apiRoute: route,
      payload: {
        name,
        email,
        phone,
        carrera,
        programTitle,
        startCycle,
        campaign: CAMPAIGN,
        source: "/inscripciones-septiembre-2026",
        ...programSubmissionMeta(program),
      },
      ip:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    },
    route,
    { timeoutMs: 8000 },
  );

  if (!submission.ok) {
    apiLog("warn", route, "school_hub_persist_failed", {
      requestId,
      reason: submission.reason,
      email: email.slice(0, 3) + "***",
    });
    logPersistenceFailure({
      route,
      requestId: submissionRequestId,
      flow: "register",
      reason: submission.reason,
      email,
      error: submission.error,
    });
    return jsonResponse(
      {
        message:
          "No pudimos registrar tu solicitud en este momento. Intenta de nuevo más tarde.",
        code: "school_hub_persist_failed",
      },
      503,
      requestId,
    );
  }

  const submissionId = submission.submissionId;
  const senderEmail = (SMTP_FROM ?? "").trim() || "desarrolloweb@ceprija.edu.mx";
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone);
  const safeProgram = escapeHtml(programTitle);
  const safeCycle = escapeHtml(startCycle);
  const safeCarrera = escapeHtml(carrera);

  const adminSubject = sanitizeEmailSubjectLine(
    `Registro inicial Septiembre 2026: ${programTitle}`,
  );
  const adminHtml = `
    <h2>Nuevo registro de interés — Ciclo Septiembre 2026</h2>
    <p><strong>Campaña:</strong> ${escapeHtml(CAMPAIGN)}</p>
    <p><strong>Programa:</strong> ${safeProgram}</p>
    <p><strong>Ciclo de inicio:</strong> ${safeCycle}</p>
    <hr>
    <p><strong>Nombre:</strong> ${safeName}</p>
    <p><strong>Carrera:</strong> ${safeCarrera}</p>
    <p><strong>Correo:</strong> ${safeEmail}</p>
    <p><strong>Teléfono:</strong> ${safePhone}</p>
  `;

  const adminRes = await sendBrevoEmail(
    {
      sender: { email: senderEmail, name: "CEPRIJA Web" },
      to: programAdminRecipients(program),
      subject: adminSubject,
      htmlContent: adminHtml,
    },
    { route, requestId, kind: "admin", programSlug },
  );

  await logEmailAttempt({
    submissionId,
    route,
    kind: "admin",
    recipients: programAdminRecipients(program).map((r) => r.email),
    subject: adminSubject,
    status: adminRes.ok ? "sent" : "failed",
    failureReason: adminRes.ok ? undefined : `brevo_status_${adminRes.status}`,
    idempotencyKey: `${submissionRequestId}_admin`,
    programSlug,
  });

  if (!adminRes.ok) {
    apiLog("error", route, "admin_email_failed", {
      requestId,
      programSlug,
      brevoStatus: adminRes.status,
    });
    return jsonResponse(
      {
        message:
          "Registramos tu solicitud, pero hubo un problema al notificar al equipo. Intenta de nuevo o contáctanos.",
        code: "admin_email_failed",
      },
      502,
      requestId,
    );
  }

  const userSubject = sanitizeEmailSubjectLine(
    "Recibimos tu registro de interés — CEPRIJA Septiembre 2026",
  );
  const userHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background-color: #f8fafc; padding: 30px 20px; text-align: center; border-bottom: 2px solid #1e3a8a;">
        <img src="https://ceprija.edu.mx/images/logo.png" alt="CEPRIJA" style="max-width: 200px; height: auto; margin: 0 auto; display: block;">
      </div>
      <div style="padding: 30px 20px; background-color: #ffffff;">
        <p>Estimado(a) <strong>${safeName}</strong>,</p>
        <p>Recibimos tu registro de interés para el ciclo <strong>${safeCycle}</strong> en el programa:</p>
        <p><strong>${safeProgram}</strong></p>
        <p>Un asesor de CEPRIJA se pondrá en contacto contigo pronto para brindarte información y acompañarte en tu proceso de inscripción.</p>
        <p style="font-size: 14px; color: #666; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          Para cualquier duda:<br>
          📱 <strong>WhatsApp:</strong> <a href="https://wa.me/+523317674864" style="color: #2563eb; text-decoration: none;">33 1767 4864</a><br>
          ✉️ <strong>Correo:</strong> <a href="mailto:contacto@ceprija.edu.mx" style="color: #2563eb; text-decoration: none;">contacto@ceprija.edu.mx</a>
        </p>
      </div>
    </div>
  `;

  const userRes = await sendBrevoEmail(
    {
      sender: { email: senderEmail, name: "Equipo CEPRIJA" },
      to: [{ email }],
      subject: userSubject,
      htmlContent: userHtml,
    },
    { route, requestId, kind: "participant", programSlug },
  );

  await logEmailAttempt({
    submissionId,
    route,
    kind: "participant",
    recipients: [email],
    subject: userSubject,
    status: userRes.ok ? "sent" : "failed",
    failureReason: userRes.ok ? undefined : `brevo_status_${userRes.status}`,
    idempotencyKey: `${submissionRequestId}_user`,
    programSlug,
  });

  if (!userRes.ok) {
    apiLog("warn", route, "user_email_failed", {
      requestId,
      programSlug,
      brevoStatus: userRes.status,
    });
  }

  apiLog("info", route, "interest_registered", {
    requestId,
    submissionRequestId,
    programSlug,
    submissionId,
  });

  return jsonResponse(
    {
      message: "Recibido correctamente",
      submissionId,
    },
    200,
    requestId,
  );
};
