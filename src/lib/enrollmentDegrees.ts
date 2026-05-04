/**
 * Minimum academic degrees required per program nivel for the admission flow at
 * `/enrollment/[slug]`. Centralizing the rule here keeps the Astro page, the API
 * validator, and future reporting consistent.
 *
 * Rules (as of May 2026):
 * - `maestria` and `especialidad`: at least 1 Licenciatura
 * - `doctorado`: at least 1 Licenciatura AND at least 1 Maestría
 * - Other niveles (`curso`, `taller`, `diplomado`): no prerequisites; these programs
 *   don't use the application flow, but we return an empty list as a safe default.
 *
 * Users can always add more degrees on top of the initial list.
 */
import type { ProgramaNivel } from "./programNiveles";

export const DEGREE_LEVELS = ["Licenciatura", "Especialidad", "Maestría", "Doctorado"] as const;
export type DegreeLevel = (typeof DEGREE_LEVELS)[number];

/** Chronological ordering for validation. Especialidad and Maestría are treated as the same tier. */
export const DEGREE_ORDER: Record<DegreeLevel, number> = {
  Licenciatura: 1,
  Especialidad: 2,
  Maestría: 2,
  Doctorado: 3,
};

export type InitialDegree = {
  grado: DegreeLevel;
  /** When true, the UI prevents the user from removing this entry below the program minimum. */
  locked: boolean;
};

export function getInitialDegreesForNivel(nivel: ProgramaNivel): InitialDegree[] {
  if (nivel === "doctorado") {
    return [
      { grado: "Licenciatura", locked: true },
      { grado: "Maestría", locked: true },
    ];
  }
  if (nivel === "maestria" || nivel === "especialidad") {
    return [{ grado: "Licenciatura", locked: true }];
  }
  return [];
}

/**
 * Server-side check mirroring the client-side rule. Returns null when the array
 * satisfies the program's minimums or a localized Spanish error string otherwise.
 */
export function validateMinimumDegrees(
  nivel: ProgramaNivel,
  degrees: Array<{ grado: string }>,
): string | null {
  const licenciaturas = degrees.filter((d) => d.grado === "Licenciatura").length;
  const maestrias = degrees.filter((d) => d.grado === "Maestría").length;

  if (nivel === "maestria" || nivel === "especialidad") {
    if (licenciaturas === 0) {
      return "Este programa requiere al menos una Licenciatura.";
    }
    return null;
  }
  if (nivel === "doctorado") {
    if (licenciaturas === 0 || maestrias === 0) {
      return "El Doctorado requiere al menos una Licenciatura y una Maestría.";
    }
    return null;
  }
  return null;
}
