import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const FAILED_EMAIL_FILE = path.join(DATA_DIR, "failed-emails.jsonl");

export type FailedEmailRecord = {
  ts: string;
  route: string;
  requestId: string;
  kind: "participant" | "admin";
  to: string[];
  subject: string;
  programSlug?: string;
  stripeSessionId?: string;
  reason: string;
};

export function recordFailedEmail(record: Omit<FailedEmailRecord, "ts">): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(
      FAILED_EMAIL_FILE,
      `${JSON.stringify({ ts: new Date().toISOString(), ...record })}\n`,
      "utf8",
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        route: record.route,
        message: "failed_email_record_write_failed",
        requestId: record.requestId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
