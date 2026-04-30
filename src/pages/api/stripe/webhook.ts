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

export const POST: APIRoute = async ({ request }) => {
  const secret = STRIPE_SECRET_KEY;
  const whSecret = STRIPE_WEBHOOK_SECRET;

  if (!secret || !whSecret) {
    return new Response("Not configured", { status: 503 });
  }

  const stripe = new Stripe(secret);
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return new Response("No signature", { status: 400 });
  }

  const rawBody = Buffer.from(await request.arrayBuffer());

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, whSecret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (hasWebhookEventBeenProcessed(event.id)) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.info(
        "[stripe] checkout.session.completed",
        session.id,
        session.payment_status,
        session.metadata,
      );
      break;
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.warn(
        "[stripe] payment_intent.payment_failed",
        paymentIntent.id,
        paymentIntent.last_payment_error?.message,
        paymentIntent.metadata,
      );
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      console.warn(
        "[stripe] charge.refunded",
        charge.id,
        `Amount: ${charge.amount_refunded}`,
        charge.metadata,
      );
      break;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      console.error(
        "[stripe] charge.dispute.created",
        dispute.id,
        `Reason: ${dispute.reason}`,
        `Amount: ${dispute.amount}`,
      );
      break;
    }

    case "charge.dispute.closed": {
      const dispute = event.data.object as Stripe.Dispute;
      console.info(
        "[stripe] charge.dispute.closed",
        dispute.id,
        `Status: ${dispute.status}`,
      );
      break;
    }

    default:
      console.log(`[stripe] Unhandled event type: ${event.type}`);
  }

  markWebhookEventProcessed(event.id);

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
