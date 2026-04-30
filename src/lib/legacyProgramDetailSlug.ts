/** Maps legacy `programs-*.js` `id` values to the canonical detail slug used in content collections. */
export const LEGACY_ID_TO_DETAIL_SLUG: Record<string, string> = {
  "maestria-derecho-penal": "maestria-en-derecho-penal",
  "maestria-derecho-civil": "maestria-en-derecho-civil",
  "maestria-derecho-internacional": "maestria-en-derecho-internacional",
  "especialidad-criminalistica": "especialidad-en-criminalistica",
  "doctorado-derecho-procesal": "doctorado-en-derecho",
  "diplomado-derecho-mercantil-oral": "diplomado-en-derecho-mercantil-oral",
  "curso-penal-fiscal-2026": "curso-penal-fiscal-2026",
  "cancelacion-sellos-digitales": "curso-en-sellos-digitales",
  "mi-futuro-mi-patrimonio": "curso-finanzas-personales",
  "actualizacion-jurisprudencial-en-materia-fiscal":
    "actualizacion-jurisprudencial-en-materia-fiscal",
};

export function hrefForLegacyProgram(legacyId: string): string {
  const slug = LEGACY_ID_TO_DETAIL_SLUG[legacyId] ?? legacyId;
  return `/oferta-academica/${slug}`;
}
