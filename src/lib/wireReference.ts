/**
 * Referencia corta para transferencias: `CEPRIJA-` + identificador sin guiones
 * (evita prefijos largos con nombre del programa).
 */
export function wireReferenceFromSessionId(sessionId: string): string {
  const compact = sessionId.replace(/-/g, "").slice(0, 12).toUpperCase();
  return `CEPRIJA-${compact}`;
}
