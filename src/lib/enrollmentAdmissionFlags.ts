import type { ProgramaNivel } from "./programNiveles";

/** Talleres con flujo de solicitud no requieren grados académicos ni títulos/cédulas. */
export function requiresAcademicDegreeSteps(nivel: ProgramaNivel): boolean {
  return nivel !== "taller";
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
