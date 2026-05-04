/**
 * Server-side upload rules: size, empty buffer, declared vs sniffed MIME (don’t trust client alone).
 */

import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES_PER_FILE,
} from "@lib/validation/uploadRules";

export const MAX_UPLOAD_BYTES = MAX_UPLOAD_BYTES_PER_FILE;
export const ALLOWED_UPLOAD_MIMES = ALLOWED_UPLOAD_MIME_TYPES;

/** Max total files per request for multi-file endpoints (educación continua, etc.) */
export const MAX_FILES_PER_REQUEST = 12;

export type UploadValidationError = {
  code: string;
  error: string;
  field?: string;
};

/**
 * HEIC/HEIF files follow the ISO Base Media File Format (like MP4): a variable-length
 * `ftyp` box whose brand (bytes 8-11) identifies the concrete format. iPhone photos
 * use `heic` (stills) or `mif1`; we also allow common HEIF-family brands. HEIF variants
 * are normalized to `image/heic` because downstream consumers (Brevo attachments, admin
 * review) treat them interchangeably.
 */
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "mif1", "msf1", "heim", "heis"]);

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
  if (
    buf.length >= 12 &&
    buf.subarray(4, 8).toString("ascii") === "ftyp" &&
    HEIC_BRANDS.has(buf.subarray(8, 12).toString("ascii").toLowerCase())
  ) {
    return "image/heic";
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
  if (!ALLOWED_UPLOAD_MIME_TYPES.has(normalizedMime)) {
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
  // HEIF and HEIC share the same ISO BMFF container. Clients (and iOS) sometimes
  // declare `image/heif` even when the brand is `heic`, and vice versa — treat
  // them as equivalent so legitimate iPhone uploads aren't rejected.
  const heifFamily = new Set(["image/heic", "image/heif"]);
  const magicMatches =
    magic === normalizedMime ||
    (heifFamily.has(magic) && heifFamily.has(normalizedMime));
  if (!magicMatches) {
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
