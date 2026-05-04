import type { CollectionEntry } from "astro:content";

import {
  programHasStripeCheckout,
  type ProgramStripePriceIds,
} from "@lib/stripeAllowedPrices";

/**
 * Long-form types for the optional `variantOptions` block defined in
 * `src/content.config.ts`. The shapes are intentionally lenient so they can
 * survive Astro/Zod inference loosening at the consumer site (and so callers
 * can do simple optional-chain checks without re-deriving the schema).
 */
export type VariantModuleOption = {
  id: string;
  label: string;
  description?: string;
  stripePriceIds?: ProgramStripePriceIds;
};

export type VariantDateOption = {
  id: string;
  label: string;
  description?: string;
};

export type VariantOptions = {
  moduleSelection?: {
    label: string;
    required?: boolean;
    options: VariantModuleOption[];
  };
  dateSelection?: {
    label: string;
    required?: boolean;
    options: VariantDateOption[];
  };
};

/**
 * Returns the program's `variantOptions` block when it contains at least one
 * usable selector (modules or dates). Used by both the program detail page and
 * the enrollment page to decide whether the variant selection step is shown.
 */
export function getVariantOptions(
  program: CollectionEntry<"programas">,
): VariantOptions | null {
  const raw = (program.data as { variantOptions?: VariantOptions }).variantOptions;
  if (!raw || typeof raw !== "object") return null;

  const hasModules =
    !!raw.moduleSelection &&
    Array.isArray(raw.moduleSelection.options) &&
    raw.moduleSelection.options.length > 0;
  const hasDates =
    !!raw.dateSelection &&
    Array.isArray(raw.dateSelection.options) &&
    raw.dateSelection.options.length > 0;

  if (!hasModules && !hasDates) return null;

  return raw;
}

/** Convenience wrapper for templates that just need a boolean. */
export function programHasVariantOptions(
  program: CollectionEntry<"programas">,
): boolean {
  return getVariantOptions(program) !== null;
}

/**
 * Returns the Stripe price ID associated with a given module selection and
 * modality. Falls back to `null` when the variant has no price for that
 * modality (e.g. presencial-only workshop) so callers can show a clear error.
 */
export function getVariantStripePriceId(
  variants: VariantOptions | null,
  selectedModuleId: string,
  modality: "Presencial" | "En línea" | string,
): string | null {
  const moduleSel = variants?.moduleSelection;
  if (!moduleSel) return null;
  const opt = moduleSel.options.find((o) => o.id === selectedModuleId);
  if (!opt || !opt.stripePriceIds) return null;
  const key = modality === "Presencial" ? "presencial" : "online";
  const value = opt.stripePriceIds[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Aside-card / detail page heuristic: a variant-driven program is considered
 * payable when at least one of its module options has a usable Stripe price
 * for any modality.
 */
export function variantOptionsHaveStripeCheckout(
  variants: VariantOptions | null,
): boolean {
  const opts = variants?.moduleSelection?.options ?? [];
  return opts.some((o) => programHasStripeCheckout(o.stripePriceIds));
}
