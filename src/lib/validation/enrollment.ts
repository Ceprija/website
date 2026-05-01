/**
 * Shared server-side validation for enrollment / checkout / wire flows.
 */

export const MODALITY_PRESENCIAL = "Presencial" as const;
export const MODALITY_ONLINE = "En línea" as const;
export type Modality = typeof MODALITY_PRESENCIAL | typeof MODALITY_ONLINE;

export const PROGRAM_SLUG_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$/;
export const STRIPE_PRICE_ID_RE = /^price_[a-zA-Z0-9]+$/;
/**
 * Stripe Checkout Session id: cs_live_* / cs_test_*.
 * Suffix allows short test mocks (e.g. Stripe CLI) while rejecting obvious garbage.
 */
export const STRIPE_CHECKOUT_SESSION_ID_RE = /^cs_(live|test)_[A-Za-z0-9_]{6,256}$/;
const STRIPE_SESSION_ID_MIN_LEN = 14;
const STRIPE_SESSION_ID_MAX_LEN = 280;

const MAX_EMAIL_LEN = 254;
const MAX_NAME_LEN = 200;
const MAX_PHONE_LEN = 40;
const MAX_MESSAGE_LEN = 5000;
const MAX_PROGRAM_TITLE_LEN = 500;
const MAX_CURP_LEN = 20;

// Practical RFC 5322–oriented pattern (not full RFC); rejects obvious junk.
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export type FieldError = { field?: string; code: string; error: string };

export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function isValidPhone(phone: string): boolean {
  const d = normalizePhoneDigits(phone);
  return d.length >= 10 && d.length <= 15 && phone.length <= MAX_PHONE_LEN;
}

export function validateEmail(email: string): FieldError | null {
  const t = email.trim();
  if (!t) return { field: "email", code: "invalid_email", error: "Correo no válido" };
  if (t.length > MAX_EMAIL_LEN)
    return { field: "email", code: "invalid_email", error: "Correo demasiado largo" };
  if (!EMAIL_RE.test(t))
    return { field: "email", code: "invalid_email", error: "Formato de correo no válido" };
  return null;
}

export function validateOptionalEmail(email: string): FieldError | null {
  const t = email.trim();
  if (!t) return null;
  return validateEmail(t);
}

export function validateParticipantName(name: string, field = "participantName"): FieldError | null {
  const t = name.trim();
  if (!t) return { field, code: "invalid_name", error: "Nombre requerido" };
  if (t.length > MAX_NAME_LEN)
    return { field, code: "invalid_name", error: "Nombre demasiado largo" };
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(t))
    return { field, code: "invalid_name", error: "Nombre contiene caracteres no permitidos" };
  return null;
}

export function validateProgramSlug(programSlug: string): FieldError | null {
  const t = programSlug.trim();
  if (!t) return { field: "programSlug", code: "invalid_program", error: "Programa requerido" };
  if (!PROGRAM_SLUG_RE.test(t) || t.length > 200)
    return { field: "programSlug", code: "invalid_program", error: "Programa no válido" };
  return null;
}

export function validateModalityStrict(modality: string): FieldError | null {
  const t = modality.trim();
  if (t !== MODALITY_PRESENCIAL && t !== MODALITY_ONLINE)
    return { field: "modality", code: "invalid_modality", error: "Modalidad no válida" };
  return null;
}

/** Maps legacy / UI variants to canonical modality for wire forms. */
export function normalizeWireModality(modality: string): Modality | null {
  const raw = modality.trim();
  if (!raw) return null;
  const m = raw.toLowerCase();
  if (m.includes("línea") || m.includes("linea") || m.includes("online")) return MODALITY_ONLINE;
  if (
    m.includes("virtual") ||
    m.includes("remoto") ||
    m.includes("remote") ||
    m.includes("videoconferencia") ||
    m.includes("videollamada") ||
    m.includes("distancia") ||
    m.includes("zoom") ||
    m.includes("meet")
  ) {
    return MODALITY_ONLINE;
  }
  if (m.includes("presencial") || m.includes("en aula") || m.includes("en sala")) {
    return MODALITY_PRESENCIAL;
  }
  if (raw === MODALITY_ONLINE) return MODALITY_ONLINE;
  if (raw === MODALITY_PRESENCIAL) return MODALITY_PRESENCIAL;
  return null;
}

export function validateStripePriceId(priceId: string): FieldError | null {
  const t = priceId.trim();
  if (!t) return { field: "priceId", code: "invalid_price_id", error: "Precio requerido" };
  if (!STRIPE_PRICE_ID_RE.test(t) || /PLACEHOLDER|REPLACE/i.test(t))
    return { field: "priceId", code: "invalid_price_id", error: "ID de precio no válido" };
  return null;
}

export function validateStripeCheckoutSessionId(sessionId: string): FieldError | null {
  const t = sessionId.trim();
  if (!t)
    return { field: "stripeSessionId", code: "missing_session", error: "Falta stripeSessionId" };
  if (
    !STRIPE_CHECKOUT_SESSION_ID_RE.test(t) ||
    t.length < STRIPE_SESSION_ID_MIN_LEN ||
    t.length > STRIPE_SESSION_ID_MAX_LEN
  )
    return {
      field: "stripeSessionId",
      code: "invalid_session",
      error: "Identificador de sesión no válido",
    };
  return null;
}

const APPLICATION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CheckoutSessionBody = {
  priceId: string;
  programSlug: string;
  customerEmail: string;
  participantName: string;
  participantPhone: string;
  modality: Modality;
  /** Optional: links Stripe payment to a prior `/api/enrollment` submission */
  applicationId?: string;
  /** Facturación (metadata en Stripe; CSF vía `/api/stripe/fiscal-preflight` si aplica) */
  requiresInvoice: "Sí" | "No";
  invoiceEmail: string;
};

export function parseCheckoutSessionBody(
  body: Record<string, unknown> | null,
): { ok: true; data: CheckoutSessionBody } | { ok: false; err: FieldError } {
  if (!body || typeof body !== "object")
    return { ok: false, err: { code: "missing_fields", error: "Cuerpo inválido" } };

  const priceId = typeof body.priceId === "string" ? body.priceId.trim() : "";
  const programSlug = typeof body.programSlug === "string" ? body.programSlug.trim() : "";
  const customerEmail =
    typeof body.customerEmail === "string" ? body.customerEmail.trim() : "";
  const participantName =
    typeof body.participantName === "string" ? body.participantName.trim() : "";
  const participantPhone =
    typeof body.participantPhone === "string" ? body.participantPhone.trim() : "";
  const modalityRaw = typeof body.modality === "string" ? body.modality.trim() : "";
  const applicationIdRaw =
    typeof body.applicationId === "string" ? body.applicationId.trim() : "";
  const requiresInvoiceRaw =
    typeof body.requiresInvoice === "string" ? body.requiresInvoice.trim() : "";
  const invoiceEmailRaw =
    typeof body.invoiceEmail === "string" ? body.invoiceEmail.trim() : "";

  if (!priceId || !programSlug || !participantName || !participantPhone || !modalityRaw) {
    return { ok: false, err: { code: "missing_fields", error: "Faltan campos requeridos" } };
  }

  const requiresInvoiceNorm = requiresInvoiceRaw || "No";
  if (requiresInvoiceNorm !== "Sí" && requiresInvoiceNorm !== "No") {
    return {
      ok: false,
      err: {
        field: "requiresInvoice",
        code: "invalid_invoice_flag",
        error: "Valor de factura no válido",
      },
    };
  }
  const requiresInvoice = requiresInvoiceNorm as "Sí" | "No";
  let invoiceEmail = invoiceEmailRaw;
  if (requiresInvoice === "Sí") {
    if (!invoiceEmail) {
      return {
        ok: false,
        err: {
          field: "invoiceEmail",
          code: "missing_fields",
          error: "Falta correo para factura",
        },
      };
    }
    const invErr = validateEmail(invoiceEmail);
    if (invErr)
      return {
        ok: false,
        err: { field: "invoiceEmail", code: invErr.code, error: invErr.error },
      };
  } else {
    invoiceEmail = "";
  }

  let applicationId: string | undefined;
  if (applicationIdRaw) {
    if (!APPLICATION_ID_RE.test(applicationIdRaw))
      return {
        ok: false,
        err: {
          field: "applicationId",
          code: "invalid_application_id",
          error: "Identificador de solicitud no válido",
        },
      };
    applicationId = applicationIdRaw;
  }

  let e = validateStripePriceId(priceId);
  if (e) return { ok: false, err: e };
  e = validateProgramSlug(programSlug);
  if (e) return { ok: false, err: e };
  e = validateModalityStrict(modalityRaw);
  if (e) return { ok: false, err: e };
  e = validateParticipantName(participantName, "participantName");
  if (e) return { ok: false, err: e };
  if (!isValidPhone(participantPhone)) {
    return {
      ok: false,
      err: {
        field: "participantPhone",
        code: "invalid_phone",
        error: "Teléfono no válido (10–15 dígitos)",
      },
    };
  }
  e = validateOptionalEmail(customerEmail);
  if (e) return { ok: false, err: { ...e, field: "customerEmail" } };

  return {
    ok: true,
    data: {
      priceId,
      programSlug,
      customerEmail,
      participantName,
      participantPhone,
      modality: modalityRaw as Modality,
      requiresInvoice,
      invoiceEmail,
      ...(applicationId ? { applicationId } : {}),
    },
  };
}

/** Multipart preflight: CSF antes de Checkout Stripe (`/api/stripe/fiscal-preflight`) */
export function validateStripeFiscalPreflightFields(
  fields: Record<string, string>,
): FieldError | null {
  const invoiceEmail = (fields.invoiceEmail ?? "").trim();
  const programSlug = (fields.programSlug ?? "").trim();
  const programTitle = (fields.programTitle ?? "").trim();
  const participantName = (fields.participantName ?? "").trim();
  const participantPhone = (fields.participantPhone ?? "").trim();
  const modalityRaw = (fields.modality ?? "").trim();
  const customerEmail = (fields.customerEmail ?? "").trim();
  const applicationIdRaw = (fields.applicationId ?? "").trim();

  {
    const ie = validateEmail(invoiceEmail);
    if (ie)
      return { field: "invoiceEmail", code: ie.code, error: ie.error };
  }
  let e = validateProgramSlug(programSlug);
  if (e) return e;
  if (programTitle.length > MAX_PROGRAM_TITLE_LEN)
    return { field: "programTitle", code: "invalid_program", error: "Programa no válido" };
  e = validateParticipantName(participantName, "participantName");
  if (e) return e;
  if (!isValidPhone(participantPhone))
    return { field: "participantPhone", code: "invalid_phone", error: "Teléfono no válido" };
  {
    const mErr = validateModalityStrict(modalityRaw);
    if (mErr) return mErr;
  }
  if (customerEmail) {
    const ce = validateOptionalEmail(customerEmail);
    if (ce)
      return { field: "customerEmail", code: ce.code, error: ce.error };
  }
  if (applicationIdRaw && !APPLICATION_ID_RE.test(applicationIdRaw)) {
    return {
      field: "applicationId",
      code: "invalid_application_id",
      error: "Identificador de solicitud no válido",
    };
  }
  return null;
}

/** Legacy register / contact wire form */
export type WireRegisterFields = {
  name: string;
  email: string;
  phone: string;
  message: string;
  program: string;
  type: string;
  modality: Modality;
};

export function parseWireRegisterFields(
  fields: Record<string, string>,
): { ok: true; data: WireRegisterFields } | { ok: false; err: FieldError } {
  const name = (fields.name ?? "").trim();
  const email = (fields.email ?? "").trim();
  const phone = (fields.phone ?? "").trim();
  const message = (fields.message ?? "").trim();
  const program = (fields.program ?? "").trim();
  const type = (fields.type ?? "").trim();
  const modalityRaw = (fields.modality ?? "").trim();

  if (!name) return { ok: false, err: { field: "name", code: "missing_fields", error: "Falta nombre" } };
  let e = validateParticipantName(name, "name");
  if (e) return { ok: false, err: e };
  e = validateEmail(email);
  if (e) return { ok: false, err: e };
  if (!isValidPhone(phone))
    return { ok: false, err: { field: "phone", code: "invalid_phone", error: "Teléfono no válido" } };
  if (message.length > MAX_MESSAGE_LEN)
    return {
      ok: false,
      err: { field: "message", code: "invalid_message", error: "Mensaje demasiado largo" },
    };
  if (program.length > MAX_PROGRAM_TITLE_LEN)
    return {
      ok: false,
      err: { field: "program", code: "invalid_program", error: "Programa no válido" },
    };

  if (type !== "registration" && type !== "contact")
    return { ok: false, err: { field: "type", code: "invalid_type", error: "Tipo de formulario no válido" } };

  let modality: Modality | null = normalizeWireModality(modalityRaw);
  if (type === "registration") {
    if (!modality) {
      return { ok: false, err: { field: "modality", code: "invalid_modality", error: "Modalidad no válida" } };
    }
  } else {
    modality = modality ?? MODALITY_PRESENCIAL;
  }

  return { ok: true, data: { name, email, phone, message, program, type, modality } };
}

/** Full program inscription (CSV + documents) — core identity fields */
export function validateInscriptionIdentity(fields: Record<string, string>): FieldError | null {
  const nombre = (fields.nombre ?? "").trim();
  const apellidos = (fields.apellidos ?? "").trim();
  const email = (fields.email ?? "").trim();
  const telefono = (fields.telefono ?? "").trim();
  const programTitle = (fields.programTitle ?? "").trim();

  if (!programTitle)
    return { field: "programTitle", code: "missing_fields", error: "Falta el programa" };
  if (programTitle.length > MAX_PROGRAM_TITLE_LEN)
    return { field: "programTitle", code: "invalid_program", error: "Programa no válido" };

  let e = validateParticipantName(nombre, "nombre");
  if (e) return e;
  e = validateParticipantName(apellidos, "apellidos");
  if (e) return e;
  e = validateEmail(email);
  if (e) return e;
  if (!isValidPhone(telefono))
    return { field: "telefono", code: "invalid_phone", error: "Teléfono no válido" };

  const curp = (fields.curp ?? "").trim();
  if (curp.length > MAX_CURP_LEN)
    return { field: "curp", code: "invalid_curp", error: "CURP no válido" };

  return null;
}

const MAX_WIRE_REFERENCE_LEN = 80;
const MAX_PROGRAM_ID_LEN = 200;

/** Wire transfer proof upload (`/api/payments/wire-proof`) */
export function validateWireProofFields(fields: Record<string, string>): FieldError | null {
  const name = (fields.name ?? "").trim();
  const email = (fields.email ?? "").trim();
  const phone = (fields.phone ?? "").trim();
  const programTitle = (fields.programTitle ?? "").trim();
  const programId = (fields.programId ?? "").trim();
  const modalityRaw = (fields.modality ?? "").trim();
  const wireReference = (fields.wireReference ?? "").trim();
  const requiresInvoiceRaw = (fields.requiresInvoice ?? "").trim();
  const invoiceEmail = (fields.invoiceEmail ?? "").trim();
  const applicationIdRaw = (fields.applicationId ?? "").trim();

  let err = validateParticipantName(name, "name");
  if (err) return err;
  err = validateEmail(email);
  if (err) return err;
  if (!isValidPhone(phone))
    return { field: "phone", code: "invalid_phone", error: "Teléfono no válido" };

  if (!programTitle && !programId) {
    return {
      field: "programTitle",
      code: "missing_fields",
      error: "Falta programa o identificador",
    };
  }
  if (programTitle.length > MAX_PROGRAM_TITLE_LEN)
    return { field: "programTitle", code: "invalid_program", error: "Programa no válido" };
  if (programId.length > MAX_PROGRAM_ID_LEN)
    return { field: "programId", code: "invalid_program", error: "Identificador no válido" };

  if (!normalizeWireModality(modalityRaw)) {
    return { field: "modality", code: "invalid_modality", error: "Modalidad no válida" };
  }

  if (wireReference.length > MAX_WIRE_REFERENCE_LEN) {
    return {
      field: "wireReference",
      code: "invalid_reference",
      error: "Referencia demasiado larga",
    };
  }

  const requiresInvoice = requiresInvoiceRaw || "No";
  if (requiresInvoice !== "Sí" && requiresInvoice !== "No") {
    return {
      field: "requiresInvoice",
      code: "invalid_invoice_flag",
      error: "Valor de factura no válido",
    };
  }
  if (requiresInvoice === "Sí") {
    if (!invoiceEmail)
      return {
        field: "invoiceEmail",
        code: "missing_fields",
        error: "Falta correo para factura",
      };
    err = validateEmail(invoiceEmail);
    if (err) return { ...err, field: "invoiceEmail" };
  }

  if (applicationIdRaw) {
    if (!APPLICATION_ID_RE.test(applicationIdRaw)) {
      return {
        field: "applicationId",
        code: "invalid_application_id",
        error: "Identificador de solicitud no válido",
      };
    }
  }

  return null;
}

/** Educación continua inscription */
export function validateEducacionContinuaFields(fields: Record<string, string>): FieldError | null {
  const name = (fields.name ?? "").trim();
  const email = (fields.email ?? "").trim();
  const phone = (fields.phone ?? "").trim();
  const programTitle = (fields.programTitle ?? "").trim();
  const programId = (fields.programId ?? "").trim();
  const modalityRaw = (fields.modality ?? "").trim();
  const requiresInvoice = (fields.requiresInvoice ?? "").trim();
  const invoiceEmail = (fields.invoiceEmail ?? "").trim();

  if (!name) return { field: "name", code: "missing_fields", error: "Falta nombre" };
  let e = validateParticipantName(name, "name");
  if (e) return e;
  e = validateEmail(email);
  if (e) return e;
  if (!isValidPhone(phone))
    return { field: "phone", code: "invalid_phone", error: "Teléfono no válido" };
  if (!programTitle || programTitle.length > MAX_PROGRAM_TITLE_LEN)
    return { field: "programTitle", code: "invalid_program", error: "Programa no válido" };
  if (!programId || programId.length > MAX_PROGRAM_ID_LEN || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(programId))
    return { field: "programId", code: "invalid_program", error: "Identificador de programa no válido" };

  const modality = normalizeWireModality(modalityRaw);
  if (!modality)
    return { field: "modality", code: "invalid_modality", error: "Modalidad no válida" };

  if (requiresInvoice !== "Sí" && requiresInvoice !== "No")
    return {
      field: "requiresInvoice",
      code: "invalid_invoice_flag",
      error: "Valor de factura no válido",
    };

  if (requiresInvoice === "Sí") {
    if (!invoiceEmail) return { field: "invoiceEmail", code: "missing_fields", error: "Falta email de factura" };
    e = validateEmail(invoiceEmail);
    if (e) return { ...e, field: "invoiceEmail" };
  }

  return null;
}
