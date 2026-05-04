/**
 * Shared server-side validation for enrollment / checkout / wire flows.
 */

import { MAX_PERSON_NAME_PART_LEN, TEXT_MAX_LENGTH_BY_NAME, DEFAULT_TEXT_MAX_LENGTH } from "@lib/validation/formFieldLimits";
import { isValidPhone } from "@lib/validation/phone";

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
const MAX_MESSAGE_LEN = 2000;
const MAX_PROGRAM_TITLE_LEN = 500;
// Practical RFC 5322–oriented pattern (not full RFC); rejects obvious junk.
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export type FieldError = { field?: string; code: string; error: string };

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

export function validateParticipantName(
  name: string,
  field = "participantName",
  maxLen: number = MAX_NAME_LEN,
): FieldError | null {
  const t = name.trim();
  if (!t) return { field, code: "invalid_name", error: "Nombre requerido" };
  if (t.length > maxLen)
    return {
      field,
      code: "invalid_name",
      error: `Nombre demasiado largo (máx. ${maxLen} caracteres)`,
    };
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
  /** Optional variant selections (only for programs with `variantOptions`) */
  selectedModule?: string;
  selectedDate?: string;
};

const VARIANT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/;

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
  const selectedModuleRaw =
    typeof body.selectedModule === "string" ? body.selectedModule.trim() : "";
  const selectedDateRaw =
    typeof body.selectedDate === "string" ? body.selectedDate.trim() : "";

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

  // Variant IDs are opaque tokens chosen in the program's MD file. We don't
  // know the catalogue from this generic validator, so we just enforce a safe
  // shape and length to keep Stripe metadata predictable.
  let selectedModule: string | undefined;
  if (selectedModuleRaw) {
    if (!VARIANT_ID_RE.test(selectedModuleRaw)) {
      return {
        ok: false,
        err: {
          field: "selectedModule",
          code: "invalid_variant_module",
          error: "Opción de módulo no válida",
        },
      };
    }
    selectedModule = selectedModuleRaw;
  }
  let selectedDate: string | undefined;
  if (selectedDateRaw) {
    if (!VARIANT_ID_RE.test(selectedDateRaw)) {
      return {
        ok: false,
        err: {
          field: "selectedDate",
          code: "invalid_variant_date",
          error: "Fecha de inicio no válida",
        },
      };
    }
    selectedDate = selectedDateRaw;
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
        error: "Teléfono no válido (10 dígitos en México o +52 / 521…)",
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
      ...(selectedModule ? { selectedModule } : {}),
      ...(selectedDate ? { selectedDate } : {}),
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
    return {
      field: "participantPhone",
      code: "invalid_phone",
      error: "Teléfono no válido (10 dígitos en México o +52 / 521…)",
    };
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
    return {
      ok: false,
      err: { field: "phone", code: "invalid_phone", error: "Teléfono no válido (10 dígitos en México o +52 / 521…)" },
    };
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

  let e = validateParticipantName(nombre, "nombre", MAX_PERSON_NAME_PART_LEN);
  if (e) return e;
  e = validateParticipantName(apellidos, "apellidos", MAX_PERSON_NAME_PART_LEN);
  if (e) return e;
  e = validateEmail(email);
  if (e) return e;
  if (!isValidPhone(telefono))
    return {
      field: "telefono",
      code: "invalid_phone",
      error: "Teléfono no válido (10 dígitos en México o +52 / 521…)",
    };

  const curp = (fields.curp ?? "").trim();
  if (curp.length !== 18)
    return { field: "curp", code: "invalid_curp", error: "La CURP debe tener 18 caracteres" };

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
    return {
      field: "phone",
      code: "invalid_phone",
      error: "Teléfono no válido (10 dígitos en México o +52 / 521…)",
    };

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
    return {
      field: "phone",
      code: "invalid_phone",
      error: "Teléfono no válido (10 dígitos en México o +52 / 521…)",
    };
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

/** Solicitud de admisión (`/api/enrollment`) — formato tras comprobar campos obligatorios. */
export function validateEnrollmentApplicationFields(
  fields: Record<string, string>,
): FieldError | null {
  const nombre = (fields.nombre ?? "").trim();
  const apellidos = (fields.apellidos ?? "").trim();
  const email = (fields.email ?? "").trim();
  const telefono = (fields.telefono ?? "").trim();
  const carrera = (fields.carrera ?? "").trim();
  const institucion = (fields.institucion ?? "").trim();
  const cedulaNum = (fields.cedulaNum ?? "").trim();

  let err = validateParticipantName(nombre, "nombre", MAX_PERSON_NAME_PART_LEN);
  if (err) return err;
  err = validateParticipantName(apellidos, "apellidos", MAX_PERSON_NAME_PART_LEN);
  if (err) return err;
  err = validateEmail(email);
  if (err) return err;
  if (!isValidPhone(telefono))
    return {
      field: "telefono",
      code: "invalid_phone",
      error: "Teléfono no válido (10 dígitos en México o +52 / 521…)",
    };
  if (carrera.length > 150)
    return { field: "carrera", code: "invalid_field", error: "Carrera: máximo 150 caracteres" };
  if (institucion.length > 150)
    return {
      field: "institucion",
      code: "invalid_field",
      error: "Institución: máximo 150 caracteres",
    };
  if (cedulaNum.length > 20)
    return { field: "cedulaNum", code: "invalid_field", error: "Cédula: máximo 20 caracteres" };
  return null;
}

/** Validación de campos completos del expediente (full dossier) para enrollment */
export function validateFullDossierFields(fields: Record<string, string>): FieldError | null {
  // CP: 5 dígitos
  const cp = (fields.cp || "").trim();
  if (cp && !/^\d{5}$/.test(cp)) {
    return { error: "Código postal debe ser 5 dígitos", code: "invalid_cp", field: "cp" };
  }
  
  // CURP: 18 caracteres exactos
  const curp = (fields.curp || "").trim();
  if (curp && curp.length !== 18) {
    return { error: "CURP debe tener 18 caracteres", code: "invalid_curp", field: "curp" };
  }
  
  // telEmergencia: validar solo si no está vacío
  const telEmergencia = (fields.telEmergencia || "").trim();
  if (telEmergencia && !isValidPhone(telEmergencia)) {
    return { 
      error: "Teléfono de emergencia inválido (10 dígitos MX)", 
      code: "invalid_tel_emergencia", 
      field: "telEmergencia" 
    };
  }
  
  // Validar límites de texto según formFieldLimits
  const textFields = [
    "calle", "colonia", "ciudad", "genero", "nacionalidad", "estadoCivil",
    "detalleCapacidad", "detalleEnf", "detalleAlergia", "detalleTratamiento",
    "contactoEmergencia", "ocupacion"
  ];
  
  for (const fieldName of textFields) {
    const value = (fields[fieldName] || "").trim();
    if (!value) continue; // Skip empty optional fields
    
    const maxLen = TEXT_MAX_LENGTH_BY_NAME[fieldName] || DEFAULT_TEXT_MAX_LENGTH;
    if (value.length > maxLen) {
      return { 
        error: `${fieldName} excede ${maxLen} caracteres`, 
        code: "text_too_long", 
        field: fieldName 
      };
    }
    
    // Rechazar caracteres de control (excepto espacios/tabs/newlines normales)
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value)) {
      return { 
        error: `${fieldName} contiene caracteres no permitidos`, 
        code: "invalid_characters", 
        field: fieldName 
      };
    }
  }
  
  return null;
}
