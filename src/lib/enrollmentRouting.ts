import type { CollectionEntry } from "astro:content";

/**
 * Determines which enrollment flow a program should use.
 *
 * - **inline** (`ContinuousEducationForm` en la ficha del programa): cursos, diplomados y
 *   cualquier programa cuyo registro sea “directo”. Varios planes de pago (`paymentOptions`)
 *   se eligen en ese formulario; no hace falta `/enrollment/[slug]` salvo que quieras el
 *   flujo largo de solicitud.
 * - **application** (`/enrollment/[slug]`): maestría, doctorado, especialidad por defecto,
 *   o override explícito (p. ej. taller con `variantOptions` para módulo/fecha y Stripe).
 *
 * No mezclar “solo para varios precios”: un diplomado con inscripción + total + cuotas debe
 * seguir en **inline** salvo que integres esos precios al flujo de aplicación por separado.
 */
export function getEnrollmentFlow(
  program: CollectionEntry<"programas">
): "inline" | "application" {
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
