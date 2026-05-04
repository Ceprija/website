/** Límites de adjuntos alineados con `fileValidation.ts` (servidor). */

export const MAX_UPLOAD_BYTES_PER_FILE = 10 * 1024 * 1024; // 10 MiB

export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export function isAllowedUploadMime(mime: string): boolean {
  const m = (mime || "").split(";")[0].trim().toLowerCase();
  return ALLOWED_UPLOAD_MIME_TYPES.has(m);
}
