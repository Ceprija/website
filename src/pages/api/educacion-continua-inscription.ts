export const prerender = false;

import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import emailTemplates from "../../data/forms/email-templates-educacion-continua.json";
import Busboy from "busboy";
import { escapeHtml } from "@lib/htmlEscape";
import {
  MAX_FILES_PER_REQUEST,
  MAX_UPLOAD_BYTES,
  validateUploadBuffer,
} from "@lib/uploads/fileValidation";
import {
  normalizeWireModality,
  validateEducacionContinuaFields,
} from "@lib/validation/enrollment";
import {
  CONTACT_EMAIL,
  EMAIL_EDUCACION_CONTINUA,
  EMAIL_SOPORTE_WEB,
  KEY_API_BREVO,
  SMTP_FROM,
  URL_BASE_API,
} from "astro:env/server";

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseFormData(request: Request) {
  return new Promise<{
    fields: Record<string, string>;
    files: Array<{ fieldname: string; buffer: Buffer; filename: string; mimetype: string }>;
  }>((resolve, reject) => {
    const busboy = Busboy({ headers: Object.fromEntries(request.headers.entries()) });
    const fields: Record<string, string> = {};
    const files: Array<{
      fieldname: string;
      buffer: Buffer;
      filename: string;
      mimetype: string;
    }> = [];
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

    request.body?.pipeTo(
      new WritableStream({
        write(chunk) {
          busboy.write(chunk as Buffer);
        },
        close() {
          busboy.end();
        },
      }),
    );
  });
}

function replacePlaceholders(template: string, data: Record<string, string>) {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    result = result.replace(regex, value || "");
  }
  return result;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { fields, files } = await parseFormData(request);

    const fieldErr = validateEducacionContinuaFields(fields);
    if (fieldErr) {
      return new Response(
        JSON.stringify({
          message: fieldErr.error,
          code: fieldErr.code,
          ...(fieldErr.field && { field: fieldErr.field }),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const nonEmptyFiles = files.filter((f) => f.buffer.length > 0);
    if (nonEmptyFiles.length > MAX_FILES_PER_REQUEST) {
      return new Response(
        JSON.stringify({
          message: "Demasiados archivos adjuntos",
          code: "too_many_files",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    for (const f of nonEmptyFiles) {
      const v = validateUploadBuffer(f.buffer, f.mimetype, { field: f.fieldname });
      if (!v.ok) {
        return new Response(
          JSON.stringify({
            message: v.err.error,
            code: v.err.code,
            field: v.err.field ?? f.fieldname,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    const modalityCanonical = normalizeWireModality(fields.modality)!;

    const {
      name,
      email,
      phone,
      programTitle,
      programId,
      requiresInvoice,
      invoiceEmail,
    } = fields;

    // Get program details from content collection
    const programs = await getCollection("programas");
    const program = programs.find((p) => p.slug === programId || p.data.title === programTitle);

    const programDetails = program ? {
      startDate: String(program.data.startDate || "Por confirmar"),
      schedule: String(program.data.schedule || "Por confirmar"),
      instructor: String(program.data.instructor || "Claustro Docente CEPRIJA"),
      address: String(program.data.address || "Lope de Vega #273, Guadalajara"),
      meetingLink: String((program.data as { meetingLink?: string })?.meetingLink || "Se enviará previo al inicio")
    } : {
      startDate: "Por confirmar",
      schedule: "Por confirmar",
      instructor: "Claustro Docente CEPRIJA",
      address: "Lope de Vega #273, Guadalajara",
      meetingLink: "Se enviará previo al inicio"
    };

    const header = "FECHA,NOMBRE,EMAIL,TELEFONO,MODALIDAD,FACTURA,EMAIL FACTURA\n";
    const now = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
    const csvRow =
      [
        `"${now}"`,
        `"${name.trim().toUpperCase()}"`,
        email.trim().toLowerCase(),
        phone.trim(),
        modalityCanonical.toUpperCase(),
        requiresInvoice.toUpperCase(),
        (invoiceEmail || "").toLowerCase(),
      ].join(",") + "\n";

    const csvContent = header + csvRow;

    const brevoKey = KEY_API_BREVO;
    if (!brevoKey) throw new Error("Falta KEY_API_BREVO");

    const senderEmail = SMTP_FROM || CONTACT_EMAIL;
    const adminEmail1 = EMAIL_EDUCACION_CONTINUA || CONTACT_EMAIL;
    const adminEmail2 = EMAIL_SOPORTE_WEB;

    const adminTo = [{ email: adminEmail1 }];
    if (adminEmail2 && adminEmail2 !== adminEmail1) {
      adminTo.push({ email: adminEmail2 });
    }

    const sendToBrevo = async () => {
      try {
        const safeProgramTitle = escapeHtml(programTitle);
        const safeName = escapeHtml(name);
        const safeEmail = escapeHtml(email);
        const safePhone = escapeHtml(phone);
        const safeModality = escapeHtml(modalityCanonical);
        const safeInvoiceEmail = escapeHtml(invoiceEmail || "");

        const adminHtml = `
                    <h2>Nueva Inscripción Educación Continua</h2>
                    <p><strong>Programa:</strong> ${safeProgramTitle}</p>
                    <p><strong>Participante:</strong> ${safeName}</p>
                    <p><strong>Email:</strong> ${safeEmail}</p>
                    <p><strong>Teléfono:</strong> ${safePhone}</p>
                    <p><strong>Modalidad:</strong> ${safeModality}</p>
                    <p><strong>¿Factura?:</strong> ${escapeHtml(requiresInvoice)}</p>
                    ${
                      requiresInvoice === "Sí"
                        ? `<p><strong>Email Factura:</strong> ${safeInvoiceEmail}</p>`
                        : ""
                    }
                `;

        const adminBody: Record<string, unknown> = {
          sender: { email: senderEmail, name: "CEPRIJA Web" },
          to: adminTo,
          subject: `INSCRIPCIÓN EC: ${programTitle} - ${name}`,
          htmlContent: adminHtml,
          attachment: [] as Array<{ name: string; content: string }>,
        };

        const attachments = adminBody.attachment as Array<{ name: string; content: string }>;

        for (const f of nonEmptyFiles) {
          attachments.push({
            name: f.filename,
            content: f.buffer.toString("base64"),
          });
        }

        const csvBase64 = Buffer.from(csvContent).toString("base64");
        attachments.push({
          name: `${sanitizeFilename(programTitle || "ec-general")}.csv`,
          content: csvBase64,
        });

        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "api-key": brevoKey },
          body: JSON.stringify(adminBody),
        });

        const templateSet =
          (emailTemplates as Record<string, unknown>)[programId] ||
          (emailTemplates as { default: unknown }).default;
        const modalityKey = modalityCanonical === "En línea" ? "en_linea" : "presencial";
        const templateSetTyped = templateSet as Record<string, { body: string; subject: string }>;
        const template =
          templateSetTyped[modalityKey] ||
          (emailTemplates as { default: Record<string, { body: string; subject: string }> }).default[
            modalityKey
          ];

                const templateData = {
                    name: name,
                    programTitle: programTitle,
                    startDate: programDetails.startDate,
                    schedule: programDetails.schedule,
                    instructor: programDetails.instructor,
                    address: programDetails.address,
                    meetingLink: programDetails.meetingLink,
                };

        const userHtml = replacePlaceholders(template.body, templateData);
        const userSubject = replacePlaceholders(template.subject, templateData);

        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "api-key": brevoKey },
          body: JSON.stringify({
            sender: { email: senderEmail, name: "Equipo CEPRIJA" },
            to: [{ email }],
            subject: userSubject,
            htmlContent: userHtml,
          }),
        });
      } catch (err) {
        console.error("Error enviando a Brevo:", err);
      }
    };

    const sendToLaravel = async () => {
      try {
        const apiUrl = URL_BASE_API;
        if (!apiUrl) return;

        const formPayload = new FormData();

        const appendIfExists = (key: string, val: unknown) => {
          if (val) formPayload.append(key, String(val));
        };

        appendIfExists("nombre", name);
        appendIfExists("email", email);
        appendIfExists("telefono", phone);
        appendIfExists("programa", programTitle);
        appendIfExists("programa_id", programId);
        appendIfExists("modalidad", modalityCanonical);
        formPayload.append("requiere_factura", requiresInvoice === "Sí" ? "1" : "0");
        appendIfExists("email_factura", invoiceEmail);

        const paymentProof = nonEmptyFiles.find(
          (f) => f.fieldname === "paymentProof" || f.fieldname === "comprobantePago",
        );
        if (paymentProof && paymentProof.buffer.length) {
          formPayload.append(
            "comprobante_pago_doc",
            new Blob([new Uint8Array(paymentProof.buffer)], { type: paymentProof.mimetype }),
            paymentProof.filename,
          );
        }

        const fiscalConstancy = nonEmptyFiles.find((f) => f.fieldname === "fiscalConstancy");
        if (fiscalConstancy && fiscalConstancy.buffer.length) {
          formPayload.append(
            "comprobante_fiscal_doc",
            new Blob([new Uint8Array(fiscalConstancy.buffer)], { type: fiscalConstancy.mimetype }),
            fiscalConstancy.filename,
          );
        }

        console.log(`Sending EC data to API: ${apiUrl}educacion-continua/registro`);
        const apiRes = await fetch(`${apiUrl}educacion-continua/registro`, {
          method: "POST",
          headers: { Accept: "application/json" },
          body: formPayload,
        });

        if (!apiRes.ok) {
          console.error("Laravel API Error response:", await apiRes.text());
        } else {
          console.log("Successfully saved EC registration to Laravel API.");
        }
      } catch (apiError) {
        console.error("Failed to send EC data to Laravel API:", apiError);
      }
    };

    await Promise.allSettled([sendToBrevo(), sendToLaravel()]);

    return new Response(JSON.stringify({ message: "Ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "file_too_large"
    ) {
      return new Response(
        JSON.stringify({
          message: "Archivo demasiado grande (máx. 10 MB)",
          code: "file_too_large",
          ...("field" in error && typeof (error as { field?: string }).field === "string"
            ? { field: (error as { field: string }).field }
            : {}),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    console.error(error);
    return new Response(
      JSON.stringify({ message: error instanceof Error ? error.message : "Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
