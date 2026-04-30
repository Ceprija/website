/**
 * Program levels stored in content collection `programas` (`nivel` in frontmatter).
 * Keep in sync: `src/content.config.ts` uses the same tuple for Zod.
 */
export const PROGRAMA_NIVELES = [
  "curso",
  "taller",
  "diplomado",
  "maestria",
  "doctorado",
  "especialidad",
] as const;

export type ProgramaNivel = (typeof PROGRAMA_NIVELES)[number];

/** Zod-friendly tuple (non-empty). */
export const PROGRAMA_NIVELES_TUPLE = PROGRAMA_NIVELES as unknown as [
  ProgramaNivel,
  ...ProgramaNivel[],
];
