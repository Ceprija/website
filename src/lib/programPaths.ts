import type { CollectionEntry } from "astro:content";

/** Canonical URL segment for program detail pages (frontmatter `slug` or generated file slug). */
export function getProgramPathSlug(
  program: CollectionEntry<"programas">,
): string {
  return program.slug;
}
