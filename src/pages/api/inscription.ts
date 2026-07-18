export const prerender = false;

import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import Busboy from "busboy";
import {
  MAX_FILES_PER_REQUEST,
  MAX_UPLOAD_BYTES,
  validateUploadBuffer,
} from "@lib/uploads/fileValidation";
import { normalizeUploadForDelivery } from "@lib/uploads/normalizeUploadForDelivery";
import { validateInscriptionIdentity } from "@lib/validation/enrollment";
import { SMTP_FROM } from "astro:env/server";
import { apiLog, getRequestId } from "@lib/server/apiRequestLog";
import crypto from "node:crypto";
import {
  guardPublicPost,
  hasHoneypotValue,
  honeypotResponse,
} from "@lib/server/publicEndpointGuards";
import { sendBrevoEmail } from "@lib/email/brevoClient";
import { programAdminRecipients } from "@lib/email/programAdminRecipients";
import { getProgramPathSlug } from "@lib/programPaths";
import { programSubmissionMeta } from "@lib/programSubmissionMeta";
import { generacionFromNivel, generacionFromProgramTitle } from "@lib/programGeneracion";
import { persistSubmission, logEmailAttempt, uploadSubmissionFiles } from "@lib/db/submissions";
import { logPersistenceFailure } from "@lib/db/logPersistenceFailure";

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
    const requestId = getRequestId(request);
    const route = "POST /api/inscription";
    const guarded = guardPublicPost(request, {
        route,
        requestId,
        rateLimitKey: "inscription",
        limit: 8,
        windowMs: 10 * 60_000,
        expectedContentType: "multipart",
    });
    if (guarded) return guarded;

    try {
        const { fields, files } = await parseFormData(request);
        if (hasHoneypotValue(fields)) {
            return honeypotResponse(route, requestId);
        }
        const { programTitle } = fields;
        if (fields.email) {
            fields.email = fields.email.trim().toLowerCase();
        }
        const submissionRequestId = crypto.randomUUID();

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
            const normalized = await normalizeUploadForDelivery(
                {
                    buffer: file.buffer,
                    filename: file.filename,
                    mimetype: file.mimetype,
                    fieldname: field,
                },
                { logRoute: route, requestId },
            );
            if (!normalized.ok) {
                return new Response(
                    JSON.stringify({
                        message: normalized.err.error,
                        code: normalized.err.code,
                        field: normalized.err.field ?? field,
                    }),
                    { status: 400, headers: { "Content-Type": "application/json" } },
                );
            }
            files[field] = { ...file, ...normalized.file };
        }

        for (const key of Object.keys(files)) {
            const f = files[key];
            if (f && f.buffer.length === 0) {
                delete files[key];
            }
        }

        // Resolve program + generación before CSV / persist
        const programs = await getCollection("programas");
        const program = programs.find(
            (entry) =>
                getProgramPathSlug(entry) === programTitle ||
                String(entry.data.title ?? "") === programTitle,
        );
        const programSlug = program ? getProgramPathSlug(program) : programTitle;
        // Always derive server-side — ignore client-posted generacion (readonly is UI-only).
        const generacion =
            generacionFromNivel(program?.data.nivel) ||
            generacionFromProgramTitle(programTitle ?? "");

        // 1. Generate CSV content

        const headers = [
            "Fecha Registro", "Programa", "Nombre", "Apellidos", "Género", "Teléfono", "Email",
            "Fecha Nacimiento", "CURP", "Nacionalidad", "Entidad Federativa", "Estado Civil",
            "Calle", "Colonia", "CP", "Ciudad", "Estado", "Modalidad Estudo", "Generación", "Grado Estudios",
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
            fields.telefono,
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
            generacion,
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
            fields.telEmergencia,
            fields.lenguaIndigena,
            fields.ocupacion,
            fields.origen
        ].map((val, index) => {
            let processed = (val || '').toString();
            // Skip uppercase for email (index 6)
            if (index !== 6) {
                processed = processed.toUpperCase();
            }
            return `"${processed.replace(/"/g, '""')}"`;
        }).join(',');

        // 2. Persist to Database
        const submission = await persistSubmission(
            {
                requestId: submissionRequestId,
                flow: "legacy_inscription",
                personKind: "enrolled",
                email: fields.email?.trim() || "",
                phone: fields.telefono?.trim() || "",
                programSlug,
                programTitle,
                apiRoute: route,
                payload: {
                    nombre: fields.nombre,
                    apellidos: fields.apellidos,
                    genero: fields.genero,
                    telefono: fields.telefono,
                    email: fields.email,
                    fechaNacimiento: fields.fechaNacimiento,
                    curp: fields.curp,
                    nacionalidad: fields.nacionalidad,
                    entidadNacimiento: fields.entidadNacimiento,
                    estadoCivil: fields.estadoCivil,
                    calle: fields.calle,
                    colonia: fields.colonia,
                    cp: fields.cp,
                    ciudad: fields.ciudad,
                    estadoDireccion: fields.estadoDireccion,
                    modalidadEstudio: fields.modalidadEstudio,
                    generacion,
                    ultimoGrado: fields.ultimoGrado,
                    carrera: fields.carrera,
                    institucion: fields.institucion,
                    fechaInicioLic: fields.fechaInicioLic,
                    fechaFinLic: fields.fechaFinLic,
                    estadoLic: fields.estadoLic,
                    cedulaNum: fields.cedulaNum,
                    capacidadDif: fields.capacidadDif,
                    detalleCapacidad: fields.detalleCapacidad,
                    enfCronica: fields.enfCronica,
                    detalleEnf: fields.detalleEnf,
                    alergia: fields.alergia,
                    detalleAlergia: fields.detalleAlergia,
                    tratamiento: fields.tratamiento,
                    detalleTratamiento: fields.detalleTratamiento,
                    contactoEmergencia: fields.contactoEmergencia,
                    parentesco: fields.parentesco,
                    telEmergencia: fields.telEmergencia,
                    lenguaIndigena: fields.lenguaIndigena,
                    ocupacion: fields.ocupacion,
                    origen: fields.origen,
                    files: Object.entries(files).map(([fieldname, file]) => ({
                        fieldname,
                        filename: file.filename,
                        mimetype: file.mimetype,
                        size: file.buffer.length,
                    })),
                    ...programSubmissionMeta(program),
                },
            },
            route,
            { timeoutMs: 8000 }  // Increased timeout for critical enrollment form
        );

        if (!submission.ok) {
            apiLog("warn", route, "db_persistence_failed", {
                requestId,
                reason: submission.reason,
                email: fields.email?.slice(0, 3) + "***",
            });
            logPersistenceFailure({
                route,
                requestId: submissionRequestId,
                flow: "legacy_inscription",
                reason: submission.reason,
                email: fields.email,
                error: submission.error,
            });
        }

        const submissionId = submission.ok ? submission.submissionId : null;

        // 2.5 Upload files to Storage (if persistence succeeded)
        if (submission.ok) {
            for (const [fieldname, file] of Object.entries(files)) {
                const uploadResult = await uploadSubmissionFiles({
                    submissionId: submission.submissionId,
                    flow: "legacy_inscription",
                    files: [{
                        field_name: fieldname,
                        original_filename: file.filename,
                        mime_type: file.mimetype,
                        content_base64: file.buffer.toString("base64"),
                    }],
                    timeoutMs: 20000,
                });

                if (!uploadResult.ok) {
                    logPersistenceFailure({
                        route,
                        requestId: submissionRequestId,
                        flow: "legacy_inscription",
                        reason: "file_upload_failed",
                        error: uploadResult.reason,
                        email: fields.email,
                    });
                }
            }
        }

        // 3. Send Emails
        const senderEmail = (SMTP_FROM ?? "").trim() || "desarrolloweb@ceprija.edu.mx";

        // Create CSV in memory
        const csvContent = headers.join(',') + '\n' + row + '\n';
        const csvBase64 = Buffer.from(csvContent).toString('base64');
        const attachments = [
            { name: `${sanitizeFilename(programTitle || 'inscripcion')}.csv`, content: csvBase64 }
        ];

        // Attach all uploaded files
        for (const [key, file] of Object.entries(files)) {
            attachments.push({
                name: file.filename,
                content: file.buffer.toString('base64')
            });
        }

        const adminBody = {
            sender: { email: senderEmail },
            to: programAdminRecipients(program),
            subject: `Nueva Inscripción: ${programTitle}`,
            htmlContent: `<h2>Nueva inscripción recibida</h2><p>Se adjunta el archivo CSV con los registros y los documentos adjuntos de <b>${fields.nombre} ${fields.apellidos}</b>.</p>`,
            attachment: attachments
        };

        const brevoRes = await sendBrevoEmail(adminBody, {
            route,
            requestId,
            kind: "admin",
            programSlug,
        });

        // Log email attempt
        if (submissionId) {
            await logEmailAttempt({
                submissionId,
                route,
                kind: "admin",
                recipients: programAdminRecipients(program).map(r => r.email),
                subject: `Nueva Inscripción: ${programTitle}`,
                status: brevoRes.ok ? "sent" : "failed",
                brevoMessageId: brevoRes.ok ? undefined : undefined,
                failureReason: brevoRes.ok ? undefined : `brevo_status_${brevoRes.status}`,
                idempotencyKey: `${submissionRequestId}_admin`,
                brevoStatusCode: brevoRes.ok ? undefined : brevoRes.status,
            });
        }

        if (!brevoRes.ok) {
            return new Response(
                JSON.stringify({
                    message:
                        "Recibimos tu solicitud pero no pudimos notificar al equipo. Por favor contacta a Control Escolar.",
                    code: "admin_email_failed",
                }),
                { status: 502, headers: { 'Content-Type': 'application/json' } },
            );
        }

        return new Response(JSON.stringify({ message: 'Inscripción exitosa' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
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
