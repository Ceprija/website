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
  try {
    origins.add(new URL(request.url).origin);
  } catch {
    // Invalid request URLs will fail the comparison below.
  }
  if (SITE_URL) {
    try {
      origins.add(new URL(SITE_URL).origin);
    } catch {
      // Environment validation reports malformed SITE_URL separately.
    }
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
