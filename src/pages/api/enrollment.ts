export const prerender = false;

import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import Busboy from "busboy";
import crypto from "node:crypto";
import {
  sanitizeEmailSubjectLine,
  sanitizeMailAttachmentFileName,
} from "@lib/email/outboundMailGuards";
import { escapeHtml } from "@lib/htmlEscape";
import { fetchWithRetry } from "@lib/http/fetchWithRetry";
import {
  MAX_FILES_PER_REQUEST,
  MAX_UPLOAD_BYTES,
  validateUploadBuffer,
} from "@lib/uploads/fileValidation";
import { EMAIL_CONTROL_ESCOLAR, EMAIL_SOPORTE_WEB, KEY_API_BREVO } from "astro:env/server";
import { validateEnrollmentApplicationFields, validateFullDossierFields } from "@lib/validation/enrollment";
import { canonicalMexicoTenDigitPhone } from "@lib/validation/phone";
import PDFDocument from "pdfkit";

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

// Sanitizar texto para PDF (prevenir caracteres de control e inyecciones)
function sanitizeForPDF(input: string): string {
  if (!input) return "";

  // Remover caracteres de control (excepto espacios, tabs, newlines normales)
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Limitar longitud total para evitar PDFs enormes
  if (sanitized.length > 5000) {
    sanitized = sanitized.substring(0, 5000) + "... (truncado)";
  }

  return sanitized;
}

type EnrollmentPDFData = {
  applicationId: string;
  programTitle: string;
  modality: string;
  nombre: string;
  apellidos: string;
  genero: string;
  telefono: string;
  email: string;
  fechaNacimiento: string;
  curp: string;
  nacionalidad: string;
  entidadNacimiento: string;
  estadoCivil: string;
  calle: string;
  colonia: string;
  cp: string;
  ciudad: string;
  estadoDireccion: string;
  modalidadEstudio: string;
  ultimoGrado: string;
  carrera: string;
  institucion: string;
  fechaInicioLic: string;
  fechaFinLic: string;
  estadoLic: string;
  cedulaNum: string;
  capacidadDif: string;
  detalleCapacidad: string;
  enfCronica: string;
  detalleEnf: string;
  alergia: string;
  detalleAlergia: string;
  tratamiento: string;
  detalleTratamiento: string;
  contactoEmergencia: string;
  parentesco: string;
  telEmergencia: string;
  lenguaIndigena: string;
  ocupacion: string;
  origen: string;
  files: Array<{ filename: string; fieldname: string }>;
};

function generateEnrollmentPDF(data: EnrollmentPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 50,
      // Metadata segura sin PII
      info: {
        Title: "Solicitud de Admisión",
        Author: "Sistema CEPRIJA",
        Subject: "Expediente de Solicitud",
        Keywords: "admisión ceprija",
        CreationDate: new Date(),
        Producer: "", // Deshabilitar producer para no exponer versión PDFKit
      },
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header
    doc.fontSize(20).font("Helvetica-Bold").text("SOLICITUD DE ADMISIÓN", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(14)
      .font("Helvetica")
      .text("Centro de Preparación Integral en Materia Jurídica y Administrativa", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`ID de Solicitud: ${sanitizeForPDF(data.applicationId)}`, { align: "center" });
    doc.moveDown(1);

    // Línea separadora
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    // Programa
    doc.fontSize(14).font("Helvetica-Bold").text("PROGRAMA", { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica");
    doc.text(`Programa: ${sanitizeForPDF(data.programTitle)}`);
    doc.text(`Modalidad: ${sanitizeForPDF(data.modality)}`);
    doc.moveDown(1);

    // Información Personal
    doc.fontSize(14).font("Helvetica-Bold").text("INFORMACIÓN PERSONAL", { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica");
    doc.text(`Nombre completo: ${sanitizeForPDF(data.nombre)} ${sanitizeForPDF(data.apellidos)}`);
    doc.text(`Género: ${sanitizeForPDF(data.genero)}`);
    doc.text(`Fecha de nacimiento: ${sanitizeForPDF(data.fechaNacimiento)}`);
    doc.text(`CURP: ${sanitizeForPDF(data.curp)}`);
    doc.text(`Teléfono: ${sanitizeForPDF(data.telefono)}`);
    doc.text(`Email: ${sanitizeForPDF(data.email)}`);
    doc.text(`Nacionalidad: ${sanitizeForPDF(data.nacionalidad)}`);
    doc.text(`Entidad de nacimiento: ${sanitizeForPDF(data.entidadNacimiento)}`);
    doc.text(`Estado civil: ${sanitizeForPDF(data.estadoCivil)}`);
    doc.moveDown(1);

    // Domicilio
    doc.fontSize(14).font("Helvetica-Bold").text("DOMICILIO", { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica");
    doc.text(`Calle: ${sanitizeForPDF(data.calle)}`);
    doc.text(`Colonia: ${sanitizeForPDF(data.colonia)}`);
    doc.text(`Código Postal: ${sanitizeForPDF(data.cp)}`);
    doc.text(`Ciudad/Municipio: ${sanitizeForPDF(data.ciudad)}`);
    doc.text(`Estado: ${sanitizeForPDF(data.estadoDireccion)}`);
    doc.moveDown(1);

    // Formación Académica
    doc.fontSize(14).font("Helvetica-Bold").text("FORMACIÓN ACADÉMICA", { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica");
    doc.text(`Modalidad de estudio previa: ${sanitizeForPDF(data.modalidadEstudio)}`);
    doc.text(`Último grado de estudios: ${sanitizeForPDF(data.ultimoGrado)}`);
    doc.text(`Carrera cursada: ${sanitizeForPDF(data.carrera)}`);
    doc.text(`Institución de egreso: ${sanitizeForPDF(data.institucion)}`);
    doc.text(
      `Periodo: ${sanitizeForPDF(data.fechaInicioLic)} - ${sanitizeForPDF(data.fechaFinLic)}`,
    );
    doc.text(`Estado donde cursó: ${sanitizeForPDF(data.estadoLic)}`);
    doc.text(`Cédula profesional: ${sanitizeForPDF(data.cedulaNum || "No proporcionada")}`);
    doc.moveDown(1);

    // Información de Salud
    doc.fontSize(14).font("Helvetica-Bold").text("INFORMACIÓN DE SALUD", { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica");
    doc.text(`Capacidad diferente: ${sanitizeForPDF(data.capacidadDif)}`);
    if (data.detalleCapacidad) {
      doc
        .fontSize(9)
        .text(`   Detalle: ${sanitizeForPDF(data.detalleCapacidad)}`, { indent: 20 });
      doc.fontSize(10);
    }
    doc.text(`Enfermedad crónica: ${sanitizeForPDF(data.enfCronica)}`);
    if (data.detalleEnf) {
      doc.fontSize(9).text(`   Detalle: ${sanitizeForPDF(data.detalleEnf)}`, { indent: 20 });
      doc.fontSize(10);
    }
    doc.text(`Alergia: ${sanitizeForPDF(data.alergia)}`);
    if (data.detalleAlergia) {
      doc
        .fontSize(9)
        .text(`   Detalle: ${sanitizeForPDF(data.detalleAlergia)}`, { indent: 20 });
      doc.fontSize(10);
    }
    doc.text(`Tratamiento médico: ${sanitizeForPDF(data.tratamiento)}`);
    if (data.detalleTratamiento) {
      doc
        .fontSize(9)
        .text(`   Detalle: ${sanitizeForPDF(data.detalleTratamiento)}`, { indent: 20 });
      doc.fontSize(10);
    }
    doc.moveDown(1);

    // Contacto de Emergencia
    doc.fontSize(14).font("Helvetica-Bold").text("CONTACTO DE EMERGENCIA", { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica");
    doc.text(`Nombre: ${sanitizeForPDF(data.contactoEmergencia)}`);
    doc.text(`Parentesco: ${sanitizeForPDF(data.parentesco)}`);
    doc.text(`Teléfono: ${sanitizeForPDF(data.telEmergencia)}`);
    doc.moveDown(1);

    // Datos Complementarios
    doc.fontSize(14).font("Helvetica-Bold").text("DATOS COMPLEMENTARIOS", { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica");
    doc.text(`Habla lengua indígena: ${sanitizeForPDF(data.lenguaIndigena)}`);
    doc.text(`Ocupación actual: ${sanitizeForPDF(data.ocupacion)}`);
    doc.text(`¿Cómo se enteró?: ${sanitizeForPDF(data.origen)}`);
    doc.moveDown(1);

    // Documentos adjuntos (nueva página si es necesario)
    if (doc.y > 650) doc.addPage();
    doc.fontSize(14).font("Helvetica-Bold").text("DOCUMENTOS ADJUNTOS", { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica");
    data.files.forEach((f) => {
      doc.text(`• ${sanitizeForPDF(f.filename)} (${sanitizeForPDF(f.fieldname)})`);
    });
    doc.moveDown(1);

    // Footer
    doc
      .fontSize(8)
      .font("Helvetica")
      .text(
        `Fecha de recepción: ${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}`,
        { align: "center" },
      );

    doc.end();
  });
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

    // Personal extendido (ALWAYS required for enrollment)
    const genero = (fields.genero ?? "").trim();
    const fechaNacimiento = (fields.fechaNacimiento ?? "").trim();
    const curp = (fields.curp ?? "").trim();
    const nacionalidad = (fields.nacionalidad ?? "").trim();
    const entidadNacimiento = (fields.entidadNacimiento ?? "").trim();
    const estadoCivil = (fields.estadoCivil ?? "").trim();

    // Domicilio (ALWAYS required for enrollment)
    const calle = (fields.calle ?? "").trim();
    const colonia = (fields.colonia ?? "").trim();
    const cp = (fields.cp ?? "").trim();
    const ciudad = (fields.ciudad ?? "").trim();
    const estadoDireccion = (fields.estadoDireccion ?? "").trim();

    // Académicos extendidos (ALWAYS required for enrollment)
    const modalidadEstudio = (fields.modalidadEstudio ?? "").trim();
    const fechaInicioLic = (fields.fechaInicioLic ?? "").trim();
    const fechaFinLic = (fields.fechaFinLic ?? "").trim();
    const estadoLic = (fields.estadoLic ?? "").trim();

    // Salud (ALWAYS required for enrollment)
    const capacidadDif = (fields.capacidadDif ?? "").trim();
    const detalleCapacidad = (fields.detalleCapacidad ?? "").trim();
    const enfCronica = (fields.enfCronica ?? "").trim();
    const detalleEnf = (fields.detalleEnf ?? "").trim();
    const alergia = (fields.alergia ?? "").trim();
    const detalleAlergia = (fields.detalleAlergia ?? "").trim();
    const tratamiento = (fields.tratamiento ?? "").trim();
    const detalleTratamiento = (fields.detalleTratamiento ?? "").trim();

    // Emergencia (ALWAYS required for enrollment)
    const contactoEmergencia = (fields.contactoEmergencia ?? "").trim();
    const parentesco = (fields.parentesco ?? "").trim();
    const telEmergencia = (fields.telEmergencia ?? "").trim();
    const lenguaIndigena = (fields.lenguaIndigena ?? "").trim();
    const ocupacion = (fields.ocupacion ?? "").trim();
    const origen = (fields.origen ?? "").trim();

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

    const formatErr = validateEnrollmentApplicationFields(fields);
    if (formatErr) {
      return new Response(
        JSON.stringify({
          error: formatErr.error,
          code: formatErr.code,
          ...(formatErr.field && { field: formatErr.field }),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Validate full dossier fields (all 37 additional fields)
    const dossierErr = validateFullDossierFields(fields);
    if (dossierErr) {
      return new Response(
        JSON.stringify({
          error: dossierErr.error,
          code: dossierErr.code,
          ...(dossierErr.field && { field: dossierErr.field }),
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

    // Normalize phones to 10 digits
    const telefonoCanonical = canonicalMexicoTenDigitPhone(telefono);
    const telEmergenciaCanonical = telEmergencia
      ? canonicalMexicoTenDigitPhone(telEmergencia)
      : "";

    // Generate CSV with all enrollment fields (42 fields)
    console.log(`[${applicationId}] Generando CSV y PDF para solicitud de admisión`);

    const csvHeaders = [
      "Fecha",
      "ID Solicitud",
      "Programa",
      "Modalidad",
      "Nombre",
      "Apellidos",
      "Género",
      "Teléfono",
      "Email",
      "Fecha Nacimiento",
      "CURP",
      "Nacionalidad",
      "Entidad Nacimiento",
      "Estado Civil",
      "Calle",
      "Colonia",
      "CP",
      "Ciudad",
      "Estado",
      "Modalidad Estudio",
      "Grado Estudios",
      "Carrera",
      "Institución",
      "Fecha Inicio Lic",
      "Fecha Fin Lic",
      "Estado Lic",
      "Cédula Num",
      "Capacidad Dif",
      "Detalle Capacidad",
      "Enf Crónica",
      "Detalle Enf",
      "Alergia",
      "Detalle Alergia",
      "Tratamiento",
      "Detalle Tratamiento",
      "Contacto Emergencia",
      "Parentesco",
      "Tel Emergencia",
      "Lengua Indígena",
      "Ocupación",
      "Origen",
      "CV",
      "Kardex",
      "Título",
      "Cédula",
      "Acta Nac",
      "CURP Doc",
      "Comp Dom",
      "INE",
    ];

    const escapeCSVCell = (val: string) => {
      const str = (val || "").toString().toUpperCase();
      return `"${str.replace(/"/g, '""')}"`;
    };

    const csvRow = [
      new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" }),
      applicationId,
      programTitle,
      modality,
      nombre,
      apellidos,
      genero,
      telefonoCanonical,
      email,
      fechaNacimiento,
      curp,
      nacionalidad,
      entidadNacimiento,
      estadoCivil,
      calle,
      colonia,
      cp,
      ciudad,
      estadoDireccion,
      modalidadEstudio,
      ultimoGrado,
      carrera,
      institucion,
      fechaInicioLic,
      fechaFinLic,
      estadoLic,
      cedulaNum,
      capacidadDif,
      detalleCapacidad,
      enfCronica,
      detalleEnf,
      alergia,
      detalleAlergia,
      tratamiento,
      detalleTratamiento,
      contactoEmergencia,
      parentesco,
      telEmergenciaCanonical,
      lenguaIndigena,
      ocupacion,
      origen,
      files.find((f) => f.fieldname === "cv")?.filename || "",
      files.find((f) => f.fieldname === "kardex")?.filename || "",
      files.find((f) => f.fieldname === "titulo")?.filename || "",
      files.find((f) => f.fieldname === "cedula")?.filename || "",
      files.find((f) => f.fieldname === "actaNacimiento")?.filename || "",
      files.find((f) => f.fieldname === "curpDoc")?.filename || "",
      files.find((f) => f.fieldname === "comprobanteDom")?.filename || "",
      files.find((f) => f.fieldname === "ineDoc")?.filename || "",
    ].map(escapeCSVCell);

    const csvContent = csvHeaders.join(",") + "\n" + csvRow.join(",");
    const csvBase64 = Buffer.from(csvContent).toString("base64");

    // Generate PDF with all enrollment data
    const pdfBuffer = await generateEnrollmentPDF({
      applicationId,
      programTitle,
      modality,
      nombre,
      apellidos,
      genero,
      telefono: telefonoCanonical,
      email,
      fechaNacimiento,
      curp,
      nacionalidad,
      entidadNacimiento,
      estadoCivil,
      calle,
      colonia,
      cp,
      ciudad,
      estadoDireccion,
      modalidadEstudio,
      ultimoGrado,
      carrera,
      institucion,
      fechaInicioLic,
      fechaFinLic,
      estadoLic,
      cedulaNum,
      capacidadDif,
      detalleCapacidad,
      enfCronica,
      detalleEnf,
      alergia,
      detalleAlergia,
      tratamiento,
      detalleTratamiento,
      contactoEmergencia,
      parentesco,
      telEmergencia: telEmergenciaCanonical,
      lenguaIndigena,
      ocupacion,
      origen,
      files: files.map((f) => ({ filename: f.filename, fieldname: f.fieldname })),
    });

    const pdfBase64 = pdfBuffer.toString("base64");
    console.log(`[${applicationId}] PDF generado exitosamente (${pdfBuffer.length} bytes)`);

    // Prepare enhanced HTML email with all fields
    const adminHtml = `
      <h2>Nueva Solicitud de Admisión - Expediente Completo</h2>
      <p><strong>ID de Solicitud:</strong> ${escapeHtml(applicationId)}</p>
      <p><strong>Fecha:</strong> ${new Date().toLocaleString("es-MX")}</p>
      <hr />
      
      <h3>Programa</h3>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold; width: 40%;">Programa</td>
          <td>${escapeHtml(programTitle)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Modalidad</td>
          <td>${escapeHtml(modality)}</td>
        </tr>
      </table>
      
      <h3>Información Personal</h3>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold; width: 40%;">Nombre Completo</td>
          <td>${escapeHtml(nombre)} ${escapeHtml(apellidos)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Género</td>
          <td>${escapeHtml(genero)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Fecha de Nacimiento</td>
          <td>${escapeHtml(fechaNacimiento)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">CURP</td>
          <td>${escapeHtml(curp)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Teléfono</td>
          <td>${escapeHtml(telefonoCanonical)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Email</td>
          <td>${escapeHtml(email)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Nacionalidad</td>
          <td>${escapeHtml(nacionalidad)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Entidad de Nacimiento</td>
          <td>${escapeHtml(entidadNacimiento)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Estado Civil</td>
          <td>${escapeHtml(estadoCivil)}</td>
        </tr>
      </table>
      
      <h3>Domicilio</h3>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold; width: 40%;">Calle y Número</td>
          <td>${escapeHtml(calle)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Colonia</td>
          <td>${escapeHtml(colonia)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Código Postal</td>
          <td>${escapeHtml(cp)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Ciudad/Municipio</td>
          <td>${escapeHtml(ciudad)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Estado</td>
          <td>${escapeHtml(estadoDireccion)}</td>
        </tr>
      </table>
      
      <h3>Formación Académica</h3>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold; width: 40%;">Modalidad de Estudio Previa</td>
          <td>${escapeHtml(modalidadEstudio)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Último Grado</td>
          <td>${escapeHtml(ultimoGrado)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Carrera</td>
          <td>${escapeHtml(carrera)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Institución</td>
          <td>${escapeHtml(institucion)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Periodo de Estudios</td>
          <td>${escapeHtml(fechaInicioLic)} - ${escapeHtml(fechaFinLic)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Estado donde cursó</td>
          <td>${escapeHtml(estadoLic)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Cédula Profesional</td>
          <td>${escapeHtml(cedulaNum || "No proporcionada")}</td>
        </tr>
      </table>
      
      <h3>Información de Salud</h3>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold; width: 40%;">Capacidad Diferente</td>
          <td>${escapeHtml(capacidadDif)}${detalleCapacidad ? ` - ${escapeHtml(detalleCapacidad)}` : ""}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Enfermedad Crónica</td>
          <td>${escapeHtml(enfCronica)}${detalleEnf ? ` - ${escapeHtml(detalleEnf)}` : ""}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Alergia</td>
          <td>${escapeHtml(alergia)}${detalleAlergia ? ` - ${escapeHtml(detalleAlergia)}` : ""}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Tratamiento Médico</td>
          <td>${escapeHtml(tratamiento)}${detalleTratamiento ? ` - ${escapeHtml(detalleTratamiento)}` : ""}</td>
        </tr>
      </table>
      
      <h3>Contacto de Emergencia</h3>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold; width: 40%;">Nombre de Contacto</td>
          <td>${escapeHtml(contactoEmergencia)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Parentesco</td>
          <td>${escapeHtml(parentesco)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Teléfono de Emergencia</td>
          <td>${escapeHtml(telEmergenciaCanonical)}</td>
        </tr>
      </table>
      
      <h3>Datos Complementarios</h3>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold; width: 40%;">Habla Lengua Indígena</td>
          <td>${escapeHtml(lenguaIndigena)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">Ocupación Actual</td>
          <td>${escapeHtml(ocupacion)}</td>
        </tr>
        <tr>
          <td style="background-color: #f3f4f6; font-weight: bold;">¿Cómo se enteró?</td>
          <td>${escapeHtml(origen)}</td>
        </tr>
      </table>
      
      <h3>Documentos Adjuntos</h3>
      <ul>
        ${files.map((f) => `<li>${escapeHtml(f.filename)} (${escapeHtml(f.fieldname)})</li>`).join("")}
      </ul>
      
      <hr />
      <p><em>Ver archivos adjuntos:</em></p>
      <ul>
        <li><strong>CSV:</strong> Para procesamiento en Excel/hojas de cálculo (control escolar)</li>
        <li><strong>PDF:</strong> Para revisión visual legible y archivo imprimible</li>
      </ul>
      <p style="color: #666; font-size: 12px;">Fecha de recepción: ${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}</p>
    `;

    // Prepare attachments: uploaded files + CSV + PDF
    const attachment = files.map((f) => ({
      name: sanitizeMailAttachmentFileName(f.filename),
      content: f.buffer.toString("base64"),
    }));

    // Add CSV attachment (nombre de archivo sin PII)
    attachment.push({
      name: sanitizeMailAttachmentFileName(`enrollment-${applicationId.slice(0, 8)}.csv`),
      content: csvBase64,
    });

    // Add PDF attachment (nombre de archivo sin PII)
    attachment.push({
      name: sanitizeMailAttachmentFileName(`enrollment-${applicationId.slice(0, 8)}.pdf`),
      content: pdfBase64,
    });

    const adminRes = await fetchWithRetry(
      "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",
        headers: {
          "api-key": brevoKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: { email: senderEmail, name: "Sistema CEPRIJA" },
          to: adminRecipients,
          subject: sanitizeEmailSubjectLine(
            `Nueva Solicitud de Admisión - ${programTitle} - ${nombre} ${apellidos}`,
          ),
          htmlContent: adminHtml,
          attachment,
        }),
      },
      {
        label: `[${applicationId}] Brevo institucional (admisión)`,
        maxAttempts: 4,
        baseDelayMs: 400,
      },
    );

    const adminErrText = adminRes.ok ? "" : await adminRes.text();
    if (!adminRes.ok) {
      console.error("[enrollment] Brevo admin error:", adminRes.status, adminErrText);
      // Sin este correo no hay “registro” operativo para control escolar (no hay BD propia).
      return new Response(
        JSON.stringify({
          error:
            "No pudimos entregar tu expediente al correo institucional en este momento (servicio de correo). Por favor intenta de nuevo en unos minutos o contacta soporte.",
          code: "institutional_email_failed",
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const safeNombre = escapeHtml(nombre);
    const safeApellidos = escapeHtml(apellidos);
    const safeProgramTitle = escapeHtml(programTitle);
    const safeModality = escapeHtml(modality);

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

    const userRes = await fetchWithRetry(
      "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",
        headers: {
          "api-key": brevoKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: { email: senderEmail, name: "CEPRIJA" },
          to: [{ email }],
          subject: sanitizeEmailSubjectLine(`Solicitud Recibida - ${programTitle}`),
          htmlContent: userHtml,
        }),
      },
      {
        label: `[${applicationId}] Brevo participante (admisión)`,
        maxAttempts: 4,
        baseDelayMs: 400,
      },
    );

    const emailWarnings: string[] = [];
    if (!userRes.ok) {
      const userErrText = await userRes.text();
      console.error("[enrollment] Brevo user error:", userRes.status, userErrText);
      emailWarnings.push("user_confirmation_failed");
    }

    return new Response(
      JSON.stringify({
        success: true,
        applicationId,
        message: "Solicitud enviada exitosamente",
        ...(emailWarnings.length > 0 && { emailWarnings }),
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
