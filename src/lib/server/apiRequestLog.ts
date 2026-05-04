import { randomUUID } from "node:crypto";

export type ApiLogLevel = "info" | "warn" | "error";

/**
 * Stable request id for logs and `X-Request-Id` (propagate if client sends it).
 */
export function getRequestId(request: Request): string {
  const fromClient = request.headers.get("x-request-id")?.trim();
  if (fromClient && fromClient.length <= 128) return fromClient;
  return randomUUID();
}

/**
 * One JSON line per event — easy to grep in hosting logs / forward to APM.
 */
export function apiLog(
  level: ApiLogLevel,
  route: string,
  message: string,
  fields: Record<string, unknown>,
): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    route,
    message,
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function jsonResponse(
  body: unknown,
  status: number,
  requestId: string,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": requestId,
    },
  });
}

/** Plain-text (or custom Content-Type) responses with the same request id header. */
export function textResponse(
  body: string,
  status: number,
  requestId: string,
  contentType = "text/plain; charset=utf-8",
): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": contentType,
      "X-Request-Id": requestId,
    },
  });
}
