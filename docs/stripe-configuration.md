# Stripe configuration reference

How the CEPRIJA site integrates with Stripe, what to configure on the dashboard, and how to test it. This is the source of truth — program-specific notes (e.g. `stripe-setup-diplomado-civil.md`) only cover the price IDs of one program.

## TL;DR

- One-time payments → Stripe Checkout in `mode: "payment"`.
- Installment plans (recurring price) → Stripe Checkout in `mode: "subscription"` + a **subscription schedule** with `end_behavior: "cancel"` and `phases[0].duration` set to the price's interval × `payment_cycle_limit` (default `4`). The schedule is what enforces the cap server-side.
- Webhook (`/api/stripe/webhook`) listens to a small set of events, and is **idempotent** (deduplicates on `event.id` + short-circuits when `cancel_at_period_end` is already flipped).

## 1. Code surface

| Concern | File |
|---|---|
| Create the Checkout session (one-time or subscription) | `src/pages/api/stripe/create-checkout-session.ts` |
| Webhook receiver (signature verify, switch, schedule + fallback cap) | `src/pages/api/stripe/webhook.ts` |
| Allowed price IDs guard | `STRIPE_ALLOWED_PRICE_IDS` env, parsed by `src/lib/stripeAllowedPrices.ts` |
| Successful enrollment email + confirmation | `src/pages/api/confirm-enrollment.ts` (triggered when `/pago-exitoso` opens) |
| Per-program price IDs | `src/content/programas/**/*.md` → `stripePriceIds` |

The webhook file is `prerender = false` so it stays a dynamic server endpoint under Astro 5 `output: "static"`. Do **not** switch to `output: "hybrid"` — the rest of the site is static; only API routes opt out.

## 2. Stripe Dashboard configuration

### 2.1 API version

- The site uses `stripe@22.x` which pins API version `2026-03-25.dahlia` by default (see `node_modules/stripe/cjs/apiVersion.js`).
- Your **account default API version** (Dashboard → Developers → API version) and your **webhook endpoint API version** should match Dahlia, otherwise event payload shapes drift. The webhook handles the Dahlia move of `Invoice.subscription` → `Invoice.parent.subscription_details.subscription` with a backward-compat fallback, but the helper assumes both fields may exist.
- The `stripe listen` CLI banner shows its own pin (e.g. `2023-08-16`). That is **not** the version events are delivered at — webhook events use the endpoint's API version. Ignore the banner.

### 2.2 Products and prices

For every program option that should be sellable through the site, create a **Price** in the Dashboard and reference its `price_…` id from `src/content/programas/**/*.md`:

```yaml
paymentOptions:
  - id: "pago_completo"
    label: "Pago completo"
    price: 21500
    stripePriceId: "price_XXX"   # one-time price (Recurring = Off)
    type: "hibrido"
  - id: "plan_diferido"
    label: "Plan de pagos: 4 pagos de $5,000"
    price: 5000
    stripePriceId: "price_YYY"   # recurring price (e.g. monthly)
    type: "hibrido"
```

- One-time options: price's **Recurring** = `Off`. The site routes these to Checkout `mode: "payment"`.
- Installment options: price's **Recurring** = `On`, with `interval = month` (or whatever cadence). The site routes these to Checkout `mode: "subscription"` and forces `payment_cycle_limit = 4` at session creation (see `create-checkout-session.ts`).

If you want to allow only a specific list of prices (recommended for prod), set:

```env
STRIPE_ALLOWED_PRICE_IDS=price_AAA,price_BBB,price_CCC
```

Empty value = anything goes (only OK in dev/test).

### 2.3 Webhook endpoint

Dashboard → Developers → Webhooks → **Add endpoint**.

- **Endpoint URL** (prod): `https://<your-domain>/api/stripe/webhook`
- **Endpoint URL** (local dev): use `stripe listen --forward-to localhost:4321/api/stripe/webhook` instead — do **not** point a real Dashboard endpoint at a tunnel.
- **API version**: pick the same Dahlia version as your account (see 2.1).
- **Listen to specific events**, subscribe to exactly these:

  | Event | Why |
  |---|---|
  | `checkout.session.completed` | Repair subscription metadata if needed and attach the schedule that enforces the installment cap. |
  | `invoice.paid` | Count paid invoices; flip `cancel_at_period_end` as a fallback if the schedule wasn't attached. |
  | `invoice.payment_failed` | Logged so we can see retries and dunning. |
  | `customer.subscription.deleted` | Logged so we know the schedule completed cleanly. |
  | `payment_intent.payment_failed` | Logged for one-time-payment failures (no subscription involved). |
  | `charge.refunded` | Audit log on refunds. |
  | `charge.dispute.created` | Operational alert. |
  | `charge.dispute.closed` | Audit log when a dispute resolves. |

  Notes:
  - Stripe sends `invoice.paid`, `invoice.payment_succeeded`, **and** `invoice_payment.paid` for the same payment on Dahlia. The webhook handles all three with the same logic and short-circuits the duplicates, but you can subscribe to **only `invoice.paid`** to remove the noise. Either is supported by the code.
  - `subscription_schedule.*` events are intentionally not subscribed — we read the schedule state synchronously when needed.
- **Signing secret**: copy `whsec_…` and put it in `STRIPE_WEBHOOK_SECRET`.

### 2.4 Environment variables

In `.env` at the repo root (and in your prod hosting's secrets):

```env
STRIPE_SECRET_KEY=sk_test_...           # sk_live_... in production
STRIPE_WEBHOOK_SECRET=whsec_...         # value depends on env (dev = stripe listen, prod = dashboard)
STRIPE_ALLOWED_PRICE_IDS=price_A,price_B # optional but recommended in prod
```

`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are **required**. If either is missing the route returns `503 Not configured` and logs `stripe_webhook_not_configured`.

## 3. How the installment cap works

There are two mechanisms in play. The first one is what **actually** stops the billing; the second is a defensive net.

### 3.1 Primary: subscription schedule (server-side)

When `checkout.session.completed` fires for a subscription:

1. We read `payment_cycle_limit` (default `"4"`) and `enrollment_type` from session/subscription metadata. If the subscription is missing the metadata, we copy it back from the session.
2. We attach a **subscription schedule** to that subscription:

   ```ts
   const schedule = await stripe.subscriptionSchedules.create({
     from_subscription: subId,            // create-then-update is required by Stripe;
   });                                    // end_behavior is rejected on create when from_subscription is set.
   await stripe.subscriptionSchedules.update(schedule.id, {
     end_behavior: "cancel",
     phases: [{
       start_date: phase0.start_date,
       items: [...],
       duration: {
         interval: recurring.interval,    // mirrors the price (month / week / year)
         interval_count: limit * (recurring.interval_count ?? 1),
       },
     }],
   });
   ```

   On the Dahlia API, `iterations` was renamed to `duration: { interval, interval_count }`. With `duration = { month, 4 }` and a monthly price, Stripe ends the schedule (and cancels the subscription) immediately after the 4th paid invoice.

3. Look for the log line `subscription_schedule_created_for_installments` to confirm.

If the schedule cannot be created (no recurring price, missing phase, API error), we log `subscription_schedule_setup_failed` / `subscription_schedule_no_recurring_price` and rely on the fallback below.

### 3.2 Fallback: `cancel_at_period_end` on the Nth invoice

On every `invoice.paid` (and the duplicate fan-out events), the webhook:

1. Resolves `(invoiceId, subscriptionId)` regardless of whether the payload is an `Invoice` or an `InvoicePayment`.
2. Skips immediately if `subscription.cancel_at_period_end === true` (idempotent guard for the duplicates).
3. Calls `stripe.invoices.list({ subscription, status: "paid", limit: 100 })` and counts the result. **No metadata writes.** This avoids the Test Clock "advancement underway" race.
4. If `paidInvoiceCount >= payment_cycle_limit`, makes a single `stripe.subscriptions.update(subId, { cancel_at_period_end: true })`.

Look for the log lines `subscription_cycle_count_computed` (`progress: "N/limit"`) and `subscription_set_to_cancel_at_period_end_installment_limit`. If the schedule is in place, this fallback is a no-op (schedule already canceled the subscription).

### 3.3 Test Clock errors

If a write hits Stripe while a Test Clock is advancing, Stripe returns "Test clock advancement underway". The webhook detects that string, returns `500 Test clock busy, retrying...`, and Stripe retries with backoff. This is **only** observable in test mode and only matters when the schedule did **not** attach for some reason.

## 4. Local testing recipe

1. From the repo root, in three terminals:

   ```bash
   # Terminal 1: Astro dev (the webhook is hot-reloadable)
   npm run dev

   # Terminal 2: forward webhooks to the dev server
   stripe listen --forward-to localhost:4321/api/stripe/webhook

   # Terminal 3: free for stripe CLI commands
   ```

2. Make sure `.env` has `STRIPE_SECRET_KEY=sk_test_…` and `STRIPE_WEBHOOK_SECRET` matching the `whsec_…` printed by `stripe listen`.
3. Open the program page in the browser and complete a Checkout with the test card `4242 4242 4242 4242`.
4. In the Astro log, confirm this sequence within ~2 seconds of checkout:

   ```
   subscription_metadata_after_checkout … paymentCycleLimit:"4"
   subscription_schedule_created_for_installments … durationInterval:"month" durationIntervalCount:4
   invoice_paid_received … type:"invoice.paid"
   subscription_cycle_count_computed … progress:"1/4"
   ```

5. Verify the schedule is real:

   ```bash
   stripe subscriptions retrieve sub_NEW_ID
   stripe subscription_schedules retrieve sub_sched_NEW_ID
   ```

   `phases[0].duration` must be `{ interval: "month", interval_count: 4 }`, `end_behavior` must be `"cancel"`.

6. Advance the Test Clock **one billing period at a time**, waiting for the `test_helpers.test_clock.ready` event between advances. After advance #4 you should see:

   ```
   invoice_paid_received … (4th)
   subscription_cycle_count_computed … progress:"4/4"
   subscription_schedule.completed   (event)
   subscription_deleted … status:"canceled"
   ```

7. Final assertions:

   ```bash
   stripe invoices list --subscription sub_NEW_ID --status paid --limit 20   # expect 4
   stripe subscriptions retrieve sub_NEW_ID                                   # expect status: "canceled"
   ```

If you batch multiple advances without waiting for `test_clock.ready`, you'll see `[500] test_clock_busy_retrying_later` in the logs. That's harmless when the schedule is in place; the schedule still ends the subscription correctly.

## 5. Going to production

1. Switch `STRIPE_SECRET_KEY` to `sk_live_…` and `STRIPE_WEBHOOK_SECRET` to the **production endpoint's** signing secret.
2. Replace test prices with live prices. Update `stripePriceId` in every `src/content/programas/**/*.md` that should be live.
3. Lock down `STRIPE_ALLOWED_PRICE_IDS` to the exact live `price_…` ids you want sold through the site.
4. In Dashboard → Webhooks, point the prod endpoint at `https://<your-domain>/api/stripe/webhook` with the events listed in §2.3.
5. Smoke test once with a real card on a low-value product, then refund.

## 6. Common failure modes and what their logs look like

| Symptom | Log line | What to do |
|---|---|---|
| `503 Not configured` on every webhook | `stripe_webhook_not_configured` | `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` missing in env |
| `400 Invalid signature` | `invalid_stripe_signature` | `STRIPE_WEBHOOK_SECRET` doesn't match the endpoint that delivered the event (mixing dev/prod secrets is the usual cause) |
| Subscription bills past `payment_cycle_limit` | `subscription_schedule_setup_failed` / `subscription_schedule_no_recurring_price` | Inspect the `error` field; the fallback `cancel_at_period_end` write should still cap it on the Nth invoice |
| `progress` exceeds the limit (e.g. `5/4`) | `subscription_cycle_count_computed … progress:"5/4"` | Schedule wasn't attached; check the Stripe API version and that the price's `recurring.interval` is set |
| Webhook rejected by Stripe with retries | `test_clock_busy_retrying_later` | Test mode only; advance the clock one period at a time and wait for `test_clock.ready` |
| Same invoice processed three times | n/a — expected | Stripe sends `invoice.paid` + `invoice.payment_succeeded` + `invoice_payment.paid`. The handler dedupes via `subscription.cancel_at_period_end`. To remove the noise, subscribe to only `invoice.paid` in the Dashboard. |

## 7. When to update this doc

- The Stripe API version in `node_modules/stripe/cjs/apiVersion.js` changes (after a major SDK bump). Verify the new version still ships `Invoice.parent.subscription_details.subscription` and `phases[0].duration`.
- A new event type starts appearing in the `default: unhandled_event_type` branch frequently — decide whether to handle it or filter it out at the Dashboard endpoint.
- The list in §2.3 changes (we add or drop business logic that depends on a Stripe event).
