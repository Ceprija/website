import { SITE_URL } from "astro:env/server";
import { apiLog, jsonResponse } from "@lib/server/apiRequestLog";
import {
  checkRateLimit,
  clientIpFromRequest,
  pruneRateLimitBuckets,
} from "@lib/server/rateLimit";

type GuardOptions = {
  route: string;
  requestId: string;
  rateLimitKey: string;
  limit: number;
  windowMs: number;
  expectedContentType?: "json" | "multipart";
};

function allowedOrigins(request: Request): Set<string> {
  const origins = new Set<string>();
  const addOrigin = (value: string | null | undefined) => {
    if (!value) return;
    try {
      const url = new URL(value);
      origins.add(url.origin);

      // Accept both apex and www variants for the public CEPRIJA domain. This
      // keeps same-site requests working during canonical-domain transitions.
      if (url.hostname === "ceprija.edu.mx") {
        origins.add(`${url.protocol}//www.ceprija.edu.mx`);
      } else if (url.hostname === "www.ceprija.edu.mx") {
        origins.add(`${url.protocol}//ceprija.edu.mx`);
      }
    } catch {
      // Malformed origin candidates are ignored.
    }
  };

  try {
    addOrigin(new URL(request.url).origin);
  } catch {
    // Invalid request URLs will fail the comparison below.
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  if (host) {
    addOrigin(`${forwardedProto || "https"}://${host}`);
  }

  if (SITE_URL) {
    addOrigin(SITE_URL);
  }
  return origins;
}

export function isAllowedRequestOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")?.trim();
  if (!origin) return true;
  return allowedOrigins(request).has(origin);
}

export function hasHoneypotValue(
  fields: Record<string, unknown> | null | undefined,
): boolean {
  if (!fields) return false;
  return ["website", "homepage", "_gotcha"].some((key) => {
    const value = fields[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

export function guardPublicPost(
  request: Request,
  options: GuardOptions,
): Response | null {
  const { route, requestId, expectedContentType } = options;

  if (!isAllowedRequestOrigin(request)) {
    apiLog("warn", route, "origin_not_allowed", {
      requestId,
      origin: request.headers.get("origin"),
      code: "origin_not_allowed",
    });
    return jsonResponse(
      { error: "Origen no permitido", code: "origin_not_allowed" },
      403,
      requestId,
    );
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (expectedContentType === "json" && !contentType.includes("application/json")) {
    return jsonResponse(
      { error: "Content-Type inválido", code: "invalid_content_type" },
      400,
      requestId,
    );
  }
  if (
    expectedContentType === "multipart" &&
    (!contentType.includes("multipart/form-data") || !contentType.includes("boundary="))
  ) {
    return jsonResponse(
      { error: "Content-Type inválido", code: "invalid_content_type" },
      400,
      requestId,
    );
  }

  pruneRateLimitBuckets();
  const ip = clientIpFromRequest(request);
  const rateLimit = checkRateLimit(`${options.rateLimitKey}:${ip}`, {
    limit: options.limit,
    windowMs: options.windowMs,
  });
  if (!rateLimit.ok) {
    apiLog("warn", route, "rate_limit_exceeded", {
      requestId,
      ip,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
    return jsonResponse(
      {
        error: "Demasiados intentos. Espera unos minutos y vuelve a intentar.",
        code: "rate_limit_exceeded",
      },
      429,
      requestId,
    );
  }

  return null;
}

export function honeypotResponse(route: string, requestId: string): Response {
  apiLog("warn", route, "honeypot_triggered", {
    requestId,
    code: "honeypot_triggered",
  });
  return jsonResponse({ success: true }, 200, requestId);
}
