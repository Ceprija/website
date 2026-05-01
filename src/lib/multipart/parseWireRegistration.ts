import Busboy from "busboy";
import { MAX_UPLOAD_BYTES } from "@lib/uploads/fileValidation";

export function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export type ParsedWireRegistration = {
  fields: Record<string, string>;
  paymentProof: { buffer: Buffer; filename: string; mimetype: string } | null;
};

/**
 * Single proof file (`paymentProof`) buffered in memory with a hard byte cap.
 */
export function parseWireRegistrationMultipart(
  request: Request,
): Promise<ParsedWireRegistration> {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: Object.fromEntries(request.headers.entries()) });
    const fields: Record<string, string> = {};
    let proof: ParsedWireRegistration["paymentProof"] = null;
    let proofRejected: "large" | "handler" | null = null;

    let fileEndPromise: Promise<void> = Promise.resolve();

    busboy.on("field", (fieldname: string, value: string) => {
      fields[fieldname] = value;
    });

    busboy.on("file", (fieldname: string, file: NodeJS.ReadableStream, info: { filename?: string; mimeType?: string }) => {
      if (fieldname !== "paymentProof") {
        file.resume();
        return;
      }

      fileEndPromise = new Promise<void>((fResolve, fReject) => {
        const { filename, mimeType } = info;
        const mimeNorm = (mimeType ?? "").split(";")[0].trim().toLowerCase();
        const chunks: Buffer[] = [];
        let total = 0;

        file.on("data", (data: Buffer) => {
          total += data.length;
          if (total > MAX_UPLOAD_BYTES) {
            proofRejected = "large";
            file.resume();
            return;
          }
          chunks.push(data);
        });

        file.on("end", () => {
          if (proofRejected === "large") {
            fResolve();
            return;
          }
          const buffer = Buffer.concat(chunks);
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
          const sanitizedName = sanitizeFilename(fields.name || "usuario");
          const ext = (filename ?? "doc").split(".").pop() || "pdf";
          const newFilename = `${sanitizedName}_${timestamp}.${ext}`;
          proof = { buffer, filename: newFilename, mimetype: mimeNorm };
          fResolve();
        });

        file.on("error", (err: Error) => {
          proofRejected = "handler";
          fReject(err);
        });
      });
    });

    busboy.on("finish", () => {
      void fileEndPromise
        .then(() => {
          if (proofRejected === "large") {
            reject(Object.assign(new Error("FILE_TOO_LARGE"), { code: "file_too_large" }));
            return;
          }
          resolve({ fields, paymentProof: proof });
        })
        .catch(reject);
    });

    busboy.on("error", reject);

    if (!request.body) {
      reject(new Error("NO_BODY"));
      return;
    }

    void request.body.pipeTo(
      new WritableStream({
        write(chunk) {
          busboy.write(chunk as Buffer);
        },
        close() {
          busboy.end();
        },
      }),
    );
  });
}
