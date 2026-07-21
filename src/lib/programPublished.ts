import type { CollectionEntry } from "astro:content";
import {
  getProgramStatus,
  type ProgramStatus,
} from "./programPayments";

/** Niveles that auto-archive from ISO `date` (keep in sync with EDUCACION_CONTINUA_NIVELES). */
const AUTO_PAST_NIVELES = new Set([
  "curso",
  "webinar",
  "taller",
  "diplomado",
]);

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Determines if a program should be publicly visible.
 * Programs with status "active", "waitlist", or "past" are published.
 * Programs with status "disabled" are hidden.
 *
 * Maintains backward compatibility with legacy `disabled: true` field.
 */
export function programIsPublished(
  entry: CollectionEntry<"programas">,
): boolean {
  return getProgramStatus(entry) !== "disabled";
}

export function filterPublishedPrograms(
  programs: CollectionEntry<"programas">[],
): CollectionEntry<"programas">[] {
  return programs.filter(programIsPublished);
}

/** Today's calendar date in America/Mexico_City as YYYY-MM-DD. */
export function todayInMexicoCity(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Parses program ISO `date` (YYYY-MM-DD). Returns null if missing/invalid.
 */
export function parseProgramIsoDate(
  entry: CollectionEntry<"programas">,
): string | null {
  const raw = entry.data.date;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!ISO_DATE_RE.test(trimmed)) return null;
  return trimmed;
}

/**
 * Effective status for listings, fichas, and enrollment gates.
 * Active educación continua with ISO `date` on or before today (Mexico City)
 * is treated as "past" without rewriting frontmatter.
 * Set `date` to the last session/event day so multi-day programs stay active until then.
 */
export function getEffectiveProgramStatus(
  entry: CollectionEntry<"programas">,
  now: Date = new Date(),
): ProgramStatus {
  const status = getProgramStatus(entry);
  if (status !== "active") return status;

  if (!AUTO_PAST_NIVELES.has(entry.data.nivel)) {
    return status;
  }

  const isoDate = parseProgramIsoDate(entry);
  if (!isoDate) return status;

  if (isoDate <= todayInMexicoCity(now)) {
    return "past";
  }

  return status;
}

export function programIsPast(
  entry: CollectionEntry<"programas">,
  now?: Date,
): boolean {
  return getEffectiveProgramStatus(entry, now) === "past";
}

/** Published programs that still belong in the live catalog (not past). */
export function filterCatalogPrograms(
  programs: CollectionEntry<"programas">[],
  now?: Date,
): CollectionEntry<"programas">[] {
  return filterPublishedPrograms(programs).filter(
    (p) => getEffectiveProgramStatus(p, now) !== "past",
  );
}

/** Programs shown under “Cursos pasados” (manual past or auto-archived). */
export function filterPastPrograms(
  programs: CollectionEntry<"programas">[],
  now?: Date,
): CollectionEntry<"programas">[] {
  return filterPublishedPrograms(programs).filter((p) =>
    programIsPast(p, now),
  );
}
