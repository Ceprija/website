export const prerender = false;

import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import Busboy from "busboy";
import crypto from "node:crypto";
import { escapeHtml } from "@lib/htmlEscape";
import {
  MAX_FILES_PER_REQUEST,
  MAX_UPLOAD_BYTES,
  validateUploadBuffer,
} from "@lib/uploads/fileValidation";
import { EMAIL_CONTROL_ESCOLAR, EMAIL_SOPORTE_WEB, KEY_API_BREVO } from "astro:env/server";

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
      const busboy = Busboy({ headers: Object.fromEntries(request.headers.entries()) });
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
        const userName = `${fields.nombre || "usuario"}_${fields.apellidos || ""}`;
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

export const POST: APIRoute = async ({ request }) => {
  try {
    const { fields, files } = await parseFormData(request);
    const applicationId = crypto.randomUUID();

    // Required fields
    const nombre = (fields.nombre ?? "").trim();
    const apellidos = (fields.apellidos ?? "").trim();
    const email = (fields.email ?? "").trim();
    const telefono = (fields.telefono ?? "").trim();
    const programSlug = (fields.programSlug ?? "").trim();
    const programTitle = (fields.programTitle ?? "").trim();
    const modality = (fields.modality ?? "").trim();

    // Academic fields
    const ultimoGrado = (fields.ultimoGrado ?? "").trim();
    const carrera = (fields.carrera ?? "").trim();
    const institucion = (fields.institucion ?? "").trim();
    const cedulaNum = (fields.cedulaNum ?? "").trim();

    // Validation
    const missing: string[] = [];
    if (!nombre) missing.push("nombre");
    if (!apellidos) missing.push("apellidos");
    if (!email) missing.push("email");
    if (!telefono) missing.push("telefono");
    if (!programSlug && !programTitle) missing.push("programSlug/programTitle");
    if (!modality) missing.push("modality");
    if (!ultimoGrado) missing.push("ultimoGrado");
    if (!carrera) missing.push("carrera");
    if (!institucion) missing.push("institucion");

    // Check required files: cv, kardex, titulo
    const requiredFiles = ["cv", "kardex", "titulo"];
    const uploadedFileFields = files.map((f) => f.fieldname);
    const missingFiles = requiredFiles.filter((rf) => !uploadedFileFields.includes(rf));

    if (missing.length > 0 || missingFiles.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Faltan campos requeridos",
          code: "missing_fields",
          missing: [...missing, ...missingFiles.map((f) => `file:${f}`)],
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Validate file count and contents
    if (files.length > MAX_FILES_PER_REQUEST) {
      return new Response(
        JSON.stringify({
          error: "Demasiados archivos adjuntos",
          code: "too_many_files",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    for (const file of files) {
      if (file.buffer.length === 0) continue;
      const v = validateUploadBuffer(file.buffer, file.mimetype, { field: file.fieldname });
      if (!v.ok) {
        return new Response(
          JSON.stringify({
            error: v.err.error,
            code: v.err.code,
            field: v.err.field ?? file.fieldname,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // Get program details from content collection
    const programs = await getCollection("programas");
    const program = programs.find((p) => p.slug === programSlug || p.data.title === programTitle);

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

    const adminRecipients = [
      { email: controlEscolar },
      ...(senderEmail !== controlEscolar ? [{ email: senderEmail }] : []),
    ];

    // Prepare email content with escaped values
    const safeNombre = escapeHtml(nombre);
    const safeApellidos = escapeHtml(apellidos);
    const safeEmail = escapeHtml(email);
    const safeTelefono = escapeHtml(telefono);
    const safeProgramTitle = escapeHtml(programTitle || program?.data.title || "Programa");
    const safeModality = escapeHtml(modality);
    const safeUltimoGrado = escapeHtml(ultimoGrado);
    const safeCarrera = escapeHtml(carrera);
    const safeInstitucion = escapeHtml(institucion);
    const safeCedulaNum = escapeHtml(cedulaNum || "No proporcionada");

    const adminHtml = `
      <h2>Nueva Solicitud de Admisión</h2>
      <p><strong>ID de Solicitud:</strong> ${escapeHtml(applicationId)}</p>
      <hr />
      <h3>Programa</h3>
      <p><strong>Programa:</strong> ${safeProgramTitle}</p>
      <p><strong>Modalidad:</strong> ${safeModality}</p>
      <hr />
      <h3>Información del Aspirante</h3>
      <p><strong>Nombre:</strong> ${safeNombre} ${safeApellidos}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><strong>Teléfono:</strong> ${safeTelefono}</p>
      <hr />
      <h3>Formación Académica</h3>
      <p><strong>Último Grado:</strong> ${safeUltimoGrado}</p>
      <p><strong>Carrera:</strong> ${safeCarrera}</p>
      <p><strong>Institución:</strong> ${safeInstitucion}</p>
      <p><strong>Cédula:</strong> ${safeCedulaNum}</p>
      <hr />
      <p><strong>Documentos adjuntos:</strong></p>
      <ul>
        ${files.map((f) => `<li>${escapeHtml(f.filename)} (${escapeHtml(f.fieldname)})</li>`).join("")}
      </ul>
      <p><em>Fecha de solicitud: ${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}</em></p>
    `;

    const attachment = files.map((f) => ({
      name: f.filename,
      content: f.buffer.toString("base64"),
    }));

    const adminRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: "Sistema CEPRIJA" },
        to: adminRecipients,
        subject: `Nueva Solicitud de Admisión - ${programTitle} - ${nombre} ${apellidos}`,
        htmlContent: adminHtml,
        attachment,
      }),
    });

    if (!adminRes.ok) {
      console.error("[enrollment] Brevo admin error:", adminRes.status, await adminRes.text());
    }

    // User confirmation email
    const userHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #003d82 0%, #0056b3 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0;">Solicitud Recibida</h1>
        </div>
        
        <div style="padding: 30px; background: #f9f9f9;">
          <p>Estimado(a) <strong>${safeNombre} ${safeApellidos}</strong>,</p>
          
          <p>Hemos recibido exitosamente su solicitud de admisión para <strong>${safeProgramTitle}</strong>.</p>
          
          <div style="background: white; border-left: 4px solid #003d82; padding: 15px; margin: 20px 0;">
            <p><strong>ID de Solicitud:</strong> ${escapeHtml(applicationId)}</p>
            <p><strong>Programa:</strong> ${safeProgramTitle}</p>
            <p><strong>Modalidad:</strong> ${safeModality}</p>
          </div>
          
          <h3 style="color: #003d82;">Próximos Pasos</h3>
          <ol>
            <li>Nuestro equipo revisará su solicitud y documentos en las próximas <strong>48-72 horas</strong>.</li>
            <li>Le contactaremos por correo electrónico con el resultado de la evaluación.</li>
            <li>Si es aceptado, recibirá instrucciones para completar su inscripción y realizar el pago correspondiente.</li>
          </ol>
          
          <p>Si tiene alguna pregunta, no dude en contactarnos:</p>
          <p>📧 Email: ${escapeHtml(controlEscolar)}<br>
          📞 Teléfono: (33) 3826-4863</p>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Gracias por su interés en CEPRIJA.
          </p>
        </div>
        
        <div style="background: #003d82; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p>Centro de Preparación Integral en Materia Jurídica y Administrativa (CEPRIJA)</p>
          <p>Lope de Vega #273, Col. Americana Arcos, Guadalajara, Jalisco</p>
        </div>
      </div>
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
        subject: `Solicitud Recibida - ${programTitle}`,
        htmlContent: userHtml,
      }),
    });

    if (!userRes.ok) {
      console.error("[enrollment] Brevo user error:", userRes.status, await userRes.text());
    }

    return new Response(
      JSON.stringify({
        success: true,
        applicationId,
        message: "Solicitud enviada exitosamente",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
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
    console.error("[enrollment] Internal error:", error);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor", code: "internal_error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
