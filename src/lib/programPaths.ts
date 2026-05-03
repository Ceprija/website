import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { CollectionEntry } from "astro:content";

/**
 * Canonical URL segment for program detail pages.
 *
 * Reads Astro's entry-level `slug`: in legacy content collections it defaults to
 * the file name (without `.md`) and is overridden by `slug:` in the YAML frontmatter.
 * The field is handled by Astro outside of `data`, so it must not be declared in the
 * Zod schema (see `src/content.config.ts`).
 *
 * Lets editors change the URL without renaming the `.md` file.
 */
export function getProgramPathSlug(
  program: CollectionEntry<"programas">,
): string {
  return program.slug;
}

/**
 * Absolute path to the program collection directory.
 *
 * Resolved from `process.cwd()` (the Astro project root during build) instead of
 * `import.meta.url`, because Vite bundles this module into chunks whose URL no
 * longer points back to `src/lib/`.
 */
const PROGRAMAS_DIR = join(
  process.cwd(),
  "src",
  "content",
  "programas",
);

/**
 * Extract the value of `slug:` from a YAML frontmatter block.
 * Lightweight on purpose: avoids pulling a YAML dependency for a single field.
 * Returns `null` if no top-level `slug:` is declared.
 */
function extractSlugFromFrontmatter(source: string): string | null {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;
  const body = match[1];
  for (const rawLine of body.split("\n")) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line || line.startsWith("#")) continue;
    const slugMatch = line.match(/^slug\s*:\s*["']?([^"'\s#]+)["']?\s*(#.*)?$/);
    if (slugMatch) return slugMatch[1];
  }
  return null;
}

/**
 * Resolve the URL slug each `.md` would produce, mirroring Astro's legacy
 * collections rule: frontmatter `slug` overrides the file-derived slug.
 */
function resolveSlugForFile(fileName: string): string {
  const filePath = join(PROGRAMAS_DIR, fileName);
  const source = readFileSync(filePath, "utf8");
  const fromFrontmatter = extractSlugFromFrontmatter(source);
  if (fromFrontmatter) return fromFrontmatter;
  return fileName.replace(/\.md$/, "");
}

/**
 * Fails the build if two programs share the same `slug`.
 *
 * Reads `src/content/programas/*.md` directly because Astro's legacy content
 * collections deduplicate entries silently when slugs collide (only the first
 * one survives in `getCollection`), which would let conflicts go unnoticed.
 *
 * Call from `getStaticPaths()` so conflicts surface immediately at build time.
 * The `programs` argument is accepted for ergonomic call sites but not required
 * to detect duplicates.
 */
export function validateUniqueSlugs(
  _programs: CollectionEntry<"programas">[] = [],
): void {
  let files: string[];
  try {
    files = readdirSync(PROGRAMAS_DIR).filter((name) => name.endsWith(".md"));
  } catch (error) {
    throw new Error(
      `No pude leer ${PROGRAMAS_DIR} para validar slugs únicos: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const seen = new Map<string, string>();
  const duplicates: string[] = [];

  for (const file of files) {
    const slug = resolveSlugForFile(file);
    const previous = seen.get(slug);
    if (previous) {
      duplicates.push(`  - "${slug}" en: ${previous} y ${file}`);
    } else {
      seen.set(slug, file);
    }
  }

  if (duplicates.length > 0) {
    throw new Error(
      `Slugs duplicados en src/content/programas/:\n${duplicates.join("\n")}`,
    );
  }
}
