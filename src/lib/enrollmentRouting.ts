import type { CollectionEntry } from "astro:content";

/**
 * Determines which enrollment flow a program should use.
 * Returns "application" for complex programs (maestria, doctorado, especialidad) requiring
 * CV, transcripts, and degree certificates.
 * Returns "inline" for simple programs (curso, diplomado) with basic registration.
 * 
 * Programs can explicitly override the default behavior via the enrollmentFlow frontmatter field.
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
