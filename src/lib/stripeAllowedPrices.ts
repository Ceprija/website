const PRICE_ID_RE = /^price_[a-zA-Z0-9]+$/;

/** Parses STRIPE_ALLOWED_PRICE_IDS; only valid Stripe Price IDs are kept. */
export function parseStripeAllowedPriceIds(raw: string | undefined): Set<string> {
  const set = new Set<string>();
  for (const part of (raw ?? "").split(",")) {
    const s = part.trim();
    if (!s) continue;
    if (PRICE_ID_RE.test(s) && !/PLACEHOLDER|REPLACE/i.test(s)) {
      set.add(s);
    }
  }
  return set;
}

/**
 * Check if a program has valid Stripe checkout configuration.
 * Returns true if at least one price ID (online or presencial) is set.
 */
export function programHasStripeCheckout(
  stripePriceIds: { online?: string; presencial?: string } | undefined
): boolean {
  if (!stripePriceIds) return false;
  const hasOnline = Boolean(stripePriceIds.online?.trim());
  const hasPresencial = Boolean(stripePriceIds.presencial?.trim());
  return hasOnline || hasPresencial;
}
