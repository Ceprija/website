import {
  EMAIL_ADMIN_ONLY_RECIPIENT,
  EMAIL_CONTROL_ESCOLAR,
  EMAIL_EDUCACION_CONTINUA,
  EMAIL_SOPORTE_WEB,
  KEY_API_BREVO,
  SITE_URL,
  STRIPE_ALLOWED_PRICE_IDS,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
} from "astro:env/server";
import { parseStripeAllowedPriceIds } from "@lib/stripeAllowedPrices";

export type ProductionEnvCheck = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function urlHost(value: string | undefined): string | null {
  if (!hasValue(value)) return null;
  try {
    return new URL(value ?? "").hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function validateProductionEnv(): ProductionEnvCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!hasValue(STRIPE_SECRET_KEY)) {
    errors.push("STRIPE_SECRET_KEY is required.");
  } else if (isProductionRuntime() && !STRIPE_SECRET_KEY?.startsWith("sk_live_")) {
    errors.push("Production must use a live Stripe secret key (sk_live_...).");
  }

  if (hasValue(STRIPE_WEBHOOK_SECRET) && !STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")) {
    errors.push("STRIPE_WEBHOOK_SECRET must be a Stripe signing secret (whsec_...).");
  }

  if (isProductionRuntime()) {
    if (!hasValue(STRIPE_WEBHOOK_SECRET)) {
      errors.push("STRIPE_WEBHOOK_SECRET is required.");
    }
    if (!hasValue(SITE_URL)) {
      errors.push("SITE_URL is required in production.");
    } else if (!/^https:\/\/[^/]+/i.test(SITE_URL ?? "")) {
      errors.push("SITE_URL must be an HTTPS origin in production.");
    }

    const allowedPrices = parseStripeAllowedPriceIds(STRIPE_ALLOWED_PRICE_IDS);
    if (allowedPrices.size === 0) {
      errors.push("STRIPE_ALLOWED_PRICE_IDS must contain production price IDs.");
    }

    if (!hasValue(KEY_API_BREVO)) errors.push("KEY_API_BREVO is required.");
    if (!hasValue(EMAIL_CONTROL_ESCOLAR)) {
      errors.push("EMAIL_CONTROL_ESCOLAR is required.");
    }
    if (!hasValue(EMAIL_EDUCACION_CONTINUA)) {
      errors.push("EMAIL_EDUCACION_CONTINUA is required.");
    }
    if (!hasValue(EMAIL_SOPORTE_WEB)) {
      errors.push("EMAIL_SOPORTE_WEB is required.");
    }
    if (hasValue(EMAIL_ADMIN_ONLY_RECIPIENT)) {
      warnings.push(
        "EMAIL_ADMIN_ONLY_RECIPIENT is set: all admin notifications (inscripción, brochure, wire, etc.) go only to that address. Unset in .env and run `pm2 delete <app> && pm2 start` (not only restart) if you removed it from .env but PM2 still shows the variable.",
      );
    }
  } else if (parseStripeAllowedPriceIds(STRIPE_ALLOWED_PRICE_IDS).size === 0) {
    warnings.push("STRIPE_ALLOWED_PRICE_IDS is empty; only content validation applies.");
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function assertProductionEnvReady(): void {
  const check = validateProductionEnv();
  if (!check.ok) {
    throw new Error(`Production environment is not ready: ${check.errors.join(" ")}`);
  }
}
