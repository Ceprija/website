# Incident Response

## Payment Outage

1. Check `/api/health`.
2. Check PM2 logs.
3. Check Stripe Dashboard status and webhook delivery logs.
4. If checkout creation fails, temporarily hide payment CTAs or switch affected programs to waitlist.
5. Communicate with Control Escolar and support.

## Suspected Secret Exposure

1. Rotate `STRIPE_SECRET_KEY` in Stripe Dashboard.
2. Rotate `STRIPE_WEBHOOK_SECRET` by creating a new webhook endpoint.
3. Rotate `KEY_API_BREVO`.
4. Update server environment variables.
5. Restart PM2 and verify `/api/health`.
6. Review Stripe logs for suspicious activity.

## Duplicate Or Missing Emails

1. Check `data/stripe-enrollment-session-ids.json`.
2. Check `data/failed-emails.jsonl` (look for `heic`, `admin_email_failed`, or Brevo 400).
3. Use Stripe Session ID to confirm payment.
4. Send manual follow-up from Control Escolar if needed.
5. Verify `URL_BASE_API` ends with `/` when Laravel mirror is enabled.
6. iPhone HEIC uploads are converted to JPEG on the server before Brevo; if conversion fails, the API returns 400 with `heic_convert_failed`.

## Rollback

1. Deploy the previous git revision.
2. Keep Stripe webhook URL unchanged.
3. Restart PM2.
4. Verify `/api/health`.
5. Retry failed Stripe webhooks from Dashboard after the app is healthy.
