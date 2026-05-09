/**
 * Primary paid-enrollment confirmation path: user lands on /pago-exitoso after Checkout.
 * Trust only stripeSessionId; derive participant + program from Stripe + content collection.
 * Webhook (checkout.session.completed) is secondary: logging + dedupe only — see webhook.ts.
 */
export const prerender = false;

import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import {
  EMAIL_CONTROL_ESCOLAR,
  EMAIL_SOPORTE_WEB,
  STRIPE_ALLOWED_PRICE_IDS,
  STRIPE_SECRET_KEY,
} from "astro:env/server";
import Stripe from "stripe";
import { hasEnrollmentBeenConfirmed, markEnrollmentConfirmed } from "@lib/processedStripeStore";
import { parseStripeAllowedPriceIds } from "@lib/stripeAllowedPrices";
import { validateStripeCheckoutSessionId } from "@lib/validation/enrollment";
import { escapeHtml } from "@lib/htmlEscape";
import { apiLog, getRequestId, jsonResponse } from "@lib/server/apiRequestLog";
import { validateProductionEnv } from "@lib/server/productionEnv";
import { getStripePriceIds, getProgramStatus } from "@lib/programPayments";
import { getProgramPathSlug } from "@lib/programPaths";
import { getVariantOptions } from "@lib/programVariants";
import { sanitizeEmailSubjectLine } from "@lib/email/outboundMailGuards";
import { withStripeRetry } from "@lib/stripeRetry";
import { guardPublicPost, hasHoneypotValue } from "@lib/server/publicEndpointGuards";
import { sendBrevoEmail } from "@lib/email/brevoClient";

type ProgramPriceMatch = {
  matches: boolean;
  modality: "Presencial" | "En línea" | "Por definir";
  expectedAmountCents?: number;
};

type ProgramPriceDetails = {
  modality: ProgramPriceMatch["modality"];
  expectedAmountCents?: number;
};

function addPriceId(
  target: Map<string, ProgramPriceDetails>,
  value: unknown,
  modality: ProgramPriceMatch["modality"],
  expectedAmountCents?: number,
) {
  if (typeof value !== "string") return;
  const priceId = value.trim();
  if (!priceId) return;
  target.set(priceId, { modality, expectedAmountCents });
}

function collectProgramPriceIds(program: Awaited<ReturnType<typeof getCollection<"programas">>>[number]) {
  const priceIds = new Map<string, ProgramPriceDetails>();
  const stripeIds = getStripePriceIds(program);

  addPriceId(priceIds, stripeIds?.presencial, "Presencial");
  addPriceId(priceIds, stripeIds?.online, "En línea");

  const paymentOptions = (program.data as { paymentOptions?: unknown }).paymentOptions;
  if (Array.isArray(paymentOptions)) {
    for (const option of paymentOptions) {
      if (!option || typeof option !== "object") continue;
      const row = option as {
        stripePriceId?: unknown;
        type?: unknown;
        price?: unknown;
      };
      const modality =
        row.type === "presencial"
          ? "Presencial"
          : row.type === "online"
            ? "En línea"
            : "Por definir";
      const expectedAmountCents =
        typeof row.price === "number" && Number.isFinite(row.price)
          ? Math.round(row.price * 100)
          : undefined;
      addPriceId(priceIds, row.stripePriceId, modality, expectedAmountCents);
    }
  }

  const variants = getVariantOptions(program);
  for (const option of variants?.moduleSelection?.options ?? []) {
    addPriceId(priceIds, option.stripePriceIds?.presencial, "Presencial");
    addPriceId(priceIds, option.stripePriceIds?.online, "En línea");
  }

  return priceIds;
}

function paymentIntentId(session: Stripe.Checkout.Session): string {
  const pi = session.payment_intent;
  if (typeof pi === "string") return pi;
  if (pi && typeof pi === "object" && "id" in pi) return String(pi.id);
  return "";
}

export const POST: APIRoute = async ({ request }) => {
  const requestId = getRequestId(request);
  const route = "POST /api/confirm-enrollment";
  const guarded = guardPublicPost(request, {
    route,
    requestId,
    rateLimitKey: "confirm-enrollment",
    limit: 12,
    windowMs: 10 * 60_000,
    expectedContentType: "json",
  });
  if (guarded) return guarded;

  let programSlugLog: string | undefined;
  try {
    const envCheck = validateProductionEnv();
    if (!envCheck.ok) {
      apiLog("error", route, "production_env_not_ready", {
        requestId,
        errors: envCheck.errors,
      });
      return jsonResponse(
        {
          error: "La configuración de pagos no está lista.",
          code: "payment_environment_not_ready",
        },
        503,
        requestId,
      );
    }

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (hasHoneypotValue(body)) {
      return jsonResponse({ success: true }, 200, requestId);
    }
    const stripeSessionIdRaw =
      typeof body?.stripeSessionId === "string"
        ? body.stripeSessionId.trim()
        : "";

    const sessionErr = validateStripeCheckoutSessionId(stripeSessionIdRaw);
    if (sessionErr) {
      apiLog("warn", route, "validation_failed", {
        requestId,
        code: sessionErr.code,
      });
      return jsonResponse(
        {
          error: sessionErr.error,
          code: sessionErr.code,
        },
        400,
        requestId,
      );
    }

    const stripeSessionId = stripeSessionIdRaw;

    if (hasEnrollmentBeenConfirmed(stripeSessionId)) {
      apiLog("info", route, "duplicate_confirmation", {
        requestId,
        stripeSessionId,
      });
      return jsonResponse({ success: true, duplicate: true }, 200, requestId);
    }

    const stripeSecret = STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      apiLog("error", route, "stripe_secret_missing", { requestId });
      return jsonResponse(
        {
          error: "Stripe no configurado",
          code: "stripe_not_configured",
        },
        500,
        requestId,
      );
    }

    const stripe = new Stripe(stripeSecret);
    const session = await withStripeRetry(() =>
      stripe.checkout.sessions.retrieve(stripeSessionId),
    );

    if (session.payment_status !== "paid") {
      apiLog("warn", route, "payment_not_confirmed", {
        requestId,
        stripeSessionId,
        paymentStatus: session.payment_status,
        code: "payment_not_confirmed",
      });
      return jsonResponse(
        {
          error: "Pago no confirmado",
          code: "payment_not_confirmed",
        },
        400,
        requestId,
      );
    }

    const customerEmail =
      session.customer_details?.email?.trim() ||
      session.customer_email?.trim() ||
      "";

    if (!customerEmail) {
      apiLog("warn", route, "missing_email", {
        requestId,
        stripeSessionId,
        code: "missing_email",
      });
      return jsonResponse(
        {
          error: "No hay correo en la sesión de pago",
          code: "missing_email",
        },
        400,
        requestId,
      );
    }

    const programSlugMeta = session.metadata?.programSlug?.trim() ?? "";
    programSlugLog = programSlugMeta || undefined;
    if (!programSlugMeta) {
      apiLog("warn", route, "missing_program_metadata", {
        requestId,
        stripeSessionId,
        code: "missing_program_metadata",
      });
      return jsonResponse(
        {
          error: "Sesión sin programa (metadata)",
          code: "missing_program_metadata",
        },
        400,
        requestId,
      );
    }

    const programs = await getCollection("programas");
    const program = programs.find((p) => getProgramPathSlug(p) === programSlugMeta);
    if (!program || getProgramStatus(program) === "disabled") {
      apiLog("warn", route, "unknown_program", {
        requestId,
        stripeSessionId,
        programSlug: programSlugMeta,
        code: "unknown_program",
      });
      return jsonResponse(
        {
          error: "Programa no encontrado",
          code: "unknown_program",
        },
        400,
        requestId,
      );
    }

    const lineItems = await withStripeRetry(() =>
      stripe.checkout.sessions.listLineItems(stripeSessionId, { limit: 10 }),
    );
    const firstLineItem = lineItems.data[0];
    const linePriceId = firstLineItem?.price?.id;
    if (!linePriceId) {
      apiLog("warn", route, "missing_line_items", {
        requestId,
        stripeSessionId,
        programSlug: programSlugLog,
        code: "missing_line_items",
      });
      return jsonResponse(
        {
          error: "No se pudo verificar el precio pagado",
          code: "missing_line_items",
        },
        400,
        requestId,
      );
    }

    const allowed = parseStripeAllowedPriceIds(STRIPE_ALLOWED_PRICE_IDS);
    if (allowed.size > 0 && !allowed.has(linePriceId)) {
      apiLog("warn", route, "price_not_allowed", {
        requestId,
        stripeSessionId,
        programSlug: programSlugLog,
        linePriceId,
        code: "price_not_allowed",
      });
      return jsonResponse(
        {
          error: "Precio no permitido para esta cuenta",
          code: "price_not_allowed",
        },
        400,
        requestId,
      );
    }

    const programPriceIds = collectProgramPriceIds(program);

    if (programPriceIds.size === 0) {
      apiLog("warn", route, "program_no_prices", {
        requestId,
        stripeSessionId,
        programSlug: programSlugLog,
        code: "program_no_prices",
      });
      return jsonResponse(
        {
          error: "Programa sin precios Stripe configurados",
          code: "program_no_prices",
        },
        400,
        requestId,
      );
    }

    const matchedPrice = programPriceIds.get(linePriceId);
    if (!matchedPrice) {
      apiLog("warn", route, "price_program_mismatch", {
        requestId,
        stripeSessionId,
        programSlug: programSlugLog,
        linePriceId,
        code: "price_program_mismatch",
      });
      return jsonResponse(
        {
          error: "El precio pagado no corresponde a este programa",
          code: "price_program_mismatch",
        },
        400,
        requestId,
      );
    }

    const paidCurrency = (session.currency ?? firstLineItem?.currency ?? "").toLowerCase();
    if (paidCurrency !== "mxn") {
      apiLog("warn", route, "currency_mismatch", {
        requestId,
        stripeSessionId,
        programSlug: programSlugLog,
        currency: paidCurrency || null,
        code: "currency_mismatch",
      });
      return jsonResponse(
        {
          error: "La moneda del pago no corresponde a MXN",
          code: "currency_mismatch",
        },
        400,
        requestId,
      );
    }

    if (
      typeof matchedPrice.expectedAmountCents === "number" &&
      session.amount_total !== matchedPrice.expectedAmountCents
    ) {
      apiLog("warn", route, "amount_mismatch", {
        requestId,
        stripeSessionId,
        programSlug: programSlugLog,
        expectedAmountCents: matchedPrice.expectedAmountCents,
        sessionAmountTotal: session.amount_total,
        code: "amount_mismatch",
      });
      return jsonResponse(
        {
          error: "El monto pagado no corresponde al programa seleccionado",
          code: "amount_mismatch",
        },
        400,
        requestId,
      );
    }

    const metadataEmail = session.customer_email?.trim().toLowerCase();
    if (
      metadataEmail &&
      customerEmail.toLowerCase() !== metadataEmail
    ) {
      apiLog("warn", route, "customer_email_mismatch", {
        requestId,
        stripeSessionId,
        programSlug: programSlugLog,
        code: "customer_email_mismatch",
      });
      return jsonResponse(
        {
          error: "El correo del pago no coincide con la sesión de Checkout",
          code: "customer_email_mismatch",
        },
        400,
        requestId,
      );
    }

    const modalityLabel =
      session.metadata?.modality?.trim() || matchedPrice.modality || "Por definir";

    const participantName =
      session.metadata?.participantName?.trim() || "Participante";
    const participantPhone =
      session.metadata?.participantPhone?.trim() || "No proporcionado";

    const programTitle = String(program.data.title ?? "");
    const programId = getProgramPathSlug(program);
    const requiresVerification = !!program.data.requiresVerification;

    const safeName = escapeHtml(participantName);
    const safeTitle = escapeHtml(programTitle);
    const safeModality = escapeHtml(modalityLabel);
    const safeEmail = escapeHtml(customerEmail);

    const senderEmail =
      (EMAIL_SOPORTE_WEB ?? "").trim() || "desarrolloweb@ceprija.edu.mx";
    const controlEscolar =
      (EMAIL_CONTROL_ESCOLAR ?? "").trim() || "controlescolar@ceprija.edu.mx";

    const adminNotificationRecipients = [
      ...new Set([controlEscolar, senderEmail]),
    ].map((email) => ({ email }));

    const piId = paymentIntentId(session);
    const amountStr = session.amount_total
      ? (session.amount_total / 100).toFixed(2)
      : "0.00";
    const currency = session.currency?.toUpperCase() || "MXN";

    const userEmailBody = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #003d82 0%, #0056b3 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; background: #003d82; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    .info-box { background: white; border-left: 4px solid #003d82; padding: 15px; margin: 15px 0; }
                    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>¡Bienvenido(a) a CEPRIJA!</h1>
                    </div>
                    <div class="content">
                        <h2>Confirmación de Inscripción</h2>
                        <p>Hola <strong>${safeName}</strong>,</p>
                        ${
                          requiresVerification
                            ? "<p>Tu pago ha sido confirmado exitosamente.</p><p><strong>Nota:</strong> Tu información y requisitos serán revisados por nuestro equipo. Te contactaremos si necesitamos documentación adicional.</p>"
                            : "<p>Tu inscripción al programa ha sido confirmada exitosamente.</p>"
                        }
                        
                        <div class="info-box">
                            <h3 style="margin-top: 0;">Detalles de tu Inscripción:</h3>
                            <p><strong>Programa:</strong> ${safeTitle}</p>
                            <p><strong>Modalidad:</strong> ${safeModality}</p>
                            <p><strong>ID de Pago:</strong> ${escapeHtml(piId)}</p>
                            <p><strong>Monto Pagado:</strong> $${amountStr} ${currency}</p>
                        </div>
                        
                        <p>Pronto recibirás información adicional sobre:</p>
                        <ul>
                            <li>Fecha de inicio del programa</li>
                            <li>Materiales necesarios</li>
                            <li>Acceso a plataforma (si aplica)</li>
                            <li>Información de contacto de tu coordinador</li>
                        </ul>
                        
                        <p>Si tienes alguna pregunta, no dudes en contactarnos:</p>
                        <p>📧 Email: ${escapeHtml(controlEscolar)}<br>
                        📞 Teléfono: (33) 3826-4863</p>
                        
                        <div style="text-align: center;">
                            <a href="https://ceprija.edu.mx" class="button">Visitar nuestro sitio web</a>
                        </div>
                    </div>
                    <div class="footer">
                        <p>Centro de Preparación Integral en Materia Jurídica y Administrativa (CEPRIJA)</p>
                        <p>Lope de Vega #273, Col. Americana Arcos, Guadalajara, Jalisco</p>
                    </div>
                </div>
            </body>
            </html>
        `;

    markEnrollmentConfirmed(stripeSessionId);

    let emailWarnings: string[] = [];

    const userSubject = sanitizeEmailSubjectLine(
      `Confirmación de Inscripción - ${programTitle}`,
    );
    const userEmailResponse = await sendBrevoEmail(
      {
        sender: { email: senderEmail, name: "CEPRIJA" },
        to: [{ email: customerEmail }],
        subject: userSubject,
        htmlContent: userEmailBody,
      },
      {
        route,
        requestId,
        kind: "participant",
        programSlug: programSlugLog,
        stripeSessionId,
      },
    );

    if (!userEmailResponse.ok) {
      apiLog("error", route, "brevo_user_email_failed", {
        requestId,
        programSlug: programSlugLog,
        stripeSessionId,
        brevoStatus: userEmailResponse.status,
      });
      emailWarnings.push("user_email_failed");
    }

    const adminEmailBody = `
                <h2>Nueva Inscripción PAGADA${requiresVerification ? " (requiere revisión)" : ""}</h2>
                <h3>Información del Estudiante:</h3>
                <p><strong>Nombre:</strong> ${safeName}</p>
                <p><strong>Email:</strong> ${safeEmail}</p>
                <p><strong>Teléfono:</strong> ${escapeHtml(participantPhone)}</p>
                
                <h3>Detalles del Programa:</h3>
                <p><strong>Programa:</strong> ${safeTitle}</p>
                <p><strong>ID Programa:</strong> ${escapeHtml(programId)}</p>
                <p><strong>Modalidad:</strong> ${safeModality}</p>
                
                <h3>Detalles del Pago:</h3>
                <p><strong>Stripe Session ID:</strong> ${escapeHtml(stripeSessionId)}</p>
                <p><strong>Payment Intent:</strong> ${escapeHtml(piId)}</p>
                <p><strong>Monto:</strong> $${amountStr} ${currency}</p>
                <p><strong>Estado:</strong> ${session.payment_status}</p>
                <p><strong>Fecha:</strong> ${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}</p>
                
                <p><a href="https://dashboard.stripe.com/payments/${encodeURIComponent(piId)}" target="_blank" rel="noopener noreferrer">Ver en Stripe Dashboard</a></p>
            `;

    const adminSubject = sanitizeEmailSubjectLine(
      `Nueva Inscripción PAGADA${requiresVerification ? " (requiere revisión)" : ""} - ${programTitle}`,
    );
    const adminEmailResponse = await sendBrevoEmail(
      {
        sender: { email: senderEmail, name: "Sistema CEPRIJA" },
        to: adminNotificationRecipients,
        subject: adminSubject,
        htmlContent: adminEmailBody,
      },
      {
        route,
        requestId,
        kind: "admin",
        programSlug: programSlugLog,
        stripeSessionId,
      },
    );

    if (!adminEmailResponse.ok) {
      apiLog("error", route, "brevo_admin_email_failed", {
        requestId,
        programSlug: programSlugLog,
        stripeSessionId,
        brevoStatus: adminEmailResponse.status,
      });
      emailWarnings.push("admin_email_failed");
    }

    apiLog("info", route, "enrollment_confirmed", {
      requestId,
      programSlug: programSlugLog,
      stripeSessionId,
      ...(emailWarnings.length > 0 && { emailWarnings }),
    });
    return jsonResponse(
      {
        success: true,
        message: "Enrollment confirmed successfully",
        ...(emailWarnings.length > 0 && { emailWarnings }),
      },
      200,
      requestId,
    );
  } catch (error) {
    apiLog("error", route, "internal_error", {
      requestId,
      programSlug: programSlugLog,
      code: "internal_error",
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse(
      {
        error: "Error interno del servidor",
        code: "internal_error",
      },
      500,
      requestId,
    );
  }
};
