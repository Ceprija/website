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
  | "potential_student"
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
  | "website-fiscal-documents";

export type SubmissionEventType =
  | "submission_received"
  | "files_uploaded"
  | "email_sent"
  | "email_failed"
  | "checkout_created"
  | "payment_confirmed"
  | "wire_approved"
  | "wire_rejected"
  | "laravel_mirror_failed"
  | "workflow_updated";

export type UploadedFileInput = {
  fieldname: string;
  buffer: Buffer;
  filename: string;
  mimetype: string;
};

export type CreateSubmissionInput = {
  requestId: string;
  idempotencyKey?: string | null;
  flow: SubmissionFlow;
  personKind: PersonKind;
  workflowStatus?: WorkflowStatus;
  wireReviewStatus?: WireReviewStatus | null;
  email?: string | null;
  phone?: string | null;
  programSlug?: string | null;
  programTitle?: string | null;
  apiRoute: string;
  payload: Record<string, unknown>;
};
