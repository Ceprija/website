export const prerender = false;

import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
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
import { validateProductionEnv } from "@lib/server/productionEnv";
import {
  checkRateLimit,
  clientIpFromRequest,
  pruneRateLimitBuckets,
} from "@lib/server/rateLimit";
import { getPaymentOptions } from "@lib/programPayments";
import { getEffectiveProgramStatus } from "@lib/programPublished";
import { getVariantOptions } from "@lib/programVariants";
import { hasHoneypotValue } from "@lib/server/publicEndpointGuards";
import { getProgramPathSlug } from "@lib/programPaths";

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

function collectProgramCheckoutPriceIds(
  program: Awaited<ReturnType<typeof getCollection<"programas">>>[number],
): Set<string> {
  const prices = new Set<string>();
  for (const option of getPaymentOptions(program)) {
    if (option.stripePriceId?.trim()) prices.add(option.stripePriceId.trim());
  }

  const variants = getVariantOptions(program);
  for (const option of variants?.moduleSelection?.options ?? []) {
    const presencial = option.stripePriceIds?.presencial?.trim();
    const online = option.stripePriceIds?.online?.trim();
    if (presencial) prices.add(presencial);
    if (online) prices.add(online);
  }

  return prices;
}

function selectedVariantPriceMatches(
  program: Awaited<ReturnType<typeof getCollection<"programas">>>[number],
  selectedModule: string | undefined,
  selectedDate: string | undefined,
  modality: string,
  priceId: string,
): { ok: true } | { ok: false; code: string; error: string } {
  const variants = getVariantOptions(program);
  const moduleSelection = variants?.moduleSelection;
  const dateSelection = variants?.dateSelection;

  if (moduleSelection?.required !== false && moduleSelection) {
    if (!selectedModule) {
      return { ok: false, code: "missing_variant_module", error: "Selecciona un módulo." };
    }
  }

  if (selectedModule && moduleSelection) {
    const option = moduleSelection.options.find((row) => row.id === selectedModule);
    if (!option) {
      return { ok: false, code: "invalid_variant_module", error: "Módulo no válido." };
    }

    const expected =
      modality === "Presencial"
        ? option.stripePriceIds?.presencial
        : option.stripePriceIds?.online;
    if (expected?.trim() && expected.trim() !== priceId) {
      return {
        ok: false,
        code: "price_variant_mismatch",
        error: "El precio no corresponde al módulo seleccionado.",
      };
    }
  }

  if (dateSelection?.required !== false && dateSelection) {
    if (!selectedDate) {
      return { ok: false, code: "missing_variant_date", error: "Selecciona una fecha." };
    }
  }

  if (selectedDate && dateSelection) {
    const option = dateSelection.options.find((row) => row.id === selectedDate);
    if (!option) {
      return { ok: false, code: "invalid_variant_date", error: "Fecha no válida." };
    }
  }

  return { ok: true };
}

function isAllowedRequestOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")?.trim();
  if (!origin) return true;

  const allowed = new Set<string>();
  try {
    allowed.add(new URL(request.url).origin);
  } catch {
    // Ignore malformed request URLs; the configured SITE_URL check below may still pass.
  }
  if (SITE_URL) {
    try {
      allowed.add(new URL(SITE_URL).origin);
    } catch {
      // Environment validation reports malformed SITE_URL separately.
    }
  }

  return allowed.has(origin);
}

export const POST: APIRoute = async ({ request }) => {
  const requestId = getRequestId(request);
  const route = "POST /api/stripe/create-checkout-session";
  pruneRateLimitBuckets();

  const ip = clientIpFromRequest(request);
  const rateLimit = checkRateLimit(`checkout:${ip}`, {
    limit: 3,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    apiLog("warn", route, "rate_limit_exceeded", {
      requestId,
      ip,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
    return jsonResponse(
      {
        error:
          "Demasiados intentos de pago. Espera un minuto y vuelve a intentar.",
        code: "rate_limit_exceeded",
      },
      429,
      requestId,
    );
  }

  if (!isAllowedRequestOrigin(request)) {
    apiLog("warn", route, "origin_not_allowed", {
      requestId,
      origin: request.headers.get("origin"),
      code: "origin_not_allowed",
    });
    return jsonResponse(
      {
        error: "Origen no permitido",
        code: "origin_not_allowed",
      },
      403,
      requestId,
    );
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return jsonResponse(
      { error: "Content-Type inválido", code: "invalid_content_type" },
      400,
      requestId,
    );
  }

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
  if (hasHoneypotValue(body)) {
    return jsonResponse({ success: true }, 200, requestId);
  }

  const parsed = parseCheckoutSessionBody(body);
  if (!parsed.ok) {
    return jsonResponse(
      {
        error: parsed.err.error,
        code: parsed.err.code,
        ...(parsed.err.field && { field: parsed.err.field }),
      },
      400,
      requestId,
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

  const programs = await getCollection("programas");
  const program = programs.find((entry) => getProgramPathSlug(entry) === programSlug);
  if (!program || getEffectiveProgramStatus(program) !== "active") {
    apiLog("warn", route, "program_unavailable", {
      requestId,
      programSlug,
      code: "program_unavailable",
    });
    return jsonResponse(
      { error: "Programa no disponible", code: "program_unavailable" },
      400,
      requestId,
    );
  }

  const programPriceIds = collectProgramCheckoutPriceIds(program);
  if (!programPriceIds.has(priceId)) {
    apiLog("warn", route, "price_program_mismatch", {
      requestId,
      programSlug,
      priceId,
      code: "price_program_mismatch",
    });
    return jsonResponse(
      {
        error: "El precio no corresponde al programa seleccionado.",
        code: "price_program_mismatch",
      },
      400,
      requestId,
    );
  }

  const variantCheck = selectedVariantPriceMatches(
    program,
    selectedModule,
    selectedDate,
    modality,
    priceId,
  );
  if (!variantCheck.ok) {
    apiLog("warn", route, variantCheck.code, {
      requestId,
      programSlug,
      priceId,
      code: variantCheck.code,
    });
    return jsonResponse(
      { error: variantCheck.error, code: variantCheck.code },
      400,
      requestId,
    );
  }

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
    // Primero obtenemos información del Price para determinar si es recurrente
    const priceObj = await stripe.prices.retrieve(priceId);
    const isRecurring = priceObj.type === "recurring";

    // Preparamos metadata común
    const commonMetadata = {
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
    };

    // Si es recurrente, creamos una suscripción con límite de 4 pagos
    if (isRecurring) {
      const subscriptionMeta = {
        ...commonMetadata,
        payment_cycle_limit: "4",
        enrollment_type: "deferred_payment_plan",
      };
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: customerEmail || undefined,
        client_reference_id: truncateMeta(programSlug, 200),
        // Misma metadata en sesión y suscripción: en Dashboard la ves en la sesión;
        // algunas cuentas/API no reflejan subscription_data.metadata hasta el webhook.
        subscription_data: {
          metadata: subscriptionMeta,
        },
        metadata: subscriptionMeta,
      });

      apiLog("info", route, "subscription_checkout_created", {
        requestId,
        programSlug,
        sessionId: session.id,
        paymentCycleLimit: 4,
      });
      return jsonResponse({ url: session.url }, 200, requestId);
    }

    // Pago único (modo original)
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail || undefined,
      // Forzamos MXN: confirm-enrollment rechaza otras monedas y los cupones de
      // monto fijo (amount_off) son incompatibles con Adaptive Pricing.
      adaptive_pricing: { enabled: false },
      allow_promotion_codes: true,
      client_reference_id: truncateMeta(programSlug, 200),
      metadata: commonMetadata,
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
