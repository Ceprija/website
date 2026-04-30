import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");

function loadIds(file: string): Set<string> {
  try {
    const raw = fs.readFileSync(file, "utf8");
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x) => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveIds(file: string, ids: Set<string>): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify([...ids].sort()), "utf8");
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
  const set = loadIds(file);
  if (set.has(sessionId)) return false;
  set.add(sessionId);
  saveIds(file, set);
  return true;
}

export function hasWebhookEventBeenProcessed(eventId: string): boolean {
  return loadIds(webhookEventFile()).has(eventId);
}

export function markWebhookEventProcessed(eventId: string): void {
  const file = webhookEventFile();
  const set = loadIds(file);
  set.add(eventId);
  saveIds(file, set);
}
