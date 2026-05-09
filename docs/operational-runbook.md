# Operational Runbook

## Add A New Payable Program

1. Create the Product and Price in the same Stripe mode as the deployment.
2. Add the `price_...` ID to the program markdown.
3. Add the same ID to `STRIPE_ALLOWED_PRICE_IDS`.
4. Run `npm run validate:stripe`.
5. Deploy and test checkout.

## Manual Enrollment Confirmation

If a user paid but did not receive email:

1. Find the Checkout Session in Stripe Dashboard.
2. Confirm `payment_status=paid`.
3. Check app logs for the `sessionId`.
4. Check `data/failed-emails.jsonl`.
5. Contact the participant manually and notify Control Escolar.

## Refunds

Process refunds in Stripe Dashboard. The app logs `charge.refunded` webhook events; enrollment status is not automatically changed, so Control Escolar must update records manually.

## Disputes

`charge.dispute.created` logs at error level. When this appears:

1. Review the payment in Stripe Dashboard.
2. Gather enrollment and email evidence.
3. Respond inside Stripe Dashboard before the due date.
4. Notify administration.

## Webhook Failures

1. Open Stripe Dashboard -> Developers -> Webhooks.
2. Inspect failed delivery body and response status.
3. Check app logs using the Stripe `eventId`.
4. Fix the issue and use "Retry" in Stripe Dashboard.

## Email Failures

Review:

```text
data/failed-emails.jsonl
```

Each line is a manual follow-up task. Once resolved, keep the file as audit history or archive it off-server.
