import type { CollectionEntry } from "astro:content";
import { getProgramStatus } from "./programPayments";

/**
 * Determines if a program should be publicly visible.
 * Programs with status "active" or "waitlist" are published (visible in catalog).
 * Programs with status "disabled" are hidden.
 * 
 * Maintains backward compatibility with legacy `disabled: true` field.
 */
export function programIsPublished(
    entry: CollectionEntry<"programas">,
): boolean {
    const status = getProgramStatus(entry);
    return status !== "disabled";
}

export function filterPublishedPrograms(
    programs: CollectionEntry<"programas">[],
): CollectionEntry<"programas">[] {
    return programs.filter(programIsPublished);
}
