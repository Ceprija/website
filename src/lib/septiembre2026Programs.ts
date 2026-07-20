/** Programs offered on the Septiembre 2026 interest form (titles must match the select options). */
export const SEPTIEMBRE_2026_PROGRAMS = [
  "Maestría en Derecho Internacional de Derechos Humanos y Litigio Estratégico",
  "Especialidad en Criminalística y Ciencias Forenses",
  "Maestría en Derecho Civil y Familiar",
  "Doctorado en Derecho Procesal y Sistemas Contemporáneos",
] as const;

export type Septiembre2026ProgramTitle =
  (typeof SEPTIEMBRE_2026_PROGRAMS)[number];

/** URL slug → form title (for Ads landing CTAs and ?programa= preselect). */
export const SEPTIEMBRE_2026_SLUG_TO_TITLE: Record<
  string,
  Septiembre2026ProgramTitle
> = {
  "maestria-en-derecho-internacional-derechos-humanos-y-litigio-estrategico":
    "Maestría en Derecho Internacional de Derechos Humanos y Litigio Estratégico",
  "especialidad-en-criminalistica-y-ciencias-forenses":
    "Especialidad en Criminalística y Ciencias Forenses",
  "maestria-en-derecho-civil-y-familiar": "Maestría en Derecho Civil y Familiar",
  "doctorado-en-derecho-procesal-y-sistemas-contemporaneos":
    "Doctorado en Derecho Procesal y Sistemas Contemporáneos",
};

const TITLE_BY_NORMALIZED = new Map(
  SEPTIEMBRE_2026_PROGRAMS.map((title) => [
    title.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase(),
    title,
  ]),
);

/**
 * Resolve `?programa=` from a slug or full title to a form option value.
 * Returns null if no match.
 */
export function resolveSeptiembre2026Program(
  raw: string | null | undefined,
): Septiembre2026ProgramTitle | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fromSlug = SEPTIEMBRE_2026_SLUG_TO_TITLE[trimmed];
  if (fromSlug) return fromSlug;

  if ((SEPTIEMBRE_2026_PROGRAMS as readonly string[]).includes(trimmed)) {
    return trimmed as Septiembre2026ProgramTitle;
  }

  const normalized = trimmed
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  return TITLE_BY_NORMALIZED.get(normalized) ?? null;
}

export const SEPTIEMBRE_2026_INSCRIPTION_PATH =
  "/inscripciones-septiembre-2026";

/** Build interest-form URL with program preselect (slug or title). */
export function buildSeptiembre2026CtaHref(
  programa: string,
  extraParams?: Record<string, string>,
): string {
  const params = new URLSearchParams();
  params.set("programa", programa);
  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      if (value) params.set(key, value);
    }
  }
  return `${SEPTIEMBRE_2026_INSCRIPTION_PATH}?${params.toString()}`;
}
