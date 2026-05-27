import type { ProgramaNivel } from "./programNiveles";

/** Cursos, webinars y talleres no requieren grados académicos ni títulos/cédulas. */
export function requiresAcademicDegreeSteps(nivel: ProgramaNivel): boolean {
  return nivel !== "taller" && nivel !== "curso" && nivel !== "webinar";
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
