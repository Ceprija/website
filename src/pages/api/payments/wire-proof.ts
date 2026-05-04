export const prerender = false;

import type { APIRoute } from "astro";
import { EMAIL_CONTROL_ESCOLAR, EMAIL_SOPORTE_WEB, KEY_API_BREVO } from "astro:env/server";
import Busboy from "busboy";
import crypto from "node:crypto";
import { escapeHtml } from "@lib/htmlEscape";
import {
  MAX_FILES_PER_REQUEST,
  MAX_UPLOAD_BYTES,
  validateUploadBuffer,
} from "@lib/uploads/fileValidation";
import { validateWireProofFields } from "@lib/validation/enrollment";
import { apiLog, getRequestId, jsonResponse } from "@lib/server/apiRequestLog";

type UploadedFile = {
  fieldname: string;
  buffer: Buffer;
  filename: string;
  mimetype: string;
};

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function parseFormData(request: Request) {
  return new Promise<{ fields: Record<string, string>; files: UploadedFile[] }>(
    (resolve, reject) => {
      const busboy = Busboy({
        headers: Object.fromEntries(request.headers.entries()),
      });
      const fields: Record<string, string> = {};
      const files: UploadedFile[] = [];
      const filePromises: Promise<void>[] = [];

      busboy.on("field", (fieldname, value) => {
        fields[fieldname] = value;
      });

      busboy.on("file", (fieldname, file, info) => {
        const { filename, mimeType } = info;
        if (!filename) {
          file.resume();
          return;
        }

        const mimeNorm = (mimeType ?? "").split(";")[0].trim().toLowerCase();
        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, "-")
          .slice(0, 19);
        const userName = fields.name || "usuario";
        const sanitizedName = sanitizeFilename(userName);
        const ext = filename.split(".").pop() || "file";
        const newFilename = `${fieldname}_${sanitizedName}_${timestamp}.${ext}`;

        const p = new Promise<void>((fResolve, fReject) => {
          const chunks: Buffer[] = [];
          let total = 0;
          file.on("data", (data: Buffer) => {
            total += data.length;
            if (total > MAX_UPLOAD_BYTES) {
              file.resume();
              fReject(
                Object.assign(new Error("FILE_TOO_LARGE"), {
                  code: "file_too_large",
                  field: fieldname,
                }),
              );
              return;
            }
            chunks.push(data);
          });
          file.on("end", () => {
            files.push({
              fieldname,
              buffer: Buffer.concat(chunks),
              filename: newFilename,
              mimetype: mimeNorm,
            });
            fResolve();
          });
          file.on("error", fReject);
        });
        filePromises.push(p);
      });

      busboy.on("finish", () => {
        void Promise.all(filePromises)
          .then(() => resolve({ fields, files }))
          .catch(reject);
      });
      busboy.on("error", reject);

      if (!request.body) {
        reject(new Error("Empty request body"));
        return;
      }

      void request.body
        .pipeTo(
          new WritableStream({
            write(chunk) {
              busboy.write(chunk as Buffer);
            },
            close() {
              busboy.end();
            },
          }),
        )
        .catch(reject);
    },
  );
}

function toEmailList(...emails: Array<string | undefined | null>): Array<{ email: string }> {
  const uniq = new Set(
    emails.map((e) => (typeof e === "string" ? e.trim() : "")).filter(Boolean),
  );
  return [...uniq].map((email) => ({ email }));
}

export const POST: APIRoute = async ({ request }) => {
  const requestId = getRequestId(request);
  const route = "POST /api/payments/wire-proof";
  let programSlug = "";
  try {
    const { fields, files } = await parseFormData(request);
    const enrollmentId = crypto.randomUUID();

    const fieldErr = validateWireProofFields(fields);
    if (fieldErr) {
      programSlug = (fields.programId ?? "").trim();
      apiLog("warn", route, "validation_failed", {
        requestId,
        programSlug: programSlug || undefined,
        code: fieldErr.code,
        field: fieldErr.field,
      });
      return jsonResponse(
        {
          error: fieldErr.error,
          code: fieldErr.code,
          ...(fieldErr.field && { field: fieldErr.field }),
        },
        400,
        requestId,
      );
    }

    const name = (fields.name ?? "").trim();
    const email = (fields.email ?? "").trim();
    const phone = (fields.phone ?? "").trim();
    const programTitle = (fields.programTitle ?? "").trim();
    const programId = (fields.programId ?? "").trim();
    programSlug = programId;
    const modality = (fields.modality ?? "").trim();
    const wireReference = (fields.wireReference ?? "").trim();
    const requiresInvoice = ((fields.requiresInvoice ?? "").trim() || "No") === "Sí";
    const invoiceEmail = (fields.invoiceEmail ?? "").trim();
    const applicationIdField = (fields.applicationId ?? "").trim();

    if (files.length > MAX_FILES_PER_REQUEST) {
      apiLog("warn", route, "too_many_files", {
        requestId,
        programSlug: programSlug || undefined,
        code: "too_many_files",
      });
      return jsonResponse(
        {
          error: "Demasiados archivos adjuntos",
          code: "too_many_files",
        },
        400,
        requestId,
      );
    }

    const paymentProof = files.find((f) =>
      ["paymentProof", "comprobantePago", "comprobante_pago"].includes(f.fieldname),
    );

    if (!paymentProof) {
      apiLog("warn", route, "missing_payment_proof", {
        requestId,
        programSlug: programSlug || undefined,
        code: "missing_payment_proof",
      });
      return jsonResponse(
        {
          error: "Falta el comprobante de pago",
          code: "missing_payment_proof",
          missing: ["paymentProof"],
        },
        400,
        requestId,
      );
    }

    const fileCheck = validateUploadBuffer(paymentProof.buffer, paymentProof.mimetype, {
      field: paymentProof.fieldname,
    });
    if (!fileCheck.ok) {
      apiLog("warn", route, "upload_validation_failed", {
        requestId,
        programSlug: programSlug || undefined,
        code: fileCheck.err.code,
        field: fileCheck.err.field,
      });
      return jsonResponse(
        {
          error: fileCheck.err.error,
          code: fileCheck.err.code,
          ...(fileCheck.err.field && { field: fileCheck.err.field }),
        },
        400,
        requestId,
      );
    }

    const fiscalConstancy = files.find((f) =>
      ["fiscalConstancy", "rfcDocument", "csf"].includes(f.fieldname),
    );

    if (requiresInvoice) {
      if (!fiscalConstancy || fiscalConstancy.buffer.length === 0) {
        return new Response(
          JSON.stringify({
            error: "Falta la constancia de situación fiscal (CSF) o RFC",
            code: "missing_fiscal_constancy",
            field: "fiscalConstancy",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      const fiscalCheck = validateUploadBuffer(
        fiscalConstancy.buffer,
        fiscalConstancy.mimetype,
        { field: fiscalConstancy.fieldname },
      );
      if (!fiscalCheck.ok) {
        return new Response(
          JSON.stringify({
            error: fiscalCheck.err.error,
            code: fiscalCheck.err.code,
            ...(fiscalCheck.err.field && { field: fiscalCheck.err.field }),
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    const brevoKey = (KEY_API_BREVO ?? "").trim();
    const senderEmail =
      (EMAIL_SOPORTE_WEB ?? "").trim() || "desarrolloweb@ceprija.edu.mx";
    const controlEscolar =
      (EMAIL_CONTROL_ESCOLAR ?? "").trim() || "controlescolar@ceprija.edu.mx";

    if (!brevoKey) {
      apiLog("error", route, "brevo_not_configured", {
        requestId,
        programSlug: programSlug || undefined,
        code: "brevo_not_configured",
      });
      return jsonResponse(
        {
          error: "Correo no configurado en el servidor (KEY_API_BREVO)",
          code: "brevo_not_configured",
        },
        503,
        requestId,
      );
    }

    const adminRecipients = toEmailList(controlEscolar, senderEmail);

    const safeEnrollmentId = escapeHtml(enrollmentId);
    const safeWireRef = escapeHtml(wireReference);
    const safeProgramTitle = escapeHtml(programTitle || programId);
    const safeProgramId = escapeHtml(programId);
    const safeModality = escapeHtml(modality);
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone);

    const safeInvoiceEmail = escapeHtml(invoiceEmail);
    const safeApplicationId = escapeHtml(applicationIdField);

    const adminHtml = `
      <h2>⏳ Comprobante de pago recibido (en revisión)</h2>
      <p><strong>Enrollment ID:</strong> ${safeEnrollmentId}</p>
      ${applicationIdField ? `<p><strong>ID solicitud admisión:</strong> ${safeApplicationId}</p>` : ""}
      ${wireReference ? `<p><strong>Referencia:</strong> ${safeWireRef}</p>` : ""}
      <hr />
      <p><strong>Programa:</strong> ${safeProgramTitle}</p>
      <p><strong>ID Programa:</strong> ${safeProgramId}</p>
      <p><strong>Modalidad:</strong> ${safeModality}</p>
      <p><strong>Requiere factura:</strong> ${requiresInvoice ? "Sí" : "No"}</p>
      ${requiresInvoice ? `<p><strong>Correo factura:</strong> ${safeInvoiceEmail}</p>` : ""}
      <hr />
      <p><strong>Nombre:</strong> ${safeName}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><strong>Teléfono:</strong> ${safePhone}</p>
    `;

    const attachment: { name: string; content: string }[] = [
      {
        name: paymentProof.filename,
        content: paymentProof.buffer.toString("base64"),
      },
    ];
    if (requiresInvoice && fiscalConstancy && fiscalConstancy.buffer.length > 0) {
      attachment.push({
        name: fiscalConstancy.filename,
        content: fiscalConstancy.buffer.toString("base64"),
      });
    }

    const adminRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: "Sistema CEPRIJA" },
        to: adminRecipients,
        subject: `⏳ Comprobante Recibido - ${programTitle || programId} - ${name}`,
        htmlContent: adminHtml,
        attachment,
      }),
    });

    if (!adminRes.ok) {
      const adminErrText = await adminRes.text();
      apiLog("error", route, "brevo_admin_failed", {
        requestId,
        programSlug: programSlug || undefined,
        enrollmentId,
        brevoStatus: adminRes.status,
        brevoBody: adminErrText.slice(0, 500),
      });
    }

    const userHtml = `
      <p>Hola <strong>${safeName}</strong>,</p>
      <p>Hemos recibido tu comprobante de pago para <strong>${safeProgramTitle}</strong>.</p>
      <p><strong>Estado:</strong> Pago en revisión.</p>
      <p><strong>Folio:</strong> ${safeEnrollmentId}</p>
      ${wireReference ? `<p><strong>Referencia:</strong> ${safeWireRef}</p>` : ""}
      <p>Si necesitamos información adicional, te contactaremos.</p>
    `;

    const userRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: "CEPRIJA" },
        to: [{ email }],
        subject: `Comprobante recibido - ${programTitle || programId}`,
        htmlContent: userHtml,
      }),
    });

    if (!userRes.ok) {
      const userErrText = await userRes.text();
      apiLog("error", route, "brevo_user_failed", {
        requestId,
        programSlug: programSlug || undefined,
        enrollmentId,
        brevoStatus: userRes.status,
        brevoBody: userErrText.slice(0, 500),
      });
    } else {
      apiLog("info", route, "wire_proof_accepted", {
        requestId,
        programSlug: programSlug || undefined,
        enrollmentId,
      });
    }

    return jsonResponse(
      {
        success: true,
        enrollmentId,
        message: "Comprobante recibido",
      },
      200,
      requestId,
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "file_too_large"
    ) {
      apiLog("warn", route, "file_too_large", {
        requestId,
        programSlug: programSlug || undefined,
        code: "file_too_large",
        field:
          "field" in error && typeof (error as { field?: string }).field === "string"
            ? (error as { field: string }).field
            : undefined,
      });
      return jsonResponse(
        {
          error: "Archivo demasiado grande (máx. 10 MB)",
          code: "file_too_large",
          ...("field" in error && typeof (error as { field?: string }).field === "string"
            ? { field: (error as { field: string }).field }
            : {}),
        },
        400,
        requestId,
      );
    }
    apiLog("error", route, "internal_error", {
      requestId,
      programSlug: programSlug || undefined,
      code: "internal_error",
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse(
      { error: "Error interno del servidor", code: "internal_error" },
      500,
      requestId,
    );
  }
};
