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
