export const prerender = false;

import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import Busboy from "busboy";
import crypto from "node:crypto";
import { escapeHtml } from "@lib/htmlEscape";
import {
  MAX_UPLOAD_BYTES,
  validateUploadBuffer,
} from "@lib/uploads/fileValidation";
import {
  DEGREE_LEVELS,
  validateMinimumDegrees,
  type DegreeLevel,
} from "@lib/enrollmentDegrees";
import {
  stripControlChars,
  validateCedulaDoctorado,
  validateEmailBasic,
  validatePersonName,
  validatePhoneBasic,
} from "@lib/validation/enrollmentText";
import type { ProgramaNivel } from "@lib/programNiveles";
import { requiresExtendedApplicantProfile } from "@lib/enrollmentAdmissionFlags";
import { programIsPublished } from "@lib/programPublished";
import { validateFullDossierFields } from "@lib/validation/enrollment";
import { EMAIL_CONTROL_ESCOLAR, EMAIL_SOPORTE_WEB, KEY_API_BREVO } from "astro:env/server";
import { apiLog, getRequestId, jsonResponse } from "@lib/server/apiRequestLog";

const ALLOWED_DEGREE_LEVELS = new Set<string>(DEGREE_LEVELS);
/** Hard cap to bound memory when parsing indexed form fields. */
const MAX_DEGREE_ENTRIES = 10;
/**
 * Cap specific to this endpoint: one CV plus up to two documents per degree.
 * Overrides the shared `MAX_FILES_PER_REQUEST` because multi-degree submissions
 * can legitimately exceed the default cap of 12 used by simpler endpoints.
 */
const MAX_ENROLLMENT_FILES = 1 + MAX_DEGREE_ENTRIES * 2;
const MAX_ENROLLMENT_FILES_TALLER_ONLY = 1;

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

function enrollmentRespond(
  body: Record<string, unknown>,
  status: number,
  requestId: string,
  programSlug: string,
): Response {
  if (status >= 400) {
    apiLog(status >= 500 ? "error" : "warn", "POST /api/enrollment", "http_response", {
      requestId,
      httpStatus: status,
      code: typeof body.code === "string" ? body.code : undefined,
      programSlug: programSlug.trim() || undefined,
    });
  }
  return jsonResponse(body, status, requestId);
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
  const requestId = getRequestId(request);
  let programSlug = "";
  try {
    const { fields, files } = await parseFormData(request);
    const applicationId = crypto.randomUUID();

    // Required fields
    const nombre = (fields.nombre ?? "").trim();
    const apellidos = (fields.apellidos ?? "").trim();
    const email = (fields.email ?? "").trim();
    const telefono = (fields.telefono ?? "").trim();
    programSlug = (fields.programSlug ?? "").trim();
    const programTitle = (fields.programTitle ?? "").trim();
    const modality = (fields.modality ?? "").trim();

    // Multi-degree parsing: the client renders one `degree_{N}_...` block per
    // academic entry. We enumerate indices until we hit a hole, preserving the
    // user's insertion order (which may differ from the visual position after
    // removals). Unrecognized `grado` values are rejected because they'd bypass
    // our `nivel`-based minimum-requirement check.
    type ParsedDegree = {
      index: number;
      grado: DegreeLevel;
      carrera: string;
      institucion: string;
      cedulaNum: string;
    };
    const degrees: ParsedDegree[] = [];
    const degreeIndices: number[] = [];
    for (let i = 0; i < MAX_DEGREE_ENTRIES; i++) {
      const grado = (fields[`degree_${i}_grado`] ?? "").trim();
      const carrera = (fields[`degree_${i}_carrera`] ?? "").trim();
      const institucion = (fields[`degree_${i}_institucion`] ?? "").trim();
      const cedulaNum = (fields[`degree_${i}_cedulaNum`] ?? "").trim();
      const rowExists =
        grado || carrera || institucion || cedulaNum ||
        files.some((f) => f.fieldname.startsWith(`degree_${i}_`));
      if (!rowExists) continue;
      if (!ALLOWED_DEGREE_LEVELS.has(grado)) {
        return enrollmentRespond({
            error: "Grado académico no válido",
            code: "invalid_grado",
            field: `degree_${i}_grado`,
          }, 400, requestId, programSlug);
      }
      if (!carrera || !institucion || !cedulaNum) {
        return enrollmentRespond({
            error: "Faltan datos del grado académico",
            code: "missing_degree_fields",
            field: `degree_${i}`,
          }, 400, requestId, programSlug);
      }
      degrees.push({
        index: i,
        grado: grado as DegreeLevel,
        carrera,
        institucion,
        cedulaNum,
      });
      degreeIndices.push(i);
    }

    // Optional variant selections (only present when the program defines `variantOptions`).
    // We accept both the machine-friendly ID and the human-readable label so the
    // confirmation email can show the natural-language version without a second lookup.
    const selectedModule = (fields.selectedModule ?? "").trim().slice(0, 120);
    const selectedDate = (fields.selectedDate ?? "").trim().slice(0, 120);
    const selectedModuleLabel = (fields.selectedModuleLabel ?? "")
        .trim()
        .slice(0, 240);
    const selectedDateLabel = (fields.selectedDateLabel ?? "")
        .trim()
        .slice(0, 240);

    const programs = await getCollection("programas");
    const program = programs.find((p) => p.slug === programSlug || p.data.title === programTitle);
    if (program && !programIsPublished(program)) {
      return enrollmentRespond(
        { error: "Programa no disponible", code: "program_unavailable" },
        404,
        requestId,
        programSlug,
      );
    }
    const nivel = program?.data.nivel as ProgramaNivel | undefined;
    /** Talleres modulares (p. ej. con variantOptions) solo requieren CV, sin grados. */
    const skipAcademicDegrees = nivel === "taller";
    const needsExtendedProfile =
      !!nivel && requiresExtendedApplicantProfile(nivel);

    if (skipAcademicDegrees && degrees.length > 0) {
      return enrollmentRespond({
          error: "Este programa no requiere datos de grados académicos",
          code: "degrees_not_allowed",
        }, 400, requestId, programSlug);
    }

    const nombreS = stripControlChars(nombre);
    const apellidosS = stripControlChars(apellidos);
    const emailS = stripControlChars(email).toLowerCase();
    const telefonoS = stripControlChars(telefono);

    // Extended profile fields (maestría / doctorado / especialidad).
    // Mirrors the historical 7-step inscription form so admin records are complete.
    const trim = (raw: string | undefined) => stripControlChars((raw ?? "").trim());
    const generoS = trim(fields.genero);
    const fechaNacimientoS = trim(fields.fechaNacimiento);
    const curpS = trim(fields.curp).toUpperCase();
    const nacionalidadS = trim(fields.nacionalidad);
    const estadoCivilS = trim(fields.estadoCivil);
    const entidadNacimientoS = trim(fields.entidadNacimiento);
    const ocupacionS = trim(fields.ocupacion);
    const lenguaIndigenaS = trim(fields.lenguaIndigena);
    const origenS = trim(fields.origen);

    const calleS = trim(fields.calle);
    const coloniaS = trim(fields.colonia);
    const cpS = trim(fields.cp);
    const ciudadS = trim(fields.ciudad);
    const estadoDireccionS = trim(fields.estadoDireccion);

    const contactoEmergenciaS = trim(fields.contactoEmergencia);
    const parentescoS = trim(fields.parentesco);
    const telEmergenciaS = trim(fields.telEmergencia);

    const capacidadDifS = trim(fields.capacidadDif);
    const detalleCapacidadS = trim(fields.detalleCapacidad);
    const enfCronicaS = trim(fields.enfCronica);
    const detalleEnfS = trim(fields.detalleEnf);
    const alergiaS = trim(fields.alergia);
    const detalleAlergiaS = trim(fields.detalleAlergia);
    const tratamientoS = trim(fields.tratamiento);
    const detalleTratamientoS = trim(fields.detalleTratamiento);

    // Validation
    const missing: string[] = [];
    if (!nombreS) missing.push("nombre");
    if (!apellidosS) missing.push("apellidos");
    if (!emailS) missing.push("email");
    if (!telefonoS) missing.push("telefono");
    if (!programSlug && !programTitle) missing.push("programSlug/programTitle");
    if (!modality) missing.push("modality");
    if (!skipAcademicDegrees && degrees.length === 0) missing.push("degrees");

    if (!validateEmailBasic(emailS)) {
      return enrollmentRespond({ error: "Correo electrónico no válido", code: "invalid_email" }, 400, requestId, programSlug);
    }
    if (!validatePhoneBasic(telefonoS)) {
      return enrollmentRespond({ error: "Teléfono no válido", code: "invalid_phone" }, 400, requestId, programSlug);
    }
    if (!validatePersonName(nombreS) || !validatePersonName(apellidosS)) {
      return enrollmentRespond({
          error: "Nombre o apellidos contienen caracteres no permitidos",
          code: "invalid_name",
        }, 400, requestId, programSlug);
    }

    if (needsExtendedProfile) {
      // Personal data
      const requiredPersonal: Array<[string, string]> = [
        ["genero", generoS],
        ["fechaNacimiento", fechaNacimientoS],
        ["curp", curpS],
        ["nacionalidad", nacionalidadS],
        ["estadoCivil", estadoCivilS],
        ["entidadNacimiento", entidadNacimientoS],
        ["ocupacion", ocupacionS],
        ["lenguaIndigena", lenguaIndigenaS],
        ["origen", origenS],
        // Address
        ["calle", calleS],
        ["colonia", coloniaS],
        ["cp", cpS],
        ["ciudad", ciudadS],
        ["estadoDireccion", estadoDireccionS],
        // Emergency contact
        ["contactoEmergencia", contactoEmergenciaS],
        ["parentesco", parentescoS],
        ["telEmergencia", telEmergenciaS],
        // Health (Sí/No flags; details are conditional)
        ["capacidadDif", capacidadDifS],
        ["enfCronica", enfCronicaS],
        ["alergia", alergiaS],
        ["tratamiento", tratamientoS],
      ];
      for (const [name, val] of requiredPersonal) {
        if (!val) {
          return enrollmentRespond({
              error: `Falta el campo ${name}`,
              code: "missing_extended_field",
              field: name,
            }, 400, requestId, programSlug);
        }
      }

      // Re-use the central format checks (CP/CURP/limits/control chars).
      const dossierErr = validateFullDossierFields({
        cp: cpS,
        curp: curpS,
        telEmergencia: telEmergenciaS,
        calle: calleS,
        colonia: coloniaS,
        ciudad: ciudadS,
        genero: generoS,
        nacionalidad: nacionalidadS,
        estadoCivil: estadoCivilS,
        detalleCapacidad: detalleCapacidadS,
        detalleEnf: detalleEnfS,
        detalleAlergia: detalleAlergiaS,
        detalleTratamiento: detalleTratamientoS,
        contactoEmergencia: contactoEmergenciaS,
        ocupacion: ocupacionS,
      });
      if (dossierErr) {
        return enrollmentRespond({
            error: dossierErr.error,
            code: dossierErr.code,
            field: dossierErr.field,
          }, 400, requestId, programSlug);
      }

      // Birth date: ISO yyyy-mm-dd, applicant must be at least 18 years old.
      const birthDate = new Date(fechaNacimientoS);
      if (Number.isNaN(birthDate.getTime())) {
        return enrollmentRespond({
            error: "Fecha de nacimiento inválida",
            code: "invalid_birthdate",
            field: "fechaNacimiento",
          }, 400, requestId, programSlug);
      }
      const ageMs = Date.now() - birthDate.getTime();
      const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
      if (ageYears < 18 || ageYears > 120) {
        return enrollmentRespond({
            error: "Debe ser mayor de edad para inscribirse",
            code: "invalid_age",
            field: "fechaNacimiento",
          }, 400, requestId, programSlug);
      }

      // Conditional health details: required when the flag is "Sí".
      const conditional: Array<[string, string, string]> = [
        ["capacidadDif", capacidadDifS, detalleCapacidadS],
        ["enfCronica", enfCronicaS, detalleEnfS],
        ["alergia", alergiaS, detalleAlergiaS],
        ["tratamiento", tratamientoS, detalleTratamientoS],
      ];
      for (const [flag, flagVal, detail] of conditional) {
        if (flagVal === "Sí" && !detail) {
          return enrollmentRespond({
              error: `Indique el detalle para ${flag}`,
              code: "missing_health_detail",
              field: `detalle${flag.charAt(0).toUpperCase()}${flag.slice(1)}`,
            }, 400, requestId, programSlug);
        }
      }

      // Sí/No flags must be exact.
      for (const [flag, flagVal] of [
        ["capacidadDif", capacidadDifS],
        ["enfCronica", enfCronicaS],
        ["alergia", alergiaS],
        ["tratamiento", tratamientoS],
        ["lenguaIndigena", lenguaIndigenaS],
      ] as const) {
        if (flagVal !== "Sí" && flagVal !== "No") {
          return enrollmentRespond({
              error: `Valor inválido para ${flag}`,
              code: "invalid_yes_no",
              field: flag,
            }, 400, requestId, programSlug);
        }
      }

      // Person-name regex catches injection-style chars in the emergency contact.
      if (!validatePersonName(contactoEmergenciaS)) {
        return enrollmentRespond({
            error: "Contacto de emergencia contiene caracteres no permitidos",
            code: "invalid_emergency_name",
            field: "contactoEmergencia",
          }, 400, requestId, programSlug);
      }
    }

    if (!skipAcademicDegrees) {
      for (const d of degrees) {
        const carreraS = stripControlChars(d.carrera);
        const instS = stripControlChars(d.institucion);
        const cedS = stripControlChars(d.cedulaNum);
        if (!validatePersonName(carreraS) || !validatePersonName(instS)) {
          return enrollmentRespond({
              error: "Carrera o institución contienen caracteres no permitidos",
              code: "invalid_degree_text",
            }, 400, requestId, programSlug);
        }
        if (d.grado === "Doctorado" && !validateCedulaDoctorado(cedS)) {
          return enrollmentRespond({
              error: "La cédula profesional debe ser numérica de 7 u 8 dígitos",
              code: "invalid_cedula",
              field: `degree_${d.index}_cedulaNum`,
            }, 400, requestId, programSlug);
        }
      }
    }

    // Each declared degree must come with both its titulo and cedula. CV is a
    // single global file shared across the application.
    const uploadedFileFields = files.map((f) => f.fieldname);
    const missingFiles: string[] = [];
    if (!uploadedFileFields.includes("cv")) missingFiles.push("cv");
    if (!skipAcademicDegrees) {
      for (const d of degrees) {
        if (!uploadedFileFields.includes(`degree_${d.index}_titulo`)) {
          missingFiles.push(`degree_${d.index}_titulo`);
        }
        if (!uploadedFileFields.includes(`degree_${d.index}_cedula`)) {
          missingFiles.push(`degree_${d.index}_cedula`);
        }
      }
    }

    if (missing.length > 0 || missingFiles.length > 0) {
      return enrollmentRespond({
          error: "Faltan campos requeridos",
          code: "missing_fields",
          missing: [...missing, ...missingFiles.map((f) => `file:${f}`)],
        }, 400, requestId, programSlug);
    }

    // Reject stray files
    for (const f of files) {
      if (f.fieldname === "cv") continue;
      if (skipAcademicDegrees) {
        return enrollmentRespond({
            error: "Archivo no esperado para este programa",
            code: "unexpected_file",
            field: f.fieldname,
          }, 400, requestId, programSlug);
      }
      const match = /^degree_(\d+)_(titulo|cedula)$/.exec(f.fieldname);
      if (!match || !degreeIndices.includes(Number(match[1]))) {
        return enrollmentRespond({
            error: "Archivo no esperado",
            code: "unexpected_file",
            field: f.fieldname,
          }, 400, requestId, programSlug);
      }
    }

    const maxEnrollmentFiles = skipAcademicDegrees
      ? MAX_ENROLLMENT_FILES_TALLER_ONLY
      : MAX_ENROLLMENT_FILES;

    // Validate file count and contents
    if (files.length > maxEnrollmentFiles) {
      return enrollmentRespond({
          error: "Demasiados archivos adjuntos",
          code: "too_many_files",
        }, 400, requestId, programSlug);
    }

    for (const file of files) {
      if (file.buffer.length === 0) continue;
      const v = validateUploadBuffer(file.buffer, file.mimetype, { field: file.fieldname });
      if (!v.ok) {
        return enrollmentRespond({
            error: v.err.error,
            code: v.err.code,
            field: v.err.field ?? file.fieldname,
          }, 400, requestId, programSlug);
      }
    }

    // Per-nivel minimum degree check (e.g. Doctorado needs Licenciatura + Maestría).
    if (program && !skipAcademicDegrees) {
      const minErr = validateMinimumDegrees(program.data.nivel, degrees);
      if (minErr) {
        return enrollmentRespond({
            error: minErr,
            code: "insufficient_degrees",
          }, 400, requestId, programSlug);
      }
    }

    // Server-side variant validation: when the program defines `variantOptions`,
    // the submitted IDs must match one of the configured options. Stops the user
    // from posting arbitrary strings and protects downstream consumers (CSV /
    // Stripe metadata) from unexpected values.
    type VariantOptionsShape = {
      moduleSelection?: { required?: boolean; options: { id: string }[] };
      dateSelection?: { required?: boolean; options: { id: string }[] };
    };
    const programVariants =
      (program?.data as { variantOptions?: VariantOptionsShape } | undefined)
        ?.variantOptions;
    if (programVariants?.moduleSelection) {
      const moduleRequired = programVariants.moduleSelection.required !== false;
      const moduleIds = programVariants.moduleSelection.options.map((o) => o.id);
      if (moduleRequired && !selectedModule) {
        return enrollmentRespond({
            error: "Selecciona el módulo o paquete",
            code: "missing_variant_module",
            field: "selectedModule",
          }, 400, requestId, programSlug);
      }
      if (selectedModule && !moduleIds.includes(selectedModule)) {
        return enrollmentRespond({
            error: "Opción de módulo no válida",
            code: "invalid_variant_module",
            field: "selectedModule",
          }, 400, requestId, programSlug);
      }
    }
    if (programVariants?.dateSelection) {
      const dateRequired = programVariants.dateSelection.required !== false;
      const dateIds = programVariants.dateSelection.options.map((o) => o.id);
      if (dateRequired && !selectedDate) {
        return enrollmentRespond({
            error: "Selecciona la fecha de inicio",
            code: "missing_variant_date",
            field: "selectedDate",
          }, 400, requestId, programSlug);
      }
      if (selectedDate && !dateIds.includes(selectedDate)) {
        return enrollmentRespond({
            error: "Fecha de inicio no válida",
            code: "invalid_variant_date",
            field: "selectedDate",
          }, 400, requestId, programSlug);
      }
    }

    const brevoKey = (KEY_API_BREVO ?? "").trim();
    const senderEmail = (EMAIL_SOPORTE_WEB ?? "").trim() || "desarrolloweb@ceprija.edu.mx";
    const controlEscolar = (EMAIL_CONTROL_ESCOLAR ?? "").trim() || "controlescolar@ceprija.edu.mx";

    if (!brevoKey) {
      return enrollmentRespond({
          error: "Correo no configurado en el servidor (KEY_API_BREVO)",
          code: "brevo_not_configured",
        }, 503, requestId, programSlug);
    }

    const adminRecipients = [
      { email: controlEscolar },
      ...(senderEmail !== controlEscolar ? [{ email: senderEmail }] : []),
    ];

    // Prepare email content with escaped values (use sanitized strings)
    const safeNombre = escapeHtml(nombreS);
    const safeApellidos = escapeHtml(apellidosS);
    const safeEmail = escapeHtml(emailS);
    const safeTelefono = escapeHtml(telefonoS);
    const safeProgramTitle = escapeHtml(programTitle || program?.data.title || "Programa");
    const safeModality = escapeHtml(modality);

    // Variant lines render only when the program had a variant step. We prefer
    // the human label captured client-side and fall back to the ID otherwise.
    const variantModuleDisplay = selectedModuleLabel || selectedModule;
    const variantDateDisplay = selectedDateLabel || selectedDate;
    const variantHtml = variantModuleDisplay || variantDateDisplay
      ? `
      <hr />
      <h3>Opciones del Programa</h3>
      ${variantModuleDisplay ? `<p><strong>Módulo / paquete:</strong> ${escapeHtml(variantModuleDisplay)}</p>` : ""}
      ${variantDateDisplay ? `<p><strong>Fecha de inicio:</strong> ${escapeHtml(variantDateDisplay)}</p>` : ""}
    `
      : "";

    // Render one row per declared degree. The table makes multi-degree
    // Doctorado submissions easy to scan for admissions staff.
    const degreesTableHtml = degrees.length
      ? `
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          <thead>
            <tr style="background:#f3f4f6;text-align:left;">
              <th style="padding:8px;border:1px solid #e5e7eb;">#</th>
              <th style="padding:8px;border:1px solid #e5e7eb;">Grado</th>
              <th style="padding:8px;border:1px solid #e5e7eb;">Carrera</th>
              <th style="padding:8px;border:1px solid #e5e7eb;">Institución</th>
              <th style="padding:8px;border:1px solid #e5e7eb;">Cédula</th>
            </tr>
          </thead>
          <tbody>
            ${degrees
              .map(
                (d, i) => `
              <tr>
                <td style="padding:8px;border:1px solid #e5e7eb;">${i + 1}</td>
                <td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(d.grado)}</td>
                <td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(d.carrera)}</td>
                <td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(d.institucion)}</td>
                <td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(d.cedulaNum)}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      `
      : "<p>No se proporcionaron grados académicos.</p>";

    const detailIfYes = (flag: string, detail: string) =>
      flag === "Sí" && detail
        ? ` — ${escapeHtml(detail)}`
        : "";

    const extendedProfileHtml = needsExtendedProfile
      ? `
      <hr />
      <h3>Datos personales adicionales</h3>
      <p><strong>Género:</strong> ${escapeHtml(generoS)}</p>
      <p><strong>Fecha de nacimiento:</strong> ${escapeHtml(fechaNacimientoS)}</p>
      <p><strong>CURP:</strong> ${escapeHtml(curpS)}</p>
      <p><strong>Nacionalidad:</strong> ${escapeHtml(nacionalidadS)}</p>
      <p><strong>Estado civil:</strong> ${escapeHtml(estadoCivilS)}</p>
      <p><strong>Entidad de nacimiento:</strong> ${escapeHtml(entidadNacimientoS)}</p>
      <p><strong>Ocupación:</strong> ${escapeHtml(ocupacionS)}</p>
      <p><strong>¿Habla lengua indígena?:</strong> ${escapeHtml(lenguaIndigenaS)}</p>
      <p><strong>¿Cómo se enteró de nosotros?:</strong> ${escapeHtml(origenS)}</p>
      <hr />
      <h3>Dirección</h3>
      <p><strong>Calle:</strong> ${escapeHtml(calleS)}</p>
      <p><strong>Colonia:</strong> ${escapeHtml(coloniaS)}</p>
      <p><strong>CP:</strong> ${escapeHtml(cpS)}</p>
      <p><strong>Ciudad:</strong> ${escapeHtml(ciudadS)}</p>
      <p><strong>Estado:</strong> ${escapeHtml(estadoDireccionS)}</p>
      <hr />
      <h3>Contacto de emergencia</h3>
      <p><strong>Nombre:</strong> ${escapeHtml(contactoEmergenciaS)}</p>
      <p><strong>Parentesco:</strong> ${escapeHtml(parentescoS)}</p>
      <p><strong>Teléfono:</strong> ${escapeHtml(telEmergenciaS)}</p>
      <hr />
      <h3>Información de salud</h3>
      <p><strong>Capacidad diferente:</strong> ${escapeHtml(capacidadDifS)}${detailIfYes(capacidadDifS, detalleCapacidadS)}</p>
      <p><strong>Enfermedad crónica:</strong> ${escapeHtml(enfCronicaS)}${detailIfYes(enfCronicaS, detalleEnfS)}</p>
      <p><strong>Alergia:</strong> ${escapeHtml(alergiaS)}${detailIfYes(alergiaS, detalleAlergiaS)}</p>
      <p><strong>Tratamiento médico:</strong> ${escapeHtml(tratamientoS)}${detailIfYes(tratamientoS, detalleTratamientoS)}</p>
    `
      : "";

    const adminHtml = `
      <h2>Nueva Solicitud de Admisión</h2>
      <p><strong>ID de Solicitud:</strong> ${escapeHtml(applicationId)}</p>
      <hr />
      <h3>Programa</h3>
      <p><strong>Programa:</strong> ${safeProgramTitle}</p>
      <p><strong>Modalidad:</strong> ${safeModality}</p>
      ${variantHtml}
      <hr />
      <h3>Información del Aspirante</h3>
      <p><strong>Nombre:</strong> ${safeNombre} ${safeApellidos}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><strong>Teléfono:</strong> ${safeTelefono}</p>
      ${extendedProfileHtml}
      <hr />
      <h3>Formación Académica</h3>
      ${degreesTableHtml}
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
        subject: `Nueva Solicitud de Admisión - ${programTitle} - ${nombreS} ${apellidosS}`,
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
            ${variantModuleDisplay ? `<p><strong>Módulo / paquete:</strong> ${escapeHtml(variantModuleDisplay)}</p>` : ""}
            ${variantDateDisplay ? `<p><strong>Fecha de inicio:</strong> ${escapeHtml(variantDateDisplay)}</p>` : ""}
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

    return jsonResponse({
        success: true,
        applicationId,
        message: "Solicitud enviada exitosamente",
      }, 200, requestId);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "file_too_large"
    ) {
      return enrollmentRespond({
          error: "Archivo demasiado grande (máx. 10 MB)",
          code: "file_too_large",
          ...("field" in error && typeof (error as { field?: string }).field === "string"
            ? { field: (error as { field: string }).field }
            : {}),
        }, 400, requestId, programSlug);
    }
    console.error("[enrollment] Internal error:", error);
    apiLog("error", "POST /api/enrollment", "internal_error", {
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
