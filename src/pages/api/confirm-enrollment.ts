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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paymentIntentId(session: Stripe.Checkout.Session): string {
  const pi = session.payment_intent;
  if (typeof pi === "string") return pi;
  if (pi && typeof pi === "object" && "id" in pi) return String(pi.id);
  return "";
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const stripeSessionId =
      typeof body?.stripeSessionId === "string"
        ? body.stripeSessionId.trim()
        : "";

    if (!stripeSessionId) {
      return new Response(
        JSON.stringify({
          error: "Falta stripeSessionId",
          code: "missing_session",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (hasEnrollmentBeenConfirmed(stripeSessionId)) {
      return new Response(
        JSON.stringify({ success: true, duplicate: true }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const stripeSecret = STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      return new Response(
        JSON.stringify({
          error: "Stripe no configurado",
          code: "stripe_not_configured",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const stripe = new Stripe(stripeSecret);
    const session = await stripe.checkout.sessions.retrieve(stripeSessionId);

    if (session.payment_status !== "paid") {
      return new Response(
        JSON.stringify({
          error: "Pago no confirmado",
          code: "payment_not_confirmed",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const customerEmail =
      session.customer_details?.email?.trim() ||
      session.customer_email?.trim() ||
      "";

    if (!customerEmail) {
      return new Response(
        JSON.stringify({
          error: "No hay correo en la sesión de pago",
          code: "missing_email",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const programSlugMeta = session.metadata?.programSlug?.trim() ?? "";
    if (!programSlugMeta) {
      return new Response(
        JSON.stringify({
          error: "Sesión sin programa (metadata)",
          code: "missing_program_metadata",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const programs = await getCollection("programas");
    const program = programs.find((p) => p.slug === programSlugMeta);
    if (!program) {
      return new Response(
        JSON.stringify({
          error: "Programa no encontrado",
          code: "unknown_program",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const lineItems = await stripe.checkout.sessions.listLineItems(
      stripeSessionId,
      { limit: 10 },
    );
    const linePriceId = lineItems.data[0]?.price?.id;
    if (!linePriceId) {
      return new Response(
        JSON.stringify({
          error: "No se pudo verificar el precio pagado",
          code: "missing_line_items",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const allowed = parseStripeAllowedPriceIds(STRIPE_ALLOWED_PRICE_IDS);
    if (allowed.size > 0 && !allowed.has(linePriceId)) {
      return new Response(
        JSON.stringify({
          error: "Precio no permitido para esta cuenta",
          code: "price_not_allowed",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const stripeIds = program.data.stripePriceIds;
    if (!stripeIds) {
      return new Response(
        JSON.stringify({
          error: "Programa sin precios Stripe configurados",
          code: "program_no_prices",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const matchPresencial = linePriceId === stripeIds.presencial;
    const matchOnline = linePriceId === stripeIds.online;
    if (!matchPresencial && !matchOnline) {
      return new Response(
        JSON.stringify({
          error: "El precio pagado no corresponde a este programa",
          code: "price_program_mismatch",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
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

    const programTitle = program.data.title;
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
      console.warn(
        "[confirm-enrollment] KEY_API_BREVO vacío o ausente. No se enviarán correos.",
      );
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
          console.error(
            "[confirm-enrollment] Brevo rechazó el correo al participante:",
            userEmailResponse.status,
            errBody,
          );
          emailWarnings.push("user_email_failed");
        }
      } catch (emailError) {
        console.error(
          "[confirm-enrollment] Error de red al llamar a Brevo:",
          emailError,
        );
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
          console.error(
            "[confirm-enrollment] Brevo rechazó el correo a administración:",
            adminEmailResponse.status,
            await adminEmailResponse.text(),
          );
          emailWarnings.push("admin_email_failed");
        }
      } catch (emailError) {
        console.error(
          "[confirm-enrollment] Error enviando correo a administración:",
          emailError,
        );
        emailWarnings.push("admin_email_network_error");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Enrollment confirmed successfully",
        ...(emailWarnings.length > 0 && { emailWarnings }),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error confirming enrollment:", error);
    return new Response(
      JSON.stringify({
        error: "Error interno del servidor",
        code: "internal_error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
