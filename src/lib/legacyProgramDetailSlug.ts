/** Maps legacy `programs-*.js` `id` values to the canonical detail slug used in content collections. */
export const LEGACY_ID_TO_DETAIL_SLUG: Record<string, string> = {
  "maestria-derecho-penal":
    "maestria-en-derecho-penal-y-litigacion-oral-avanzada",
  "maestria-derecho-civil": "maestria-en-derecho-civil-y-familiar",
  "maestria-derecho-internacional":
    "maestria-en-derecho-internacional-derechos-humanos-y-litigio-estrategico",
  "especialidad-criminalistica":
    "especialidad-en-criminalistica-y-ciencias-forenses",
  "doctorado-derecho-procesal":
    "doctorado-en-derecho-procesal-y-sistemas-contemporaneos",
  "diplomado-derecho-mercantil-oral": "diplomado-en-derecho-mercantil-oral",
  "curso-penal-fiscal-2026": "curso-penal-fiscal-2026",
  "cancelacion-sellos-digitales": "curso-cancelacion-sellos-digitales",
  "mi-futuro-mi-patrimonio": "curso-mi-futuro-mi-patrimonio",
  "actualizacion-jurisprudencial-en-materia-fiscal":
    "curso-actualizacion-jurisprudencial-en-materia-fiscal",
};

export function hrefForLegacyProgram(legacyId: string): string {
  const slug = LEGACY_ID_TO_DETAIL_SLUG[legacyId] ?? legacyId;
  return `/oferta-academica/${slug}`;
}
