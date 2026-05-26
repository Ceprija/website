/**
 * Builds a Laravel API URL from a base (with or without trailing slash) and a path segment.
 */
export function laravelApiUrl(base: string, path: string): string {
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = path.replace(/^\//, "");
  return new URL(normalizedPath, normalizedBase).toString();
}
