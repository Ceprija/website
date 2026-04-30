const PRICE_ID_RE = /^price_[a-zA-Z0-9]+$/;

export type ProgramStripePriceIds = {
  presencial?: string;
  online?: string;
};

/** Same shape checks as create-checkout-session / STRIPE_ALLOWED_PRICE_IDS parsing. */
function looksLikeStripePriceId(value: string | undefined): boolean {
  const s = value?.trim();
  return (
    !!s && PRICE_ID_RE.test(s) && !/PLACEHOLDER|REPLACE/i.test(s)
  );
}

/**
 * Program detail sidebar: show Stripe checkout when at least one modality has a
 * plausible price_ ID. Otherwise fall back to ContactForm (lead / not configured).
 */
export function programHasStripeCheckout(
  ids: ProgramStripePriceIds | undefined,
): boolean {
  if (!ids) return false;
  return looksLikeStripePriceId(ids.presencial) || looksLikeStripePriceId(ids.online);
}

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
