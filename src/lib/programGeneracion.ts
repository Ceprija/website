import type { ProgramaNivel } from "@lib/programNiveles";

/**
 * Cohort generation labels for Sept 2026 posgrado intake (ficha / form display).
 * Hardcoded for this cycle; prefer optional `generacion` on program frontmatter later.
 */
const GENERACION_BY_NIVEL: Partial<Record<ProgramaNivel, string>> = {
  maestria: "2026C -2028B",
  doctorado: "2026C -2028C",
  especialidad: "2026C -2027B",
};

/** Resolve generación from content `nivel`. */
export function generacionFromNivel(
  nivel: string | undefined | null,
): string {
  if (!nivel) return "";
  return GENERACION_BY_NIVEL[nivel as ProgramaNivel] ?? "";
}

/**
 * Resolve generación from a program title when nivel is unavailable
 * (e.g. InscriptionForm select of titles only).
 */
export function generacionFromProgramTitle(title: string): string {
  const t = title.trim().toLocaleLowerCase("es");
  if (t.includes("doctorado")) return GENERACION_BY_NIVEL.doctorado ?? "";
  if (t.includes("especialidad")) return GENERACION_BY_NIVEL.especialidad ?? "";
  if (t.includes("maestría") || t.includes("maestria")) {
    return GENERACION_BY_NIVEL.maestria ?? "";
  }
  return "";
}
