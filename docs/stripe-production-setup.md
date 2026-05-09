# Stripe Production Setup

This project uses server-created Stripe Checkout Sessions. The browser never needs a publishable key because all payment intent/session creation happens in `POST /api/stripe/create-checkout-session`.

## 1. Create Live Products And Prices

Create live-mode Products and Prices in Stripe Dashboard for every active program and every payable option.

Required content locations:

- `src/content/programas/**.md`
- `paymentOptions[].stripePriceId`
- `variantOptions.moduleSelection.options[].stripePriceIds.presencial`
- `variantOptions.moduleSelection.options[].stripePriceIds.online`

Rules:

- Use only live-mode `price_...` IDs with `STRIPE_SECRET_KEY=sk_live_...`.
- Do not use `prod_...` IDs in content or `STRIPE_ALLOWED_PRICE_IDS`.
- Replace placeholder/example IDs such as `price_REPLACE_...` and `price_1Cfg...` before production.
- Keep recurring installment prices as recurring prices in Stripe; one-time prices must be one-time prices.

Validate locally before deployment:

```sh
npm run validate:stripe
```

## 2. Configure Production Environment

Set these values on the server, not in git:

```sh
NODE_ENV=production
SITE_URL=https://ceprija.edu.mx
STRIPE_SECRET_KEY=sk_live_REPLACE_WITH_LIVE_SECRET
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_WITH_LIVE_WEBHOOK_SECRET
STRIPE_ALLOWED_PRICE_IDS=price_live_1,price_live_2
KEY_API_BREVO=REPLACE_WITH_BREVO_KEY
EMAIL_CONTROL_ESCOLAR=controlescolar@ceprija.edu.mx
EMAIL_SOPORTE_WEB=desarrolloweb@ceprija.edu.mx
```

`STRIPE_ALLOWED_PRICE_IDS` must contain every live `price_...` used by active programs. In production, the app rejects checkout creation if this list is empty.

## 3. Register The Webhook Endpoint

In Stripe Dashboard live mode:

1. Go to Developers -> Webhooks.
2. Add endpoint: `https://ceprija.edu.mx/api/stripe/webhook`.
3. Select these events:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_succeeded`
   - `invoice_payment.paid`
   - `invoice.payment_failed`
   - `payment_intent.payment_failed`
   - `charge.refunded`
   - `charge.dispute.created`
   - `charge.dispute.closed`
   - `customer.subscription.deleted`
4. Copy the signing secret (`whsec_...`) into production `STRIPE_WEBHOOK_SECRET`.

Do not reuse the local Stripe CLI `whsec_...` in production.

## 4. Rotate The Webhook Secret

1. Create a second webhook endpoint in Stripe Dashboard with the same URL and events.
2. Add the new `whsec_...` value to production config during a maintenance window.
3. Restart the app.
4. Use Stripe Dashboard webhook delivery logs to confirm successful `2xx` responses.
5. Delete the old webhook endpoint.

## 5. Production Smoke Test

After deployment:

1. Open `/api/health`; it should return `status: "ok"`.
2. Create a low-value live test program/price or use Stripe test mode on staging first.
3. Complete Checkout.
4. Confirm:
   - Checkout redirects to `/pago-exitoso?session_id=...`.
   - `POST /api/confirm-enrollment` returns success.
   - Participant and admin emails arrive.
   - Stripe Dashboard shows webhook deliveries with `2xx` responses.

## 6. Failure Response

If checkout fails:

- Check app logs for `requestId`, `programSlug`, `priceId`, and `code`.
- Check Stripe Dashboard -> Developers -> Webhooks for delivery errors.
- Check `data/failed-emails.jsonl` for email notifications that need manual follow-up.
- Run `npm run validate:stripe` on the deployed revision to catch stale or missing prices.
