import type { ProgramaNivel } from "./programNiveles";

/** Cursos, webinars y talleres no requieren grados académicos ni títulos/cédulas. */
export function requiresAcademicDegreeSteps(nivel: ProgramaNivel): boolean {
  return nivel !== "taller" && nivel !== "curso" && nivel !== "webinar";
}

/**
 * Same programs as academic degree steps: personal dossier uploads are required
 * on the application flow (field names match long inscription).
 */
export function requiresPersonalDossierUploads(nivel: ProgramaNivel): boolean {
  return requiresAcademicDegreeSteps(nivel);
}

/** Form field names shared with `/api/inscription` for portal/expediente parity. */
export const PERSONAL_DOSSIER_FILE_FIELDS = [
  "actaNacimiento",
  "curpDoc",
  "ineDoc",
  "comprobanteDom",
] as const;

export type PersonalDossierFileField =
  (typeof PERSONAL_DOSSIER_FILE_FIELDS)[number];

const ENROLLMENT_FILE_FIELD_LABELS: Record<string, string> = {
  actaNacimiento: "Acta de nacimiento",
  curpDoc: "CURP (archivo)",
  ineDoc: "INE o Pasaporte",
  comprobanteDom: "Comprobante de domicilio",
  cv: "Curriculum Vitae (CV)",
};

export function enrollmentFileFieldLabel(field: string): string {
  if (ENROLLMENT_FILE_FIELD_LABELS[field]) {
    return ENROLLMENT_FILE_FIELD_LABELS[field];
  }
  const degree = /^degree_(\d+)_(titulo|cedula)$/.exec(field);
  if (degree) {
    const n = Number(degree[1]) + 1;
    return degree[2] === "titulo"
      ? `Título profesional (grado #${n})`
      : `Cédula profesional (grado #${n})`;
  }
  return field;
}

/**
 * Maestría, Doctorado, Especialidad y Diplomado: capturar domicilio, contacto
 * de emergencia e información de salud básica además de los datos personales.
 */
export function requiresExtendedApplicantProfile(nivel: ProgramaNivel): boolean {
  return (
    nivel === "maestria" ||
    nivel === "doctorado" ||
    nivel === "especialidad" ||
    nivel === "diplomado"
  );
}
