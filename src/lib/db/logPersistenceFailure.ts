/**
 * Log persistence failure for monitoring/alerting.
 * In production, this should send to your logging service (Sentry, Datadog, etc.)
 */
export function logPersistenceFailure(opts: {
  route: string;
  requestId: string;
  flow: string;
  reason: string;
  email?: string;
  error?: string;
}) {
  // For now, log to console with structured format for log aggregation
  console.error("[PERSISTENCE_FAILURE]", {
    timestamp: new Date().toISOString(),
    route: opts.route,
    request_id: opts.requestId,
    flow: opts.flow,
    reason: opts.reason,
    email: opts.email,
    error: opts.error,
  });
  
  // TODO: Send to monitoring service in production
  // Example: Sentry.captureMessage("DB persistence failed", { extra: opts });
}
