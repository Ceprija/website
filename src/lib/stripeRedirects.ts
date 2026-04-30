/** Normalize SITE_URL / optional request origin into a single HTTPS-capable base URL. */
export function resolveCheckoutOrigin(
  request: Request,
  siteUrl: string | undefined,
): URL {
  const trimmed = typeof siteUrl === "string" ? siteUrl.trim() : "";
  if (trimmed) {
    try {
      return new URL(trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed);
    } catch {
      /* fall through */
    }
  }
  return new URL(request.url);
}
