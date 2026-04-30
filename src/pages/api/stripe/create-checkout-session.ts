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

const PRICE_ID_RE = /^price_[a-zA-Z0-9]+$/;
/** Matches Astro content entry slugs (filename-based); keeps junk out of redirect URLs. */
const PROGRAM_SLUG_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$/;

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

  const priceId = typeof body?.priceId === "string" ? body.priceId.trim() : "";
  const programSlug =
    typeof body?.programSlug === "string" ? body.programSlug.trim() : "";
  const customerEmail =
    typeof body?.customerEmail === "string" ? body.customerEmail.trim() : "";
  const participantName =
    typeof body?.participantName === "string"
      ? body.participantName.trim()
      : "";
  const participantPhone =
    typeof body?.participantPhone === "string"
      ? body.participantPhone.trim()
      : "";
  const modality =
    typeof body?.modality === "string" ? body.modality.trim() : "";

  if (
    !priceId ||
    !programSlug ||
    !participantName ||
    !participantPhone ||
    !modality
  ) {
    return new Response(
      JSON.stringify({ error: "Faltan campos requeridos", code: "missing_fields" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (!PROGRAM_SLUG_RE.test(programSlug) || programSlug.length > 200) {
    return new Response(
      JSON.stringify({ error: "Programa no válido", code: "invalid_program" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (modality !== "Presencial" && modality !== "En línea") {
    return new Response(
      JSON.stringify({ error: "Modalidad no válida", code: "invalid_modality" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const looksLikeStripePrice =
    PRICE_ID_RE.test(priceId) && !/PLACEHOLDER|REPLACE/i.test(priceId);
  if (!looksLikeStripePrice) {
    return new Response(
      JSON.stringify({
        error:
          "El programa no tiene un Price ID de Stripe válido. En el Dashboard crea un precio y agrégalo en el frontmatter del programa (stripePriceIds).",
        code: "invalid_price_id",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

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
      },
      payment_intent_data: {
        metadata: {
          programSlug: truncateMeta(programSlug),
        },
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = stripeErrorMessage(e);
    return new Response(JSON.stringify({ error: message, code: "stripe_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
