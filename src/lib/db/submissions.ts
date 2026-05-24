import { createHash, randomUUID } from "node:crypto";
import { apiLog } from "@lib/server/apiRequestLog";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabaseAdminClient";
import type {
  CreateSubmissionInput,
  StorageBucket,
  SubmissionEventType,
  SubmissionFlow,
  UploadedFileInput,
  WireReviewStatus,
  WorkflowStatus,
} from "./types";

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

export type PersistSubmissionResult =
  | { ok: true; submissionId: string; duplicate?: boolean }
  | { ok: false; reason: "not_configured" | "db_error"; error?: string };

export async function persistSubmission(
  input: CreateSubmissionInput,
  logRoute: string,
): Promise<PersistSubmissionResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { ok: false, reason: "not_configured" };
  }

  const now = new Date().toISOString();
  const row = {
    request_id: input.requestId,
    idempotency_key: input.idempotencyKey ?? null,
    flow: input.flow,
    person_kind: input.personKind,
    workflow_status: input.workflowStatus ?? "received",
    wire_review_status: input.wireReviewStatus ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    program_slug: input.programSlug ?? null,
    program_title: input.programTitle ?? null,
    payload: input.payload,
    api_route: input.apiRoute,
    received_at: now,
  };

  if (input.idempotencyKey) {
    const { data: existing } = await supabase
      .from("website_submissions")
      .select("id")
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();

    if (existing?.id) {
      return { ok: true, submissionId: existing.id, duplicate: true };
    }
  }

  const { data, error } = await supabase
    .from("website_submissions")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505" && input.idempotencyKey) {
      const { data: dup } = await supabase
        .from("website_submissions")
        .select("id")
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle();
      if (dup?.id) return { ok: true, submissionId: dup.id, duplicate: true };
    }
    apiLog("error", logRoute, "submission_insert_failed", {
      requestId: input.requestId,
      code: error.code,
      message: error.message,
    });
    return { ok: false, reason: "db_error", error: error.message };
  }

  const submissionId = data.id as string;
  await appendSubmissionEvent(submissionId, "submission_received", {
    requestId: input.requestId,
    flow: input.flow,
  });

  return { ok: true, submissionId };
}

export async function appendSubmissionEvent(
  submissionId: string,
  eventType: SubmissionEventType,
  payload: Record<string, unknown> = {},
  actorType: "system" | "applicant" | "admin" | "stripe_webhook" = "system",
  actorId?: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase.from("submission_events").insert({
    submission_id: submissionId,
    event_type: eventType,
    actor_type: actorType,
    actor_id: actorId ?? null,
    payload,
  });
}

export async function uploadSubmissionFiles(
  submissionId: string,
  files: UploadedFileInput[],
  bucket: StorageBucket,
  logRoute: string,
): Promise<{ ok: boolean; count: number }> {
  const supabase = getSupabaseAdmin();
  if (!supabase || files.length === 0) return { ok: true, count: 0 };

  let uploaded = 0;
  for (const file of files) {
    const fileId = randomUUID();
    const objectKey = `${submissionId}/${fileId}-${file.filename}`;

    const { error: storageError } = await supabase.storage
      .from(bucket)
      .upload(objectKey, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (storageError) {
      apiLog("error", logRoute, "submission_file_upload_failed", {
        submissionId,
        field: file.fieldname,
        message: storageError.message,
      });
      continue;
    }

    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    const { error: metaError } = await supabase.from("website_submission_files").insert({
      submission_id: submissionId,
      field_name: file.fieldname,
      original_filename: file.filename,
      mime_type: file.mimetype,
      byte_size: file.buffer.length,
      storage_provider: "supabase",
      storage_bucket: bucket,
      object_key: objectKey,
      sha256,
    });

    if (!metaError) uploaded += 1;
  }

  if (uploaded > 0) {
    await appendSubmissionEvent(submissionId, "files_uploaded", { count: uploaded });
  }

  return { ok: uploaded === files.length, count: uploaded };
}

export async function recordEmailAttempt(
  submissionId: string,
  opts: {
    recipientRole: "admin" | "applicant";
    toEmail: string;
    subject: string;
    status: "sent" | "failed";
    error?: string;
    brevoMessageId?: string;
  },
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase.from("outbound_email_attempts").insert({
    submission_id: submissionId,
    provider: "brevo",
    subject: opts.subject.slice(0, 500),
    recipient_role: opts.recipientRole,
    to_redacted: redactEmail(opts.toEmail),
    status: opts.status,
    error: opts.error ?? null,
    brevo_message_id: opts.brevoMessageId ?? null,
  });

  await appendSubmissionEvent(
    submissionId,
    opts.status === "sent" ? "email_sent" : "email_failed",
    { recipientRole: opts.recipientRole },
  );
}

export async function linkStripeCheckoutSession(
  submissionId: string,
  sessionId: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase
    .from("website_submissions")
    .update({
      stripe_checkout_session_id: sessionId,
      workflow_status: "checkout_created" satisfies WorkflowStatus,
    })
    .eq("id", submissionId);

  await appendSubmissionEvent(submissionId, "checkout_created", { sessionId });
}

export async function confirmStripePaymentBySession(
  sessionId: string,
  paymentIntentId?: string,
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data } = await supabase
    .from("website_submissions")
    .select("id, workflow_status")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();

  if (data?.id) {
    if (data.workflow_status !== "paid") {
      await markSubmissionPaid(data.id as string, { sessionId, paymentIntentId });
    }
    return data.id as string;
  }
  return null;
}

export async function markSubmissionPaid(
  submissionId: string,
  opts: { sessionId?: string; paymentIntentId?: string },
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const now = new Date().toISOString();
  await supabase
    .from("website_submissions")
    .update({
      workflow_status: "paid",
      person_kind: "enrolled",
      paid_at: now,
      ...(opts.sessionId ? { stripe_checkout_session_id: opts.sessionId } : {}),
      ...(opts.paymentIntentId ? { stripe_payment_intent_id: opts.paymentIntentId } : {}),
    })
    .eq("id", submissionId);

  await appendSubmissionEvent(submissionId, "payment_confirmed", opts);
}

export { isSupabaseConfigured };
