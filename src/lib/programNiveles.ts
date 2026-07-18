import type { CollectionEntry } from "astro:content";
import { getEffectiveProgramStatus } from "@lib/programPublished";

/**
 * Program levels stored in content collection `programas` (`nivel` in frontmatter).
 * Keep in sync: `src/content.config.ts` uses the same tuple for Zod.
 */
export const PROGRAMA_NIVELES = [
  "curso",
  "webinar",
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

/** Posgrado buckets used on school pages and the homepage showcase. */
export const POSGRADO_NIVELES: readonly ProgramaNivel[] = [
  "especialidad",
  "maestria",
  "doctorado",
];

/** Educación continua buckets used on school pages and the homepage showcase. */
export const EDUCACION_CONTINUA_NIVELES: readonly ProgramaNivel[] = [
  "curso",
  "webinar",
  "taller",
  "diplomado",
];

type ProgramEntry = CollectionEntry<"programas">;

/**
 * Active programs in the given niveles, featured first, then title A–Z.
 * Caps at `limit` (default 4) for homepage showcases.
 * Uses effective status so dated finished courses drop off after rebuild.
 */
export function pickHomePrograms(
  programs: ProgramEntry[],
  niveles: readonly ProgramaNivel[],
  limit = 4,
): ProgramEntry[] {
  const nivelSet = new Set<string>(niveles);

  return programs
    .filter(
      (p) =>
        getEffectiveProgramStatus(p) === "active" &&
        nivelSet.has(p.data.nivel),
    )
    .sort((a, b) => {
      const featuredA = a.data.featured === true ? 0 : 1;
      const featuredB = b.data.featured === true ? 0 : 1;
      if (featuredA !== featuredB) return featuredA - featuredB;
      return a.data.title.localeCompare(b.data.title, "es", {
        sensitivity: "base",
      });
    })
    .slice(0, limit);
}
