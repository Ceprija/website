import convert from "heic-convert";
import { apiLog } from "@lib/server/apiRequestLog";
import { MAX_UPLOAD_BYTES_PER_FILE } from "@lib/validation/uploadRules";
import type { UploadValidationError } from "@lib/uploads/fileValidation";
import { isHeifUpload } from "@lib/uploads/fileValidation";

export type DeliverableUpload = {
  buffer: Buffer;
  filename: string;
  mimetype: string;
  fieldname?: string;
};

const JPEG_QUALITY = 0.92;

function jpegFilename(filename: string): string {
  if (/\.(heic|heif)$/i.test(filename)) {
    return filename.replace(/\.(heic|heif)$/i, ".jpg");
  }
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return `${filename}.jpg`;
  return `${filename.slice(0, dot)}.jpg`;
}

export async function normalizeUploadForDelivery(
  file: DeliverableUpload,
  options?: { logRoute?: string; requestId?: string },
): Promise<
  { ok: true; file: DeliverableUpload } | { ok: false; err: UploadValidationError }
> {
  if (!isHeifUpload(file.buffer, file.mimetype)) {
    return { ok: true, file };
  }

  try {
    const converted = await convert({
      buffer: file.buffer,
      format: "JPEG",
      quality: JPEG_QUALITY,
    });
    const buffer = Buffer.from(converted);
    if (buffer.length > MAX_UPLOAD_BYTES_PER_FILE) {
      return {
        ok: false,
        err: {
          code: "file_too_large",
          error:
            "La imagen convertida supera el tamaño máximo (10 MB). Intenta con otra foto o en PDF.",
          field: file.fieldname,
        },
      };
    }

    return {
      ok: true,
      file: {
        ...file,
        buffer,
        mimetype: "image/jpeg",
        filename: jpegFilename(file.filename),
      },
    };
  } catch (error) {
    if (options?.logRoute) {
      apiLog("error", options.logRoute, "heic_convert_failed", {
        requestId: options.requestId,
        field: file.fieldname,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return {
      ok: false,
      err: {
        code: "heic_convert_failed",
        error:
          "No pudimos procesar la foto de tu dispositivo. Intenta de nuevo o envía el documento en PDF o JPG.",
        field: file.fieldname,
      },
    };
  }
}

export async function normalizeUploadBatch(
  files: DeliverableUpload[],
  options?: { logRoute?: string; requestId?: string },
): Promise<
  { ok: true; files: DeliverableUpload[] } | { ok: false; err: UploadValidationError }
> {
  const normalized: DeliverableUpload[] = [];
  for (const file of files) {
    const result = await normalizeUploadForDelivery(file, options);
    if (!result.ok) return result;
    normalized.push(result.file);
  }
  return { ok: true, files: normalized };
}
