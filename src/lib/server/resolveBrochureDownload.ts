import { getCollection } from "astro:content";
import { getProgramPathSlug } from "@lib/programPaths";
import { programIsPublished } from "@lib/programPublished";
import { programSubmissionMeta } from "@lib/programSubmissionMeta";
import type { CollectionEntry } from "astro:content";

export function isSafePublicPdfPath(value: string): boolean {
  return (
    value.startsWith("/") &&
    value.toLowerCase().endsWith(".pdf") &&
    !value.includes("..") &&
    !/^\/\//.test(value)
  );
}

export type BrochureResolveOk = {
  ok: true;
  program: CollectionEntry<"programas"> | null;
  brochure: string;
  programSlug: string;
  programTitle: string;
  meta: Record<string, unknown>;
};

export type BrochureResolveErr = {
  ok: false;
  code: "brochure_program_mismatch" | "brochure_landing_mismatch";
};

/**
 * Resolve and validate brochure path from either an Ads landing or a catalog program.
 */
export async function resolveBrochureDownload(input: {
  brochure: string;
  programSlug: string;
  programTitle: string;
  landingSlug?: string;
}): Promise<BrochureResolveOk | BrochureResolveErr> {
  const { brochure, programSlug, programTitle, landingSlug } = input;

  if (!isSafePublicPdfPath(brochure)) {
    return { ok: false, code: "brochure_program_mismatch" };
  }

  if (landingSlug) {
    const landings = await getCollection("landings");
    const landing = landings.find((entry) => entry.id === landingSlug);
    const configured =
      typeof landing?.data.brochure === "string"
        ? landing.data.brochure.trim()
        : "";
    if (
      !landing ||
      landing.data.status !== "active" ||
      configured !== brochure ||
      landing.data.programSlug !== programSlug
    ) {
      return { ok: false, code: "brochure_landing_mismatch" };
    }

    const programs = await getCollection("programas");
    const program =
      programs.find((entry) => getProgramPathSlug(entry) === programSlug) ??
      null;

    return {
      ok: true,
      program,
      brochure: configured,
      programSlug,
      programTitle: programTitle || landing.data.title,
      meta: {
        landingSlug,
        source: "landing",
        ...(program ? programSubmissionMeta(program) : {}),
      },
    };
  }

  const programs = await getCollection("programas");
  const program = programs.find(
    (entry) =>
      getProgramPathSlug(entry) === programSlug ||
      String(entry.data.title ?? "") === programTitle,
  );
  const configuredBrochure =
    typeof program?.data.brochure === "string"
      ? program.data.brochure.trim()
      : "";

  if (
    !program ||
    !programIsPublished(program) ||
    configuredBrochure !== brochure ||
    !isSafePublicPdfPath(configuredBrochure)
  ) {
    return { ok: false, code: "brochure_program_mismatch" };
  }

  return {
    ok: true,
    program,
    brochure: configuredBrochure,
    programSlug: getProgramPathSlug(program),
    programTitle: String(program.data.title ?? programTitle),
    meta: { source: "program", ...programSubmissionMeta(program) },
  };
}
