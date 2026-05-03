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
import { canonicalMexicoTenDigitPhone } from "@lib/validation/phone";

/** Mensaje seguro para el navegador (sin rutas internas ni instrucciones de implementación). */
function stripeErrorMessage(error: unknown): string {
  if (error instanceof Stripe.errors.StripeAuthenticationError) {
    return "No pudimos validar el servicio de pago. Por favor contacta a soporte o usa transferencia bancaria si está disponible.";
  }
  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    const msg = error.message ?? "";
    if (
      error.code === "resource_missing" &&
      (error.param?.includes("price") || /no such price/i.test(msg))
    ) {
      return "No pudimos iniciar el pago en línea en este momento. Por favor escríbenos desde la página de Contacto o elige transferencia bancaria.";
    }
  }
  if (error instanceof Error) {
    return "No pudimos completar el pago en línea. Intenta de nuevo más tarde o contacta a soporte.";
  }
  return "No pudimos contactar el servicio de pago. Intenta de nuevo o usa otro método de pago.";
}

function truncateMeta(value: string, max = 450): string {
  const v = value.trim();
  return v.length <= max ? v : v.slice(0, max);
}

export const POST: APIRoute = async ({ request }) => {
  const secret = STRIPE_SECRET_KEY;
  if (!secret) {
    return new Response(JSON.stringify({ error: "Stripe no configurado" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
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
  } = parsed.data;

  if (allowed.size > 0 && !allowed.has(priceId)) {
    return new Response(
      JSON.stringify({ error: "Precio no permitido", code: "price_not_allowed" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const origin = resolveCheckoutOrigin(request, SITE_URL);
  const base = origin.origin;
  const successUrl = `${base}/pago-exitoso?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${base}/oferta-academica/${encodeURIComponent(programSlug)}`;

  // Normalize phone to 10 digits for metadata
  const phoneCanonical = canonicalMexicoTenDigitPhone(participantPhone);

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
        participantPhone: phoneCanonical,
        modality: truncateMeta(modality),
        requiresInvoice: truncateMeta(requiresInvoice, 8),
        ...(invoiceEmail
          ? { invoiceEmail: truncateMeta(invoiceEmail, 254) }
          : {}),
        ...(applicationId
          ? { applicationId: truncateMeta(applicationId, 80) }
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
        },
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[stripe/create-checkout-session]", e);
    const message = stripeErrorMessage(e);
    return new Response(JSON.stringify({ error: message, code: "stripe_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
