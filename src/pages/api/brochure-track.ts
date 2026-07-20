export const prerender = false;

import type { APIRoute } from "astro";
import { apiLog, getRequestId, jsonResponse } from "@lib/server/apiRequestLog";
import {
  guardPublicPost,
  hasHoneypotValue,
  honeypotResponse,
} from "@lib/server/publicEndpointGuards";
import { persistSubmission } from "@lib/db/submissions";
import { resolveBrochureDownload } from "@lib/server/resolveBrochureDownload";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s().-]{7,24}$/;

function clean(value: unknown, max: number): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max)
    : "";
}

/**
 * Retry-only endpoint for brochure submissions.
 * The client can call this in the background when `/api/brochure-download`
 * succeeded for the user but School Hub persistence timed out.
 *
 * It is idempotent because School Hub enforces `website_submissions.request_id` uniqueness.
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = getRequestId(request);
  const route = "POST /api/brochure-track";
  const guarded = guardPublicPost(request, {
    route,
    requestId,
    rateLimitKey: "brochure-track",
    limit: 20,
    windowMs: 10 * 60_000,
    expectedContentType: "json",
  });
  if (guarded) return guarded;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (hasHoneypotValue(body)) {
    return honeypotResponse(route, requestId);
  }

  const trackingRequestId = clean(body?.trackingRequestId, 80);
  const name = clean(body?.name, 120);
  const email = clean(body?.email, 254).toLowerCase();
  const phone = clean(body?.phone, 30);
  const message = clean(body?.message, 800);
  const programTitle = clean(body?.programTitle, 180);
  const programSlug = clean(body?.programSlug, 120);
  const brochure = clean(body?.brochure, 240);
  const landingSlug = clean(body?.landingSlug, 120) || undefined;

  if (!trackingRequestId) {
    return jsonResponse({ ok: false, code: "missing_tracking_request_id" }, 400, requestId);
  }

  if (!name || !EMAIL_RE.test(email) || !PHONE_RE.test(phone) || !programTitle) {
    return jsonResponse(
      { ok: false, code: "invalid_brochure_lead" },
      400,
      requestId,
    );
  }

  const resolved = await resolveBrochureDownload({
    brochure,
    programSlug,
    programTitle,
    landingSlug,
  });

  if (!resolved.ok) {
    apiLog("warn", route, resolved.code, {
      requestId,
      trackingRequestId,
      programSlug,
      landingSlug,
      brochure,
      code: resolved.code,
    });
    return jsonResponse({ ok: false, code: resolved.code }, 400, requestId);
  }

  const submission = await persistSubmission(
    {
      requestId: trackingRequestId,
      flow: "brochure_download",
      personKind: "lead",
      email,
      phone,
      programSlug: resolved.programSlug,
      programTitle: resolved.programTitle,
      apiRoute: "POST /api/brochure-download",
      payload: {
        name,
        message: message || null,
        brochure: resolved.brochure,
        ...resolved.meta,
      },
      ip:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    },
    route,
    { timeoutMs: 8000 },
  );

  if (!submission.ok) {
    apiLog("warn", route, "school_hub_persist_failed", {
      requestId,
      trackingRequestId,
      programSlug: resolved.programSlug,
    });
    return jsonResponse({ ok: false, code: "school_hub_persist_failed" }, 503, requestId);
  }

  return jsonResponse({ ok: true }, 200, requestId);
};
