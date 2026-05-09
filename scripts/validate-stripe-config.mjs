import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const programasDir = path.join(root, "src", "content", "programas");
const priceRe = /^price_[a-zA-Z0-9]+$/;
const invalidTokenRe = /REPLACE|PLACEHOLDER|Cfg/i;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.isFile() && entry.name.endsWith(".md") ? [fullPath] : [];
  });
}

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return new Map();
  const env = new Map();
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env.set(trimmed.slice(0, idx), trimmed.slice(idx + 1));
  }
  return env;
}

const env = parseEnvFile(path.join(root, ".env"));
const allowed = new Set(
  (process.env.STRIPE_ALLOWED_PRICE_IDS ?? env.get("STRIPE_ALLOWED_PRICE_IDS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

const failures = [];
const warnings = [];
const prices = [];
const requireAllowlist = process.env.NODE_ENV === "production";

for (const file of walk(programasDir)) {
  const rel = path.relative(root, file);
  const content = fs.readFileSync(file, "utf8");
  for (const match of content.matchAll(/["'](price_[^"']+)["']/g)) {
    const priceId = match[1].trim();
    prices.push({ rel, priceId });

    if (!priceRe.test(priceId)) {
      failures.push(`${rel}: invalid Stripe Price ID format: ${priceId}`);
    }
    if (invalidTokenRe.test(priceId)) {
      failures.push(`${rel}: placeholder/example Stripe Price ID must be replaced: ${priceId}`);
    }
    if (requireAllowlist && allowed.size > 0 && !allowed.has(priceId)) {
      failures.push(`${rel}: ${priceId} is missing from STRIPE_ALLOWED_PRICE_IDS`);
    } else if (!requireAllowlist && allowed.size > 0 && !allowed.has(priceId)) {
      warnings.push(`${rel}: ${priceId} is missing from the local STRIPE_ALLOWED_PRICE_IDS`);
    }
  }
}

if (prices.length === 0) {
  failures.push("No Stripe price IDs were found in src/content/programas.");
}

if (process.env.NODE_ENV === "production" && allowed.size === 0) {
  failures.push("STRIPE_ALLOWED_PRICE_IDS is required when NODE_ENV=production.");
}

if (failures.length > 0) {
  console.error("Stripe config validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

for (const warning of warnings) console.warn(`Warning: ${warning}`);
console.log(`Stripe config validation passed for ${prices.length} price references.`);
