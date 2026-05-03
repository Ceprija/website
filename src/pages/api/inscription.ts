export const prerender = false;

import type { APIRoute } from "astro";
import Busboy from "busboy";
import {
  sanitizeEmailSubjectLine,
  sanitizeMailAttachmentFileName,
} from "@lib/email/outboundMailGuards";
import { escapeHtml } from "@lib/htmlEscape";
import {
  MAX_FILES_PER_REQUEST,
  MAX_UPLOAD_BYTES,
  validateUploadBuffer,
} from "@lib/uploads/fileValidation";
import { validateInscriptionIdentity } from "@lib/validation/enrollment";
import { canonicalMexicoTenDigitPhone } from "@lib/validation/phone";
import {
  CONTACT_EMAIL,
  EMAIL_CONTROL_ESCOLAR,
  EMAIL_SOPORTE_WEB,
  KEY_API_BREVO,
  SMTP_FROM,
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

function parseFormData(request: Request): Promise<{
  fields: Record<string, string>;
  files: Record<string, { buffer: Buffer; filename: string; mimetype: string }>;
}> {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: Object.fromEntries(request.headers.entries()) });
    const fields: Record<string, string> = {};
    const files: Record<string, { buffer: Buffer; filename: string; mimetype: string }> = {};
    const fileUploadPromises: Promise<void>[] = [];

    busboy.on("field", (fieldname: string, value: string) => {
      fields[fieldname] = value;
    });

    busboy.on("file", (fieldname: string, file: NodeJS.ReadableStream, info: { filename?: string; mimeType?: string }) => {
      const { filename, mimeType } = info;
      if (!filename) {
        file.resume();
        return;
      }

      const mimeNorm = (mimeType ?? "").split(";")[0].trim().toLowerCase();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const sanitizedUser = sanitizeFilename(`${fields.nombre || "usuario"}_${fields.apellidos || ""}`);
      const ext = filename.split(".").pop() || "file";
      const newFilename = `${sanitizedUser}_${fieldname}_${timestamp}.${ext}`;

      const filePromise = new Promise<void>((fResolve, fReject) => {
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
          files[fieldname] = {
            buffer: Buffer.concat(chunks),
            filename: newFilename,
            mimetype: mimeNorm,
          };
          fResolve();
        });
        file.on("error", fReject);
      });
      fileUploadPromises.push(filePromise);
    });

    busboy.on("finish", () => {
      void Promise.all(fileUploadPromises)
        .then(() => resolve({ fields, files }))
        .catch(reject);
    });

    busboy.on("error", reject);

    if (request.body) {
      void request.body.pipeTo(
        new WritableStream({
          write(chunk) {
            busboy.write(chunk as Buffer);
          },
          close() {
            busboy.end();
          },
        }),
      );
    }
  });
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const { fields, files } = await parseFormData(request);
        const { programTitle } = fields;

        const identityErr = validateInscriptionIdentity(fields);
        if (identityErr) {
            return new Response(
                JSON.stringify({
                    message: identityErr.error,
                    code: identityErr.code,
                    ...(identityErr.field && { field: identityErr.field }),
                }),
                { status: 400, headers: { "Content-Type": "application/json" } },
            );
        }

        const fileEntries = Object.entries(files);
        if (fileEntries.length > MAX_FILES_PER_REQUEST) {
            return new Response(
                JSON.stringify({
                    message: "Demasiados archivos adjuntos",
                    code: "too_many_files",
                }),
                { status: 400, headers: { "Content-Type": "application/json" } },
            );
        }

        for (const [field, file] of fileEntries) {
            if (file.buffer.length === 0) continue;
            const v = validateUploadBuffer(file.buffer, file.mimetype, { field });
            if (!v.ok) {
                return new Response(
                    JSON.stringify({
                        message: v.err.error,
                        code: v.err.code,
                        field: v.err.field ?? field,
                    }),
                    { status: 400, headers: { "Content-Type": "application/json" } },
                );
            }
        }

        for (const key of Object.keys(files)) {
            const f = files[key];
            if (f && f.buffer.length === 0) {
                delete files[key];
            }
        }

        // Normalize phone numbers to 10 digits for CSV/emails
        const telefonoCanonical = canonicalMexicoTenDigitPhone(fields.telefono);
        const telEmergenciaCanonical = fields.telEmergencia
            ? canonicalMexicoTenDigitPhone(fields.telEmergencia)
            : '';

        // 1. Generate CSV content

        const headers = [
            "Fecha Registro", "Programa", "Nombre", "Apellidos", "Género", "Teléfono", "Email",
            "Fecha Nacimiento", "CURP", "Nacionalidad", "Entidad Federativa", "Estado Civil",
            "Calle", "Colonia", "CP", "Ciudad", "Estado", "Modalidad Estudo", "Grado Estudios",
            "Carrera", "Institución", "Fecha Inicio", "Fecha Fin", "Estado Licenciatura", "Cédula Num",
            "Cédula Doc", "Acta Nacimiento", "CURP Doc", "Comprobante Dom", "INE",
            "Capacidad Dif", "Detalle Capacidad", "Enf Crónica", "Detalle Enf", "Alergia", "Detalle Alergia",
            "Tratamiento", "Detalle Tratamiento", "Contacto Emergencia", "Parentesco", "Tel Emergencia",
            "Lengua Indígena", "Ocupación", "Origen"
        ];

        const formatDate = (dateStr: string) => {
            if (!dateStr) return '';
            const parts = dateStr.split('-');
            if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
            return dateStr;
        };

        const row = [
            new Date().toLocaleString(),
            programTitle,
            fields.nombre,
            fields.apellidos,
            fields.genero,
            telefonoCanonical,
            fields.email,
            formatDate(fields.fechaNacimiento),
            fields.curp,
            fields.nacionalidad,
            fields.entidadNacimiento,
            fields.estadoCivil,
            fields.calle,
            fields.colonia,
            fields.cp,
            fields.ciudad,
            fields.estadoDireccion,
            fields.modalidadEstudio,
            fields.ultimoGrado,
            fields.carrera,
            fields.institucion,
            formatDate(fields.fechaInicioLic),
            formatDate(fields.fechaFinLic),
            fields.estadoLic,
            fields.cedulaNum,
            files.cedulaDoc?.filename || '',
            files.actaNacimiento?.filename || '',
            files.curpDoc?.filename || '',
            files.comprobanteDom?.filename || '',
            files.ineDoc?.filename || '',
            fields.capacidadDif,
            fields.detalleCapacidad,
            fields.enfCronica,
            fields.detalleEnf,
            fields.alergia,
            fields.detalleAlergia,
            fields.tratamiento,
            fields.detalleTratamiento,
            fields.contactoEmergencia,
            fields.parentesco,
            telEmergenciaCanonical,
            fields.lenguaIndigena,
            fields.ocupacion,
            fields.origen
        ].map((val, index) => {
            let processed = (val || '').toString();
            if (index !== 6) { // Skip uppercase for email (index 6)
                processed = processed.toUpperCase();
            }
            return `"${processed.replace(/"/g, '""')}"`;
        }).join(',');

        // 2. Send Emails
        const brevoKey = KEY_API_BREVO;
        const senderEmail = SMTP_FROM;
        const controlEscolar = EMAIL_CONTROL_ESCOLAR;
        const controlAdmin = CONTACT_EMAIL;
        const soporteWeb = EMAIL_SOPORTE_WEB;

        // Create CSV in memory
        const csvContent = headers.join(',') + '\n' + row + '\n';
        const csvBase64 = Buffer.from(csvContent).toString('base64');
        const attachments = [
            {
                name: sanitizeMailAttachmentFileName(
                    `${sanitizeFilename(programTitle || "inscripcion")}.csv`,
                ),
                content: csvBase64,
            },
        ];

        // Attach all uploaded files
        for (const [, file] of Object.entries(files)) {
            attachments.push({
                name: sanitizeMailAttachmentFileName(file.filename),
                content: file.buffer.toString('base64')
            });
        }

        const safeNombre = escapeHtml(fields.nombre ?? "");
        const safeApellidos = escapeHtml(fields.apellidos ?? "");
        const adminBody = {
            sender: { email: senderEmail },
            to: [{ email: soporteWeb }, { email: controlEscolar }, { email: controlAdmin }],
            subject: sanitizeEmailSubjectLine(`Nueva Inscripción: ${programTitle}`),
            htmlContent: `<h2>Nueva inscripción recibida</h2><p>Se adjunta el archivo CSV con los registros y los documentos adjuntos de <b>${safeNombre} ${safeApellidos}</b>.</p>`,
            attachment: attachments
        };

        const sendToBrevo = async () => {
            try {
                const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'api-key': String(brevoKey) },
                    body: JSON.stringify(adminBody)
                });
                if (!brevoRes.ok) console.error('Brevo Error:', await brevoRes.text());
            } catch (err) {
                console.error('Error enviando a Brevo:', err);
            }
        };

        await sendToBrevo();

        return new Response(JSON.stringify({ message: 'Inscripción exitosa' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            (error as { code?: string }).code === 'file_too_large'
        ) {
            return new Response(
                JSON.stringify({
                    message: 'Archivo demasiado grande (máx. 10 MB)',
                    code: 'file_too_large',
                    ...('field' in error && typeof (error as { field?: string }).field === 'string'
                        ? { field: (error as { field: string }).field }
                        : {}),
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
        }
        console.error('API Error:', error);
        return new Response(JSON.stringify({ message: 'Error en el servidor', error: String(error) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};
