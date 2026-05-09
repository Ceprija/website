import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

type StoredId = {
  id: string;
  processedAt: string;
};

function loadIds(file: string): Map<string, string> {
  try {
    const raw = fs.readFileSync(file, "utf8");
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Map();
    const now = Date.now();
    const map = new Map<string, string>();

    for (const item of arr) {
      if (typeof item === "string") {
        map.set(item, new Date(now).toISOString());
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const row = item as Partial<StoredId>;
      if (typeof row.id !== "string" || typeof row.processedAt !== "string") {
        continue;
      }
      const ts = Date.parse(row.processedAt);
      if (Number.isFinite(ts) && now - ts <= TTL_MS) {
        map.set(row.id, row.processedAt);
      }
    }

    return map;
  } catch {
    return new Map();
  }
}

function saveIds(file: string, ids: Map<string, string>): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const rows = [...ids.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, processedAt]) => ({ id, processedAt }));
  fs.writeFileSync(file, JSON.stringify(rows), "utf8");
}

/** Dedupe enrollment emails when /pago-exitoso retries or user refreshes. */
const enrollmentFile = () =>
  path.join(DATA_DIR, "stripe-enrollment-session-ids.json");

/** Dedupe Stripe webhook retries (checkout.session.completed). */
const webhookEventFile = () =>
  path.join(DATA_DIR, "stripe-webhook-event-ids.json");

export function hasEnrollmentBeenConfirmed(sessionId: string): boolean {
  return loadIds(enrollmentFile()).has(sessionId);
}

export function markEnrollmentConfirmed(sessionId: string): boolean {
  const file = enrollmentFile();
  const ids = loadIds(file);
  if (ids.has(sessionId)) return false;
  ids.set(sessionId, new Date().toISOString());
  saveIds(file, ids);
  return true;
}

export function hasWebhookEventBeenProcessed(eventId: string): boolean {
  return loadIds(webhookEventFile()).has(eventId);
}

export function markWebhookEventProcessed(eventId: string): void {
  const file = webhookEventFile();
  const ids = loadIds(file);
  ids.set(eventId, new Date().toISOString());
  saveIds(file, ids);
}

export function isProcessedStripeStoreWritable(): boolean {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const probe = path.join(DATA_DIR, ".stripe-store-probe");
    fs.writeFileSync(probe, new Date().toISOString(), "utf8");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}
