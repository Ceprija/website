export const prerender = false;

import type { APIRoute } from "astro";
import {
  SITE_URL,
  STRIPE_ALLOWED_PRICE_IDS,
  STRIPE_SECRET_KEY,
} from "astro:env/server";
import Stripe from "stripe";
import { resolveCheckoutOrigin } from "@lib/stripeRedirects";
import { parseStripeAllowedPriceIds } from "@lib/stripeAllowedPrices";
import { parseCheckoutSessionBody } from "@lib/validation/enrollment";
import { apiLog, getRequestId, jsonResponse } from "@lib/server/apiRequestLog";

function stripeErrorMessage(error: unknown): string {
  if (error instanceof Stripe.errors.StripeAuthenticationError) {
    return "La clave STRIPE_SECRET_KEY no es válida o no coincide con el modo de la cuenta (prueba vs producción).";
  }
  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    const msg = error.message ?? "";
    if (
      error.code === "resource_missing" &&
      (error.param?.includes("price") || /no such price/i.test(msg))
    ) {
      return "Ese precio no existe en tu cuenta de Stripe. Crea el precio en Stripe Dashboard → Catálogo de productos, copia el ID (price_…) y sustituye los valores en el archivo del programa en src/content/programas/ (stripePriceIds). Usa el mismo modo (prueba o producción) que tu STRIPE_SECRET_KEY.";
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Error al contactar Stripe.";
}

function truncateMeta(value: string, max = 450): string {
  const v = value.trim();
  return v.length <= max ? v : v.slice(0, max);
}

export const POST: APIRoute = async ({ request }) => {
  const requestId = getRequestId(request);
  const route = "POST /api/stripe/create-checkout-session";
  const secret = STRIPE_SECRET_KEY;
  if (!secret) {
    apiLog("error", route, "stripe_secret_missing", { requestId });
    return jsonResponse(
      { error: "Stripe no configurado", code: "stripe_not_configured" },
      503,
      requestId,
    );
  }

  const allowed = parseStripeAllowedPriceIds(STRIPE_ALLOWED_PRICE_IDS);
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  const parsed = parseCheckoutSessionBody(body);
  if (!parsed.ok) {
    return new Response(
      JSON.stringify({
        error: parsed.err.error,
        code: parsed.err.code,
        ...(parsed.err.field && { field: parsed.err.field }),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const {
    priceId,
    programSlug,
    customerEmail,
    participantName,
    participantPhone,
    modality,
    applicationId,
    requiresInvoice,
    invoiceEmail,
    selectedModule,
    selectedDate,
  } = parsed.data;

  if (allowed.size > 0 && !allowed.has(priceId)) {
    apiLog("warn", route, "price_not_allowed", {
      requestId,
      programSlug,
      priceId,
      code: "price_not_allowed",
    });
    return jsonResponse(
      { error: "Precio no permitido", code: "price_not_allowed" },
      400,
      requestId,
    );
  }

  const origin = resolveCheckoutOrigin(request, SITE_URL);
  const base = origin.origin;
  const successUrl = `${base}/pago-exitoso?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${base}/oferta-academica/${encodeURIComponent(programSlug)}`;

  const stripe = new Stripe(secret);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail || undefined,
      client_reference_id: truncateMeta(programSlug, 200),
      metadata: {
        programSlug: truncateMeta(programSlug),
        participantName: truncateMeta(participantName),
        participantPhone: truncateMeta(participantPhone),
        modality: truncateMeta(modality),
        requiresInvoice: truncateMeta(requiresInvoice, 8),
        ...(invoiceEmail
          ? { invoiceEmail: truncateMeta(invoiceEmail, 254) }
          : {}),
        ...(applicationId
          ? { applicationId: truncateMeta(applicationId, 80) }
          : {}),
        ...(selectedModule
          ? { selectedModule: truncateMeta(selectedModule, 120) }
          : {}),
        ...(selectedDate
          ? { selectedDate: truncateMeta(selectedDate, 120) }
          : {}),
      },
      payment_intent_data: {
        metadata: {
          programSlug: truncateMeta(programSlug),
          requiresInvoice: truncateMeta(requiresInvoice, 8),
          ...(invoiceEmail
            ? { invoiceEmail: truncateMeta(invoiceEmail, 254) }
            : {}),
          ...(applicationId
            ? { applicationId: truncateMeta(applicationId, 80) }
            : {}),
          ...(selectedModule
            ? { selectedModule: truncateMeta(selectedModule, 120) }
            : {}),
          ...(selectedDate
            ? { selectedDate: truncateMeta(selectedDate, 120) }
            : {}),
        },
      },
    });

    apiLog("info", route, "checkout_session_created", {
      requestId,
      programSlug,
      sessionId: session.id,
    });
    return jsonResponse({ url: session.url }, 200, requestId);
  } catch (e) {
    const message = stripeErrorMessage(e);
    const stripeCode =
      e && typeof e === "object" && "code" in e
        ? String((e as { code?: unknown }).code ?? "")
        : "";
    apiLog("error", route, "stripe_api_error", {
      requestId,
      programSlug,
      code: "stripe_error",
      stripeCode: stripeCode || undefined,
      error: message,
    });
    return jsonResponse({ error: message, code: "stripe_error" }, 500, requestId);
  }
};
