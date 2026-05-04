export const prerender = false;

import type { APIRoute } from "astro";
import Busboy from "busboy";
import { EMAIL_CONTROL_ESCOLAR, EMAIL_SOPORTE_WEB, KEY_API_BREVO } from "astro:env/server";
import { escapeHtml } from "@lib/htmlEscape";
import {
  MAX_FILES_PER_REQUEST,
  MAX_UPLOAD_BYTES,
  validateUploadBuffer,
} from "@lib/uploads/fileValidation";
import { validateStripeFiscalPreflightFields } from "@lib/validation/enrollment";
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
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const userKey = (fields.participantName || fields.invoiceEmail || "usuario").slice(0, 40);
        const sanitizedName = sanitizeFilename(userKey);
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

export const POST: APIRoute = async ({ request }) => {
  const requestId = getRequestId(request);
  const route = "POST /api/stripe/fiscal-preflight";
  try {
    const { fields, files } = await parseFormData(request);
    const programSlugEarly = (fields.programSlug ?? "").trim();

    const fieldErr = validateStripeFiscalPreflightFields(fields);
    if (fieldErr) {
      apiLog("warn", route, "validation_failed", {
        requestId,
        programSlug: programSlugEarly || undefined,
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

    if (files.length > MAX_FILES_PER_REQUEST) {
      apiLog("warn", route, "too_many_files", {
        requestId,
        programSlug: programSlugEarly || undefined,
        code: "too_many_files",
      });
      return jsonResponse(
        { error: "Demasiados archivos", code: "too_many_files" },
        400,
        requestId,
      );
    }

    const fiscal = files.find((f) =>
      ["fiscalConstancy", "rfcDocument", "csf"].includes(f.fieldname),
    );

    if (!fiscal || fiscal.buffer.length === 0) {
      apiLog("warn", route, "missing_fiscal_constancy", {
        requestId,
        programSlug: programSlugEarly || undefined,
        code: "missing_fiscal_constancy",
      });
      return jsonResponse(
        {
          error: "Falta la constancia de situación fiscal (CSF)",
          code: "missing_fiscal_constancy",
          field: "fiscalConstancy",
        },
        400,
        requestId,
      );
    }

    const v = validateUploadBuffer(fiscal.buffer, fiscal.mimetype, {
      field: fiscal.fieldname,
    });
    if (!v.ok) {
      apiLog("warn", route, "upload_validation_failed", {
        requestId,
        programSlug: programSlugEarly || undefined,
        code: v.err.code,
        field: v.err.field ?? fiscal.fieldname,
      });
      return jsonResponse(
        {
          error: v.err.error,
          code: v.err.code,
          field: v.err.field ?? fiscal.fieldname,
        },
        400,
        requestId,
      );
    }

    const invoiceEmail = (fields.invoiceEmail ?? "").trim();
    const programSlug = (fields.programSlug ?? "").trim();
    const programTitle = (fields.programTitle ?? "").trim();
    const participantName = (fields.participantName ?? "").trim();
    const participantPhone = (fields.participantPhone ?? "").trim();
    const modality = (fields.modality ?? "").trim();
    const customerEmail = (fields.customerEmail ?? "").trim();
    const applicationId = (fields.applicationId ?? "").trim();

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
          error: "Correo no configurado (KEY_API_BREVO)",
          code: "brevo_not_configured",
        },
        503,
        requestId,
      );
    }

    const adminHtml = `
      <h2>Facturación — pago con Stripe (pendiente)</h2>
      <p>El aspirante indicó que <strong>requiere factura</strong> y adjuntó CSF antes de ir a Checkout.</p>
      <hr />
      ${applicationId ? `<p><strong>ID solicitud admisión:</strong> ${escapeHtml(applicationId)}</p>` : ""}
      <p><strong>Programa:</strong> ${escapeHtml(programTitle || programSlug)}</p>
      <p><strong>Slug:</strong> ${escapeHtml(programSlug)}</p>
      <p><strong>Modalidad:</strong> ${escapeHtml(modality)}</p>
      <hr />
      <p><strong>Nombre:</strong> ${escapeHtml(participantName)}</p>
      <p><strong>Teléfono:</strong> ${escapeHtml(participantPhone)}</p>
      <p><strong>Correo factura:</strong> ${escapeHtml(invoiceEmail)}</p>
      ${customerEmail ? `<p><strong>Correo pago (Stripe):</strong> ${escapeHtml(customerEmail)}</p>` : ""}
      <p><em>Tras el pago, revisa metadata de la sesión en Stripe (requiresInvoice, invoiceEmail).</em></p>
    `;

    const adminRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: "Sistema CEPRIJA" },
        to: [{ email: controlEscolar }, ...(senderEmail !== controlEscolar ? [{ email: senderEmail }] : [])],
        subject: `Facturación (Stripe) — ${programTitle || programSlug} — ${participantName}`,
        htmlContent: adminHtml,
        attachment: [
          {
            name: fiscal.filename,
            content: fiscal.buffer.toString("base64"),
          },
        ],
      }),
    });

    if (!adminRes.ok) {
      const brevoBody = await adminRes.text();
      apiLog("error", route, "brevo_send_failed", {
        requestId,
        programSlug: programSlug || undefined,
        brevoStatus: adminRes.status,
        brevoBody: brevoBody.slice(0, 500),
      });
    } else {
      apiLog("info", route, "preflight_ok", {
        requestId,
        programSlug: programSlug || undefined,
      });
    }

    return jsonResponse({ success: true }, 200, requestId);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "file_too_large"
    ) {
      apiLog("warn", route, "file_too_large", {
        requestId,
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
      code: "internal_error",
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse(
      { error: "Error interno", code: "internal_error" },
      500,
      requestId,
    );
  }
};
