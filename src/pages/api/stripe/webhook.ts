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

/**
 * Resolves the subscription id from a Stripe `Invoice`.
 *
 * Stripe API >= 2026-03-25.dahlia moved the field from `invoice.subscription`
 * (top-level) to `invoice.parent.subscription_details.subscription`. Webhook
 * payloads still carry the legacy field for backward compatibility, so we read
 * from the new location first and fall back to the old one.
 */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const fromParent =
    invoice.parent?.type === "subscription_details"
      ? invoice.parent.subscription_details?.subscription
      : null;
  const legacy = (invoice as { subscription?: string | Stripe.Subscription | null })
    .subscription;
  const sub = fromParent ?? legacy ?? null;
  if (sub == null) return null;
  return typeof sub === "string" ? sub : sub.id;
}

function checkoutSessionSubscriptionId(
  session: Stripe.Checkout.Session,
): string | null {
  const sub = session.subscription;
  if (sub == null) return null;
  return typeof sub === "string" ? sub : sub.id;
}

/**
 * Count paid invoices for a subscription (read-only).
 * Replaces per-payment metadata writes that race with Stripe Test Clock advancement.
 */
async function countPaidInvoices(
  stripe: Stripe,
  subscriptionId: string,
): Promise<number> {
  let count = 0;
  let startingAfter: string | undefined;

  while (true) {
    const page = await stripe.invoices.list({
      subscription: subscriptionId,
      status: "paid",
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    count += page.data.length;

    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1]?.id;
    if (!startingAfter) break;
  }

  return count;
}

/**
 * Normalizes the payload across the three "invoice was paid" events:
 *  - `invoice.paid` and `invoice.payment_succeeded` deliver a `Stripe.Invoice`.
 *  - `invoice_payment.paid` (newer API) delivers a `Stripe.InvoicePayment` with
 *    only an `invoice` string ref; we hydrate the invoice to read `subscription`.
 */
async function resolveInvoiceContext(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<{
  invoiceId: string | null;
  subscriptionId: string | null;
  amountPaid: number;
}> {
  if (event.type === "invoice_payment.paid") {
    const ip = event.data.object as {
      invoice?: string | null;
      amount_paid?: number | null;
    };
    const invoiceId = typeof ip.invoice === "string" ? ip.invoice : null;
    if (!invoiceId) {
      return { invoiceId: null, subscriptionId: null, amountPaid: 0 };
    }
    const invoice = await stripe.invoices.retrieve(invoiceId);
    return {
      invoiceId,
      subscriptionId: invoiceSubscriptionId(invoice),
      amountPaid: ip.amount_paid ?? invoice.amount_paid ?? 0,
    };
  }

  const invoice = event.data.object as Stripe.Invoice;
  return {
    invoiceId: invoice.id ?? null,
    subscriptionId: invoiceSubscriptionId(invoice),
    amountPaid: invoice.amount_paid ?? 0,
  };
}

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
        mode: session.mode,
      });

      // For installment plans (recurring price), make sure the subscription is set up to
      // stop after `payment_cycle_limit` invoices: repair its metadata if the session lost it,
      // then attach a subscription schedule that lets Stripe enforce the cap server-side.
      if (session.mode === "subscription") {
        const subId = checkoutSessionSubscriptionId(session);
        if (subId) {
          try {
            let sub = await stripe.subscriptions.retrieve(subId);
            const sessionLimit = session.metadata?.payment_cycle_limit?.trim();
            const sessionEnrollment = session.metadata?.enrollment_type?.trim();

            if (!sub.metadata?.payment_cycle_limit && sessionLimit) {
              await stripe.subscriptions.update(subId, {
                metadata: {
                  ...sub.metadata,
                  payment_cycle_limit: sessionLimit,
                  ...(sessionEnrollment
                    ? { enrollment_type: sessionEnrollment }
                    : {}),
                },
              });
              sub = await stripe.subscriptions.retrieve(subId);
              apiLog("info", route, "subscription_metadata_repaired_from_session", {
                requestId,
                subscriptionId: sub.id,
                paymentCycleLimit: sub.metadata?.payment_cycle_limit ?? null,
              });
            }

            apiLog("info", route, "subscription_metadata_after_checkout", {
              requestId,
              sessionId: session.id,
              subscriptionId: sub.id,
              paymentCycleLimit: sub.metadata?.payment_cycle_limit ?? null,
              enrollmentType: sub.metadata?.enrollment_type ?? null,
              programSlugFromSub: sub.metadata?.programSlug ?? null,
            });
            if (!sub.metadata?.payment_cycle_limit) {
              apiLog("warn", route, "subscription_missing_payment_cycle_limit", {
                requestId,
                subscriptionId: sub.id,
                hint: "Sesión sin payment_cycle_limit en metadata; revisa create-checkout-session (recurring)",
              });
            } else {
              const limit = parseInt(String(sub.metadata?.payment_cycle_limit).trim(), 10);
              if (Number.isFinite(limit) && limit > 0) {
                const scheduleId =
                  typeof sub.schedule === "string"
                    ? sub.schedule
                    : sub.schedule?.id ?? null;

                if (!scheduleId) {
                  // Create a subscription schedule so Stripe enforces N billing cycles
                  // server-side. This is what guarantees the 4/4 cap and does NOT depend
                  // on a webhook write while a Test Clock is advancing.
                  //
                  // Stripe rejects `end_behavior` together with `from_subscription` on
                  // create, so we create first, then update `end_behavior` + the phase's
                  // duration in a single follow-up call.
                  //
                  // On API >= 2026-03-25.dahlia the legacy `iterations` parameter is
                  // replaced by `duration: { interval, interval_count }`. We mirror the
                  // price's recurring interval so 4 cycles == `limit` invoices regardless
                  // of whether the price is monthly, quarterly, etc.
                  try {
                    const recurring = sub.items.data[0]?.price?.recurring;
                    if (!recurring) {
                      apiLog("warn", route, "subscription_schedule_no_recurring_price", {
                        requestId,
                        subscriptionId: subId,
                      });
                    } else {
                      const schedule = await stripe.subscriptionSchedules.create({
                        from_subscription: subId,
                      });

                      const phase0 = schedule.phases?.[0];
                      if (phase0) {
                        const intervalCount =
                          limit * (recurring.interval_count ?? 1);

                        await stripe.subscriptionSchedules.update(schedule.id, {
                          end_behavior: "cancel",
                          phases: [
                            {
                              start_date: phase0.start_date,
                              items: phase0.items.map((it) => ({
                                price:
                                  typeof it.price === "string"
                                    ? it.price
                                    : it.price.id,
                                quantity: it.quantity ?? 1,
                              })),
                              duration: {
                                interval: recurring.interval,
                                interval_count: intervalCount,
                              },
                            },
                          ],
                        });

                        apiLog(
                          "info",
                          route,
                          "subscription_schedule_created_for_installments",
                          {
                            requestId,
                            subscriptionId: subId,
                            scheduleId: schedule.id,
                            paymentCycleLimit: limit,
                            durationInterval: recurring.interval,
                            durationIntervalCount: intervalCount,
                          },
                        );
                      } else {
                        apiLog("warn", route, "subscription_schedule_missing_phase", {
                          requestId,
                          subscriptionId: subId,
                          scheduleId: schedule.id,
                        });
                      }
                    }
                  } catch (scheduleErr) {
                    // Schedule creation/update failure is non-fatal: the
                    // `invoice.paid` handler still flips `cancel_at_period_end`
                    // when the paid-invoice count reaches the limit.
                    apiLog("warn", route, "subscription_schedule_setup_failed", {
                      requestId,
                      subscriptionId: subId,
                      paymentCycleLimit: limit,
                      error:
                        scheduleErr instanceof Error
                          ? scheduleErr.message
                          : String(scheduleErr),
                    });
                  }
                } else {
                  apiLog("info", route, "subscription_already_has_schedule", {
                    requestId,
                    subscriptionId: subId,
                    scheduleId,
                  });
                }
              }
            }
          } catch (e) {
            apiLog("warn", route, "subscription_retrieve_failed_after_checkout", {
              requestId,
              subscriptionId: subId,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        } else {
          apiLog("warn", route, "checkout_subscription_mode_no_subscription_id", {
            requestId,
            sessionId: session.id,
          });
        }
      }
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

    case "invoice.paid":
    case "invoice.payment_succeeded":
    case "invoice_payment.paid": {
      // Stripe sends up to three near-simultaneous events for the same invoice
      // (`invoice.paid`, `invoice.payment_succeeded`, and the newer `invoice_payment.paid`).
      // We use the same handler for all three; the early `cancel_at_period_end` short-circuit
      // below makes the redundant runs cheap (no duplicate writes).
      try {
        const { invoiceId, subscriptionId, amountPaid } =
          await resolveInvoiceContext(stripe, event);

        if (amountPaid === 0) {
          apiLog("info", route, "invoice_paid_zero_amount_skipped", {
            requestId,
            eventId: event.id,
            type: event.type,
            invoiceId,
          });
          break;
        }

        if (!subscriptionId) {
          // One-off invoice (no subscription) — installment cap doesn't apply.
          break;
        }

        apiLog("info", route, "invoice_paid_received", {
          requestId,
          eventId: event.id,
          type: event.type,
          invoiceId,
          subscriptionId,
        });

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        if (
          subscription.status === "canceled" ||
          subscription.status === "incomplete_expired"
        ) {
          apiLog("info", route, "invoice_paid_subscription_inactive", {
            requestId,
            subscriptionId: subscription.id,
            status: subscription.status,
          });
          break;
        }

        // Idempotent guard for the duplicate-fan-out events: if a sibling event
        // already flipped this flag, skip the count + write entirely.
        if (subscription.cancel_at_period_end) {
          apiLog("info", route, "subscription_already_set_to_cancel_at_period_end", {
            requestId,
            subscriptionId,
            invoiceId,
          });
          break;
        }

        const paymentCycleLimit = subscription.metadata?.payment_cycle_limit;
        if (!paymentCycleLimit?.trim()) {
          apiLog("warn", route, "invoice_subscription_no_cycle_limit", {
            requestId,
            subscriptionId: subscription.id,
            invoiceId,
          });
          break;
        }

        const limit = parseInt(paymentCycleLimit.trim(), 10);
        if (!Number.isFinite(limit) || limit <= 0) {
          apiLog("warn", route, "invoice_subscription_invalid_cycle_limit", {
            requestId,
            subscriptionId: subscription.id,
            invoiceId,
            paymentCycleLimit,
          });
          break;
        }

        // Read-only count: lists paid invoices for this subscription.
        // Avoids the per-payment metadata writes that fail under "test clock advancement underway".
        const paidInvoiceCount = await countPaidInvoices(stripe, subscriptionId);
        apiLog("info", route, "subscription_cycle_count_computed", {
          requestId,
          subscriptionId,
          invoiceId,
          paidInvoiceCount,
          paymentCycleLimit: limit,
          progress: `${paidInvoiceCount}/${limit}`,
        });

        if (paidInvoiceCount < limit) break;

        // Fallback cap: the subscription schedule (created in `checkout.session.completed`)
        // is what normally ends the subscription at exactly N cycles. This single write is
        // only required when the schedule wasn't attached (e.g. `subscription_schedule_setup_failed`),
        // and is a no-op once the schedule has already canceled the subscription.
        try {
          await stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: true,
          });
          apiLog(
            "info",
            route,
            "subscription_set_to_cancel_at_period_end_installment_limit",
            {
              requestId,
              subscriptionId,
              invoiceId,
              paidInvoiceCount,
              paymentCycleLimit: limit,
            },
          );
        } catch (cancelErr) {
          if (
            cancelErr instanceof Stripe.errors.StripeInvalidRequestError &&
            /canceled subscription/i.test(cancelErr.message ?? "")
          ) {
            apiLog("info", route, "subscription_already_cancelled", {
              requestId,
              subscriptionId,
            });
          } else {
            throw cancelErr;
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        // Stripe Test Clock locks subscription writes while the clock is advancing.
        // Returning 500 makes Stripe retry the webhook with backoff once the clock is free.
        if (/test clock advancement underway/i.test(errorMessage)) {
          apiLog("warn", route, "test_clock_busy_retrying_later", {
            requestId,
            eventId: event.id,
            type: event.type,
          });
          return textResponse("Test clock busy, retrying...", 500, requestId);
        }

        // Any other failure: log and 200 so Stripe doesn't enter a retry loop.
        apiLog("error", route, "invoice_paid_internal_error", {
          requestId,
          eventId: event.id,
          type: event.type,
          error: errorMessage,
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoiceSubscriptionId(invoice);
      apiLog("warn", route, "invoice_payment_failed", {
        requestId,
        eventId: event.id,
        invoiceId: invoice.id,
        subscriptionId: subscriptionId ?? undefined,
        amountDue: invoice.amount_due,
        attemptCount: invoice.attempt_count,
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      apiLog("info", route, "subscription_deleted", {
        requestId,
        eventId: event.id,
        subscriptionId: subscription.id,
        status: subscription.status,
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
