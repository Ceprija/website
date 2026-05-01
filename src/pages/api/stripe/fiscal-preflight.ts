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
  try {
    const { fields, files } = await parseFormData(request);

    const fieldErr = validateStripeFiscalPreflightFields(fields);
    if (fieldErr) {
      return new Response(
        JSON.stringify({
          error: fieldErr.error,
          code: fieldErr.code,
          ...(fieldErr.field && { field: fieldErr.field }),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (files.length > MAX_FILES_PER_REQUEST) {
      return new Response(
        JSON.stringify({ error: "Demasiados archivos", code: "too_many_files" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const fiscal = files.find((f) =>
      ["fiscalConstancy", "rfcDocument", "csf"].includes(f.fieldname),
    );

    if (!fiscal || fiscal.buffer.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Falta la constancia de situación fiscal (CSF)",
          code: "missing_fiscal_constancy",
          field: "fiscalConstancy",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const v = validateUploadBuffer(fiscal.buffer, fiscal.mimetype, {
      field: fiscal.fieldname,
    });
    if (!v.ok) {
      return new Response(
        JSON.stringify({
          error: v.err.error,
          code: v.err.code,
          field: v.err.field ?? fiscal.fieldname,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
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
      return new Response(
        JSON.stringify({
          error: "Correo no configurado (KEY_API_BREVO)",
          code: "brevo_not_configured",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
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
      console.error("[fiscal-preflight] Brevo:", adminRes.status, await adminRes.text());
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "file_too_large"
    ) {
      return new Response(
        JSON.stringify({
          error: "Archivo demasiado grande (máx. 10 MB)",
          code: "file_too_large",
          ...("field" in error && typeof (error as { field?: string }).field === "string"
            ? { field: (error as { field: string }).field }
            : {}),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    console.error("[fiscal-preflight]", error);
    return new Response(
      JSON.stringify({ error: "Error interno", code: "internal_error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
