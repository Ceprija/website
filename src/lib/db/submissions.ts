/**
 * School Hub Integration - HTTP Endpoint Approach
 * 
 * The website calls ceprija-control-escolar's Edge Function via HTTP using a
 * bearer token. This keeps the Supabase service role key isolated in the
 * School Hub project only.
 * 
 * All functions return null/false if the endpoint is not configured or fails.
 * The API handlers should never break due to School Hub unavailability.
 */

import {
  SCHOOL_HUB_SUBMISSIONS_TOKEN,
  SCHOOL_HUB_SUBMISSIONS_URL,
} from "astro:env/server";
import { apiLog } from "@lib/server/apiRequestLog";

// ============================================================================
// TYPES
// ============================================================================

export type SubmissionFlow =
  | "brochure_download"
  | "postgraduate_application"
  | "educacion_continua"
  | "wire_proof"
  | "register"
  | "legacy_inscription"
  | "fiscal_preflight"
  | "stripe_checkout_intent"
  | "stripe_paid_confirmation";

export type PersonKind =
  | "lead"
  | "interested"
  | "applicant"
  | "enrollment_intent"
  | "enrolled";

export type WorkflowStatus =
  | "received"
  | "pending_review"
  | "approved"
  | "rejected"
  | "checkout_created"
  | "paid"
  | "abandoned"
  | "failed";

export type WireReviewStatus = "pending" | "approved" | "rejected";

export type StorageBucket =
  | "website-applications"
  | "website-wire-proofs"
  | "website-fiscal-documents"
  | "website-uploads";

export type SubmissionEventType =
  | "submission_received"
  | "files_uploaded"
  | "email_queued"
  | "email_sent"
  | "email_failed"
  | "checkout_created"
  | "payment_confirmed"
  | "wire_approved"
  | "wire_rejected"
  | "status_updated"
  | "laravel_mirror_failed";

export type UploadedFileInput = {
  fieldname: string;
  buffer: Buffer;
  filename: string;
  mimetype: string;
};

export type CreateSubmissionInput = {
  requestId: string;
  flow: SubmissionFlow;
  personKind: PersonKind;
  workflowStatus?: WorkflowStatus;
  wireReviewStatus?: WireReviewStatus | null;
  email?: string | null;
  phone?: string | null;
  programSlug?: string | null;
  programTitle?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeCustomerId?: string | null;
  stripeEventId?: string | null;
  apiRoute: string;
  payload: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
};

// ============================================================================
// HTTP CLIENT
// ============================================================================

const DEFAULT_REQUEST_TIMEOUT_MS = 8000;

function getEndpointConfig(): { url: string; token: string } | null {
  const url = SCHOOL_HUB_SUBMISSIONS_URL?.trim();
  const token = SCHOOL_HUB_SUBMISSIONS_TOKEN?.trim();
  if (!url || !token) return null;
  return { url, token };
}

async function callSchoolHub<T>(
  scope: string,
  body: Record<string, unknown>,
  context: Record<string, unknown>,
  opts?: { timeoutMs?: number },
): Promise<T | null> {
  const cfg = getEndpointConfig();
  if (!cfg) {
    apiLog("warn", scope, "school_hub_not_configured", context);
    return null;
  }

  const timeoutMs =
    typeof opts?.timeoutMs === "number" && Number.isFinite(opts.timeoutMs)
      ? Math.max(250, Math.min(30_000, Math.floor(opts.timeoutMs)))
      : DEFAULT_REQUEST_TIMEOUT_MS;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cfg.token}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      apiLog("error", scope, `school_hub_http_${res.status}`, {
        ...context,
        response: text.slice(0, 500),
      });
      return null;
    }
    
    return (await res.json()) as T;
  } catch (error) {
    apiLog("error", scope, "school_hub_request_failed", {
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export type PersistSubmissionResult =
  | { ok: true; submissionId: string; duplicate?: boolean }
  | { ok: false; reason: "not_configured" | "endpoint_error"; error?: string };

export async function persistSubmission(
  input: CreateSubmissionInput,
  logRoute: string,
  opts?: { timeoutMs?: number },
): Promise<PersistSubmissionResult> {
  const body = {
    op: "insert" as const,
    request_id: input.requestId,
    flow: input.flow,
    person_kind: input.personKind,
    workflow_status: input.workflowStatus ?? "received",
    email: input.email ?? null,
    phone: input.phone ?? null,
    program_slug: input.programSlug ?? null,
    program_title: input.programTitle ?? null,
    stripe_checkout_session_id: input.stripeCheckoutSessionId ?? null,
    stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
    stripe_customer_id: input.stripeCustomerId ?? null,
    stripe_event_id: input.stripeEventId ?? null,
    wire_review_status: input.wireReviewStatus ?? null,
    payload: input.payload,
    api_route: input.apiRoute,
    ip: input.ip ?? null,
    user_agent: input.userAgent ?? null,
  };

  const result = await callSchoolHub<{ id: string; duplicate?: boolean }>(
    logRoute,
    body,
    { flow: input.flow, requestId: input.requestId },
    opts,
  );

  if (!result?.id) {
    return { ok: false, reason: "endpoint_error" };
  }

  return {
    ok: true,
    submissionId: result.id,
    ...(result.duplicate ? { duplicate: true } : {}),
  };
}

export async function appendSubmissionEvent(
  submissionId: string,
  eventType: SubmissionEventType,
  payload: Record<string, unknown> = {},
  actorType: "system" | "applicant" | "admin" | "stripe_webhook" = "system",
  actorId?: string,
): Promise<void> {
  await callSchoolHub(
    "appendSubmissionEvent",
    {
      op: "log_event",
      submission_id: submissionId,
      event_type: eventType,
      actor_type: actorType,
      actor_id: actorId ?? null,
      payload,
    },
    { submissionId, eventType },
  );
}

export type UploadSubmissionFilesResult =
  | { ok: true; file_ids: string[]; count: number; duplicate?: boolean }
  | { ok: false; reason: string };

export async function uploadSubmissionFiles(input: {
  submissionId: string;
  flow: SubmissionFlow;
  files: [{
    field_name: string;
    original_filename: string;
    mime_type: string;
    content_base64: string;
  }];
  timeoutMs?: number;
}): Promise<UploadSubmissionFilesResult> {
  const result = await callSchoolHub<{ 
    file_ids?: string[]; 
    count?: number; 
    duplicate?: boolean 
  }>(
    "uploadSubmissionFiles",
    {
      op: "upload_files",
      submission_id: input.submissionId,
      flow: input.flow,
      files: input.files,
    },
    { route: "uploadSubmissionFiles", submissionId: input.submissionId },
    { timeoutMs: input.timeoutMs ?? 20000 }
  );

  if (!result) {
    return { ok: false, reason: "edge_function_failed" };
  }

  return {
    ok: true,
    file_ids: result.file_ids ?? [],
    count: result.count ?? 1,
    duplicate: result.duplicate ?? false,
  };
}

export async function recordEmailAttempt(
  submissionId: string | null,
  opts: {
    route: string;
    recipientRole: "admin" | "applicant";
    recipients: string[];
    subject: string;
    status: "sent" | "failed";
    error?: string;
    brevoMessageId?: string;
    brevoStatusCode?: number;
    programSlug?: string;
    stripeSessionId?: string;
    idempotencyKey?: string;
  },
): Promise<void> {
  await callSchoolHub(
    opts.route,
    {
      op: "log_email",
      submission_id: submissionId,
      idempotency_key: opts.idempotencyKey ?? null,
      route: opts.route,
      kind: opts.recipientRole === "admin" ? "admin" : "participant",
      recipients: opts.recipients,
      subject: opts.subject.slice(0, 500),
      status: opts.status,
      brevo_message_id: opts.brevoMessageId ?? null,
      brevo_status_code: opts.brevoStatusCode ?? null,
      failure_reason: opts.error ?? null,
      program_slug: opts.programSlug ?? null,
      stripe_session_id: opts.stripeSessionId ?? null,
    },
    { submissionId, status: opts.status },
  );
}

/** Route-friendly wrapper around recordEmailAttempt (stable idempotency keys). */
export async function logEmailAttempt(opts: {
  submissionId: string;
  route: string;
  kind: "admin" | "participant" | "other";
  recipients: string[];
  subject: string;
  status: "sent" | "failed";
  brevoMessageId?: string;
  brevoStatusCode?: number;
  failureReason?: string;
  idempotencyKey: string;
  programSlug?: string;
  stripeSessionId?: string;
}): Promise<void> {
  const recipientRole =
    opts.kind === "admin" ? "admin" : ("applicant" as const);
  await recordEmailAttempt(opts.submissionId, {
    route: opts.route,
    recipientRole,
    recipients: opts.recipients,
    subject: opts.subject,
    status: opts.status,
    brevoMessageId: opts.brevoMessageId,
    brevoStatusCode: opts.brevoStatusCode,
    error: opts.failureReason,
    programSlug: opts.programSlug,
    stripeSessionId: opts.stripeSessionId,
    idempotencyKey: opts.idempotencyKey,
  });
}

export async function linkStripeCheckoutSession(
  submissionId: string,
  sessionId: string,
): Promise<void> {
  await callSchoolHub(
    "linkStripeCheckoutSession",
    {
      op: "update_status",
      submission_id: submissionId,
      workflow_status: "checkout_created" as WorkflowStatus,
      stripe_checkout_session_id: sessionId,
    },
    { submissionId, sessionId },
  );
}

export async function confirmStripePaymentBySession(
  sessionId: string,
  paymentIntentId?: string,
): Promise<string | null> {
  // This would require a query operation which the Edge Function doesn't support yet
  // For now, we'll need to pass submission_id from Stripe metadata
  apiLog("warn", "confirmStripePaymentBySession", "query_not_supported", {
    sessionId,
    message: "Edge Function doesn't support queries yet. Pass submission_id in Stripe metadata instead.",
  });
  return null;
}

export async function markSubmissionPaid(
  submissionId: string,
  opts: { sessionId?: string; paymentIntentId?: string; customerId?: string },
): Promise<void> {
  const now = new Date().toISOString();
  await callSchoolHub(
    "markSubmissionPaid",
    {
      op: "update_status",
      submission_id: submissionId,
      workflow_status: "paid" as WorkflowStatus,
      person_kind: "enrolled" as PersonKind,
      ...(opts.sessionId ? { stripe_checkout_session_id: opts.sessionId } : {}),
      ...(opts.paymentIntentId ? { stripe_payment_intent_id: opts.paymentIntentId } : {}),
      ...(opts.customerId ? { stripe_customer_id: opts.customerId } : {}),
    },
    { submissionId, ...opts },
  );
}

// ============================================================================
// UTILITIES
// ============================================================================

export function isSupabaseConfigured(): boolean {
  return getEndpointConfig() !== null;
}

export function getIdempotencyKey(request: Request): string | null {
  const fromHeader = request.headers.get("x-idempotency-key")?.trim();
  if (fromHeader && fromHeader.length <= 128) return fromHeader;
  return null;
}

export function redactEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 1) return "***";
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

export function bucketForFlow(flow: SubmissionFlow): StorageBucket {
  switch (flow) {
    case "wire_proof":
    case "register":
      return "website-wire-proofs";
    case "fiscal_preflight":
      return "website-fiscal-documents";
    default:
      return "website-applications";
  }
}
