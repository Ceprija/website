export const prerender = false;

import type { APIRoute } from "astro";
import { STRIPE_SECRET_KEY } from "astro:env/server";
import Stripe from "stripe";
import { jsonResponse, getRequestId, apiLog } from "@lib/server/apiRequestLog";
import { validateProductionEnv } from "@lib/server/productionEnv";
import { isProcessedStripeStoreWritable } from "@lib/processedStripeStore";
import { withStripeRetry } from "@lib/stripeRetry";

export const GET: APIRoute = async ({ request }) => {
  const requestId = getRequestId(request);
  const route = "GET /api/health";
  const healthSecret = process.env.HEALTHCHECK_SECRET?.trim();
  const providedSecret = request.headers.get("x-healthcheck-secret")?.trim();
  const includeDetails =
    !!healthSecret && !!providedSecret && providedSecret === healthSecret;
  const env = validateProductionEnv();
  const storeWritable = isProcessedStripeStoreWritable();

  let stripeReachable = false;
  let stripeError: string | undefined;

  if (STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(STRIPE_SECRET_KEY);
      await withStripeRetry(() => stripe.balance.retrieve(), {
        attempts: 2,
        baseDelayMs: 250,
      });
      stripeReachable = true;
    } catch (error) {
      stripeError = error instanceof Error ? error.message : String(error);
    }
  }

  const ok = env.ok && storeWritable && stripeReachable;
  apiLog(ok ? "info" : "warn", route, ok ? "health_ok" : "health_degraded", {
    requestId,
    envOk: env.ok,
    storeWritable,
    stripeReachable,
    ...(stripeError && { stripeError }),
  });

  const publicBody = { status: ok ? "ok" : "degraded", requestId };
  if (!includeDetails) {
    return jsonResponse(publicBody, ok ? 200 : 503, requestId);
  }

  return jsonResponse(
    {
      ...publicBody,
      checks: {
        environment: env.ok,
        environmentErrors: env.errors,
        environmentWarnings: env.warnings,
        idempotencyStoreWritable: storeWritable,
        stripeReachable,
        ...(stripeError && { stripeError }),
      },
    },
    ok ? 200 : 503,
    requestId,
  );
};
