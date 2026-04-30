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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    console.info(
      "[stripe] checkout.session.completed",
      session.id,
      session.metadata,
    );
  }

  markWebhookEventProcessed(event.id);

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
