/**
 * Allowed `nivel` values for `programas` content collection.
 * Keep in sync with frontmatter in `src/content/programas/*.md`.
 */
export const PROGRAMA_NIVELES_TUPLE = [
  "curso",
  "diplomado",
  "doctorado",
  "especialidad",
  "maestria",
] as const;

export type ProgramaNivel = (typeof PROGRAMA_NIVELES_TUPLE)[number];
