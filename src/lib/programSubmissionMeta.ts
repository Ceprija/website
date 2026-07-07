import type { CollectionEntry } from "astro:content";

/** Metadata stored on submission payload for admin classification. */
export function programSubmissionMeta(
  program: CollectionEntry<"programas"> | undefined,
): { programNivel: string | null; programEscuela: string | null } {
  if (!program) {
    return { programNivel: null, programEscuela: null };
  }
  return {
    programNivel: String(program.data.nivel ?? "") || null,
    programEscuela: String(program.data.escuela ?? "") || null,
  };
}
