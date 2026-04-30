export const prerender = false;

import type { APIRoute } from "astro";
import { EMAIL_CONTROL_ESCOLAR, EMAIL_SOPORTE_WEB, KEY_API_BREVO } from "astro:env/server";
import Busboy from "busboy";
import crypto from "node:crypto";

type UploadedFile = {
  fieldname: string;
  buffer: Buffer;
  filename: string;
  mimetype: string;
};

function asNonEmptyString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

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

      busboy.on("field", (fieldname, value) => {
        fields[fieldname] = value;
      });

      busboy.on("file", (fieldname, file, info) => {
        const { filename, mimeType } = info;
        if (!filename) {
          file.resume();
          return;
        }

        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, "-")
          .slice(0, 19);
        const userName = fields.name || "usuario";
        const sanitizedName = sanitizeFilename(userName);
        const ext = filename.split(".").pop() || "file";
        const newFilename = `${fieldname}_${sanitizedName}_${timestamp}.${ext}`;

        const chunks: Buffer[] = [];
        file.on("data", (data: Buffer) => chunks.push(data));
        file.on("end", () => {
          files.push({
            fieldname,
            buffer: Buffer.concat(chunks),
            filename: newFilename,
            mimetype: mimeType,
          });
        });
        file.on("error", reject);
      });

      busboy.on("finish", () => resolve({ fields, files }));
      busboy.on("error", reject);

      if (!request.body) {
        reject(new Error("Empty request body"));
        return;
      }

      request.body
        .pipeTo(
          new WritableStream({
            write(chunk) {
              busboy.write(chunk);
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
    emails
      .map((e) => (typeof e === "string" ? e.trim() : ""))
      .filter(Boolean),
  );
  return [...uniq].map((email) => ({ email }));
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { fields, files } = await parseFormData(request);
    const enrollmentId = crypto.randomUUID();

    const name = asNonEmptyString(fields.name);
    const email = asNonEmptyString(fields.email);
    const phone = asNonEmptyString(fields.phone);
    const programTitle = asNonEmptyString(fields.programTitle);
    const programId = asNonEmptyString(fields.programId);
    const modality = asNonEmptyString(fields.modality);
    const wireReference = asNonEmptyString(fields.wireReference);

    const paymentProof = files.find((f) =>
      ["paymentProof", "comprobantePago", "comprobante_pago"].includes(f.fieldname),
    );

    const missing: string[] = [];
    if (!name) missing.push("name");
    if (!email) missing.push("email");
    if (!phone) missing.push("phone");
    if (!programTitle && !programId) missing.push("programTitle/programId");
    if (!modality) missing.push("modality");
    if (!paymentProof) missing.push("paymentProof");

    if (missing.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Faltan campos requeridos",
          code: "missing_fields",
          missing,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const brevoKey = (KEY_API_BREVO ?? "").trim();
    const senderEmail = (EMAIL_SOPORTE_WEB ?? "").trim() || "desarrolloweb@ceprija.edu.mx";
    const controlEscolar = (EMAIL_CONTROL_ESCOLAR ?? "").trim() || "controlescolar@ceprija.edu.mx";

    if (!brevoKey) {
      return new Response(
        JSON.stringify({
          error: "Correo no configurado en el servidor (KEY_API_BREVO)",
          code: "brevo_not_configured",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    const adminRecipients = toEmailList(controlEscolar, senderEmail);

    const adminHtml = `
      <h2>⏳ Comprobante de pago recibido (en revisión)</h2>
      <p><strong>Enrollment ID:</strong> ${enrollmentId}</p>
      ${wireReference ? `<p><strong>Referencia:</strong> ${wireReference}</p>` : ""}
      <hr />
      <p><strong>Programa:</strong> ${programTitle}</p>
      <p><strong>ID Programa:</strong> ${programId}</p>
      <p><strong>Modalidad:</strong> ${modality}</p>
      <hr />
      <p><strong>Nombre:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Teléfono:</strong> ${phone}</p>
    `;

    const attachment = [
      {
        name: paymentProof.filename,
        content: paymentProof.buffer.toString("base64"),
      },
    ];

    const adminRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: "Sistema CEPRIJA" },
        to: adminRecipients,
        subject: `⏳ Comprobante Recibido - ${programTitle} - ${name}`,
        htmlContent: adminHtml,
        attachment,
      }),
    });

    if (!adminRes.ok) {
      console.error("[wire-proof] Brevo admin error:", adminRes.status, await adminRes.text());
    }

    const userHtml = `
      <p>Hola <strong>${name}</strong>,</p>
      <p>Hemos recibido tu comprobante de pago para <strong>${programTitle}</strong>.</p>
      <p><strong>Estado:</strong> Pago en revisión.</p>
      <p><strong>Folio:</strong> ${enrollmentId}</p>
      ${wireReference ? `<p><strong>Referencia:</strong> ${wireReference}</p>` : ""}
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
        subject: `Comprobante recibido - ${programTitle}`,
        htmlContent: userHtml,
      }),
    });

    if (!userRes.ok) {
      console.error("[wire-proof] Brevo user error:", userRes.status, await userRes.text());
    }

    return new Response(
      JSON.stringify({
        success: true,
        enrollmentId,
        message: "Comprobante recibido",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[wire-proof] Internal error:", error);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor", code: "internal_error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

