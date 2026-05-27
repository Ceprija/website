import type { CollectionEntry } from "astro:content";

/**
 * Determines which enrollment flow a program should use.
 *
 * - **inline** (`ContinuousEducationForm` en la ficha del programa): cursos, webinars, talleres y
 *   cualquier programa cuyo registro sea “directo”.
 * - **application** (`/enrollment/[slug]`): maestría, doctorado, especialidad por defecto,
 *   diplomados, o override explícito (p. ej. taller con `variantOptions` para módulo/fecha y Stripe).
 */
export function getEnrollmentFlow(
  program: CollectionEntry<"programas">
): "inline" | "application" {
  // Diplomados must collect the same extended applicant data as posgrados, then
  // continue to the existing payment step after the application is submitted.
  if (program.data.nivel === "diplomado") {
    return "application";
  }

  // Explicit override takes precedence
  if (program.data.enrollmentFlow) {
    return program.data.enrollmentFlow;
  }

  // Smart default based on nivel
  const complexNiveles = ["maestria", "doctorado", "especialidad"];
  return complexNiveles.includes(program.data.nivel) ? "application" : "inline";
}

/**
 * Check if a program requires the full admission/application process.
 */
export function requiresFullAdmission(program: CollectionEntry<"programas">): boolean {
  return getEnrollmentFlow(program) === "application";
}
