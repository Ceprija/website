import type { CollectionEntry } from "astro:content";

/** Programas con `disabled: true` no se listan ni generan páginas públicas de oferta/inscripción. */
export function programIsPublished(
    entry: CollectionEntry<"programas">,
): boolean {
    return entry.data.disabled !== true;
}

export function filterPublishedPrograms(
    programs: CollectionEntry<"programas">[],
): CollectionEntry<"programas">[] {
    return programs.filter(programIsPublished);
}
