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
  KEY_API_BREVO,
  STRIPE_ALLOWED_PRICE_IDS,
  STRIPE_SECRET_KEY,
} from "astro:env/server";
import Stripe from "stripe";
import { hasEnrollmentBeenConfirmed, markEnrollmentConfirmed } from "@lib/processedStripeStore";
import { parseStripeAllowedPriceIds } from "@lib/stripeAllowedPrices";
import { validateStripeCheckoutSessionId } from "@lib/validation/enrollment";
import { escapeHtml } from "@lib/htmlEscape";
import { apiLog, getRequestId, jsonResponse } from "@lib/server/apiRequestLog";

function paymentIntentId(session: Stripe.Checkout.Session): string {
  const pi = session.payment_intent;
  if (typeof pi === "string") return pi;
  if (pi && typeof pi === "object" && "id" in pi) return String(pi.id);
  return "";
}

export const POST: APIRoute = async ({ request }) => {
  const requestId = getRequestId(request);
  const route = "POST /api/confirm-enrollment";
  let programSlugLog: string | undefined;
  try {
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
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
    const session = await stripe.checkout.sessions.retrieve(stripeSessionId);

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
    const program = programs.find((p) => p.slug === programSlugMeta);
    if (!program) {
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

    const lineItems = await stripe.checkout.sessions.listLineItems(
      stripeSessionId,
      { limit: 10 },
    );
    const linePriceId = lineItems.data[0]?.price?.id;
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

    const rawStripeIds = program.data.stripePriceIds;
    const stripeIds =
      rawStripeIds &&
      typeof rawStripeIds === "object" &&
      "presencial" in rawStripeIds &&
      "online" in rawStripeIds &&
      typeof (rawStripeIds as { presencial: unknown }).presencial === "string" &&
      typeof (rawStripeIds as { online: unknown }).online === "string"
        ? (rawStripeIds as { presencial: string; online: string })
        : null;

    if (!stripeIds) {
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

    const matchPresencial = linePriceId === stripeIds.presencial;
    const matchOnline = linePriceId === stripeIds.online;
    if (!matchPresencial && !matchOnline) {
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

    let modalityLabel = "Por definir";
    if (stripeIds.presencial === stripeIds.online) {
      modalityLabel =
        session.metadata?.modality?.trim() || "Por definir";
    } else if (matchPresencial) {
      modalityLabel = "Presencial";
    } else if (matchOnline) {
      modalityLabel = "En línea";
    }

    const participantName =
      session.metadata?.participantName?.trim() || "Participante";
    const participantPhone =
      session.metadata?.participantPhone?.trim() || "No proporcionado";

    const programTitle = String(program.data.title ?? "");
    const programId = program.slug;
    const requiresVerification = !!program.data.requiresVerification;

    const safeName = escapeHtml(participantName);
    const safeTitle = escapeHtml(programTitle);
    const safeModality = escapeHtml(modalityLabel);
    const safeEmail = escapeHtml(customerEmail);

    const brevoKey = (KEY_API_BREVO ?? "").trim();
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

    if (!brevoKey) {
      apiLog("warn", route, "brevo_not_configured", {
        requestId,
        programSlug: programSlugLog,
        stripeSessionId,
      });
      emailWarnings.push("email_not_configured");
    } else {
      try {
        const userEmailResponse = await fetch(
          "https://api.brevo.com/v3/smtp/email",
          {
            method: "POST",
            headers: {
              "api-key": brevoKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sender: { email: senderEmail, name: "CEPRIJA" },
              to: [{ email: customerEmail }],
              subject: `Confirmación de Inscripción - ${programTitle}`,
              htmlContent: userEmailBody,
            }),
          },
        );

        if (!userEmailResponse.ok) {
          const errBody = await userEmailResponse.text();
          apiLog("error", route, "brevo_user_email_failed", {
            requestId,
            programSlug: programSlugLog,
            stripeSessionId,
            brevoStatus: userEmailResponse.status,
            brevoBody: errBody.slice(0, 500),
          });
          emailWarnings.push("user_email_failed");
        }
      } catch (emailError) {
        apiLog("error", route, "brevo_user_email_network", {
          requestId,
          programSlug: programSlugLog,
          stripeSessionId,
          error:
            emailError instanceof Error ? emailError.message : String(emailError),
        });
        emailWarnings.push("user_email_network_error");
      }
    }

    if (brevoKey) {
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

      try {
        const adminEmailResponse = await fetch(
          "https://api.brevo.com/v3/smtp/email",
          {
            method: "POST",
            headers: {
              "api-key": brevoKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sender: { email: senderEmail, name: "Sistema CEPRIJA" },
              to: adminNotificationRecipients,
              subject: `✅ Nueva Inscripción PAGADA${requiresVerification ? " (requiere revisión)" : ""} - ${programTitle}`,
              htmlContent: adminEmailBody,
            }),
          },
        );

        if (!adminEmailResponse.ok) {
          const adminErrText = await adminEmailResponse.text();
          apiLog("error", route, "brevo_admin_email_failed", {
            requestId,
            programSlug: programSlugLog,
            stripeSessionId,
            brevoStatus: adminEmailResponse.status,
            brevoBody: adminErrText.slice(0, 500),
          });
          emailWarnings.push("admin_email_failed");
        }
      } catch (emailError) {
        apiLog("error", route, "brevo_admin_email_network", {
          requestId,
          programSlug: programSlugLog,
          stripeSessionId,
          error:
            emailError instanceof Error ? emailError.message : String(emailError),
        });
        emailWarnings.push("admin_email_network_error");
      }
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
