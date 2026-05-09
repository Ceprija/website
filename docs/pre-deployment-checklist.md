# Pre-Deployment Checklist

Run this before enabling live Stripe payments.

## Local/CI Checks

- [ ] `npm ci`
- [ ] `npm run sync`
- [ ] `npm run validate:stripe`
- [ ] `npm run astro -- check`
- [ ] `npm run build`

## Stripe Dashboard

- [ ] Live Products and Prices exist for each payable program option.
- [ ] All markdown `stripePriceId` values are live `price_...` IDs.
- [ ] `STRIPE_ALLOWED_PRICE_IDS` contains every live price ID.
- [ ] Live webhook endpoint exists: `https://ceprija.edu.mx/api/stripe/webhook`.
- [ ] Webhook signing secret is configured as `STRIPE_WEBHOOK_SECRET`.

## Payment Flow

- [ ] Checkout starts from a program detail page.
- [ ] Checkout redirects back to `/pago-exitoso?session_id=...`.
- [ ] `/api/confirm-enrollment` returns success.
- [ ] Participant receives confirmation email.
- [ ] Control Escolar/admin receives notification email.
- [ ] Duplicate refresh of `/pago-exitoso` does not duplicate emails.

## Installment Flow

- [ ] Recurring price creates a subscription Checkout Session.
- [ ] Subscription metadata includes `payment_cycle_limit=4`.
- [ ] Subscription schedule is created after `checkout.session.completed`.
- [ ] Paid invoice webhook count reaches the configured limit.
- [ ] Subscription ends or is marked to cancel after the configured cycle count.

## Failure Scenarios

- [ ] Invalid `priceId` is rejected.
- [ ] Missing/invalid `session_id` is rejected.
- [ ] Payment not confirmed returns a user-friendly message.
- [ ] Brevo failure records a line in `data/failed-emails.jsonl`.
- [ ] Webhook with invalid signature returns `400`.
- [ ] Duplicate webhook event returns `duplicate: true`.

## Server

- [ ] `/api/health` returns HTTP `200`.
- [ ] PM2 process is running.
- [ ] Nginx config passes `nginx -t`.
- [ ] TLS certificate is valid.
- [ ] Logs are being collected.
