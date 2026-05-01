/**
 * Server-side upload rules: size, empty buffer, declared vs sniffed MIME (don’t trust client alone).
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MiB per file
export const ALLOWED_UPLOAD_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

/** Max total files per request for multi-file endpoints (educación continua, etc.) */
export const MAX_FILES_PER_REQUEST = 12;

export type UploadValidationError = {
  code: string;
  error: string;
  field?: string;
};

function detectMimeFromMagic(buf: Buffer): string | null {
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  if (buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  return null;
}

/**
 * Declared MIME from multipart must be allowed AND match magic bytes when enough data exists.
 */
export function validateUploadBuffer(
  buffer: Buffer,
  clientMime: string,
  options?: { field?: string },
): { ok: true } | { ok: false; err: UploadValidationError } {
  const field = options?.field;
  const normalizedMime = (clientMime || "").split(";")[0].trim().toLowerCase();

  if (!buffer || buffer.length === 0) {
    return {
      ok: false,
      err: { code: "empty_file", error: "Archivo vacío", field },
    };
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      err: { code: "file_too_large", error: "Archivo demasiado grande (máx. 10 MB)", field },
    };
  }
  if (!ALLOWED_UPLOAD_MIMES.has(normalizedMime)) {
    return {
      ok: false,
      err: { code: "invalid_mime", error: "Tipo de archivo no permitido", field },
    };
  }

  const magic = detectMimeFromMagic(buffer);
  if (!magic) {
    return {
      ok: false,
      err: { code: "invalid_file_content", error: "El contenido no coincide con un formato permitido", field },
    };
  }
  if (magic !== normalizedMime) {
    return {
      ok: false,
      err: {
        code: "mime_mismatch",
        error: "El tipo declarado no coincide con el contenido del archivo",
        field,
      },
    };
  }

  return { ok: true };
}
