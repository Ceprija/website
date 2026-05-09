# Monitoring Setup

## Health Check

The app exposes:

```text
GET /api/health
```

The endpoint checks:

- Required production environment variables
- Stripe API reachability via `balance.retrieve()`
- Runtime write access for the Stripe idempotency store in `data/`

Use this endpoint from uptime monitoring. Alert when it returns non-`200`.

## Application Logs

API routes write one JSON line per operational event. Important fields:

- `ts`
- `level`
- `route`
- `message`
- `requestId`
- Stripe IDs such as `sessionId`, `eventId`, `subscriptionId`

Forward stdout/stderr from PM2 to a log system such as DigitalOcean Logs, Papertrail, or Datadog.

## Stripe Alerts

In Stripe Dashboard, monitor:

- Webhook delivery failures
- `payment_intent.payment_failed`
- `invoice.payment_failed`
- Disputes and refunds

Suggested alert thresholds:

- More than 5 failed webhook deliveries in 10 minutes
- More than 10% payment failure rate over 30 minutes
- Any `charge.dispute.created`
- Any repeated `subscription_schedule_setup_failed`

## Email Alerts

Email failures are written to:

```text
data/failed-emails.jsonl
```

Review this file after deploys and during incidents. Each line contains the recipient, subject, Stripe session, program slug, and failure reason for manual follow-up.
