/**
 * Stripe webhooks: signature verification + deduped handling of retries.
 * Paid enrollment emails are sent from confirm-enrollment.ts when the user opens
 * /pago-exitoso — do not duplicate that flow here without shared idempotency.
 */
export const prerender = false;

import type { APIRoute } from "astro";
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from "astro:env/server";
import Stripe from "stripe";
import {
  hasWebhookEventBeenProcessed,
  markWebhookEventProcessed,
} from "@lib/processedStripeStore";
import { apiLog, getRequestId, jsonResponse, textResponse } from "@lib/server/apiRequestLog";

export const POST: APIRoute = async ({ request }) => {
  const requestId = getRequestId(request);
  const route = "POST /api/stripe/webhook";
  const secret = STRIPE_SECRET_KEY;
  const whSecret = STRIPE_WEBHOOK_SECRET;

  if (!secret || !whSecret) {
    apiLog("error", route, "stripe_webhook_not_configured", { requestId });
    return textResponse("Not configured", 503, requestId);
  }

  const stripe = new Stripe(secret);
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    apiLog("warn", route, "missing_stripe_signature", { requestId });
    return textResponse("No signature", 400, requestId);
  }

  const rawBody = Buffer.from(await request.arrayBuffer());

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, whSecret);
  } catch {
    apiLog("warn", route, "invalid_stripe_signature", { requestId });
    return textResponse("Invalid signature", 400, requestId);
  }

  if (hasWebhookEventBeenProcessed(event.id)) {
    apiLog("info", route, "duplicate_event", {
      requestId,
      eventId: event.id,
      type: event.type,
    });
    return jsonResponse({ received: true, duplicate: true }, 200, requestId);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      apiLog("info", route, "checkout_session_completed", {
        requestId,
        eventId: event.id,
        sessionId: session.id,
        paymentStatus: session.payment_status,
        programSlug: session.metadata?.programSlug,
      });
      break;
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      apiLog("warn", route, "payment_intent_failed", {
        requestId,
        eventId: event.id,
        paymentIntentId: paymentIntent.id,
        programSlug: paymentIntent.metadata?.programSlug,
        message: paymentIntent.last_payment_error?.message,
      });
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      apiLog("warn", route, "charge_refunded", {
        requestId,
        eventId: event.id,
        chargeId: charge.id,
        amountRefunded: charge.amount_refunded,
        programSlug: charge.metadata?.programSlug,
      });
      break;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      apiLog("error", route, "charge_dispute_created", {
        requestId,
        eventId: event.id,
        disputeId: dispute.id,
        reason: dispute.reason,
        amount: dispute.amount,
      });
      break;
    }

    case "charge.dispute.closed": {
      const dispute = event.data.object as Stripe.Dispute;
      apiLog("info", route, "charge_dispute_closed", {
        requestId,
        eventId: event.id,
        disputeId: dispute.id,
        status: dispute.status,
      });
      break;
    }

    default:
      apiLog("info", route, "unhandled_event_type", {
        requestId,
        eventId: event.id,
        type: event.type,
      });
  }

  markWebhookEventProcessed(event.id);

  return jsonResponse({ received: true }, 200, requestId);
};
