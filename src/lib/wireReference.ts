/** Bank / wire forms cap (must match server validation). */
export const MAX_WIRE_REFERENCE_LEN = 80;

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function asciiSlugSegment(raw: string): string {
  const t = stripDiacritics(raw.trim())
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return t || "programa";
}

/**
 * First letter of each whitespace-delimited word in nombre + apellidos,
 * uppercase A–Z only (skips words with no Latin letters).
 */
export function initialsFromNombreApellidos(
  nombre: string,
  apellidos: string,
  maxLetters = 20,
): string {
  const combined = `${nombre} ${apellidos}`.trim();
  const words = combined.split(/\s+/).filter(Boolean);
  let out = "";
  for (const w of words) {
    const stripped = stripDiacritics(w);
    const m = stripped.match(/[a-zA-Z]/);
    if (m) out += m[0].toUpperCase();
    if (out.length >= maxLetters) break;
  }
  return out || "X";
}

/**
 * Referencia para transferencia: `{programa}-{iniciales}`.
 * Trunca el segmento del programa primero si excede el máximo.
 */
export function buildWireReferenceFromApplicant(
  programTitle: string,
  nombre: string,
  apellidos: string,
  maxLen = MAX_WIRE_REFERENCE_LEN,
): string {
  const progBase = asciiSlugSegment(programTitle);
  const initials = initialsFromNombreApellidos(nombre, apellidos, 20);

  const join = (p: string, i: string) => `${p}-${i}`;

  let prog = progBase.slice(0, 48);
  let ref = join(prog, initials);
  if (ref.length <= maxLen) return ref;

  const minProg = 4;
  let budget = maxLen - 1 - initials.length;
  if (budget < minProg) {
    const maxIni = Math.max(1, maxLen - 1 - minProg);
    const shortIni = initials.slice(0, maxIni);
    return join(progBase.slice(0, minProg), shortIni).slice(0, maxLen);
  }
  prog = progBase.slice(0, budget);
  ref = join(prog, initials);
  if (ref.length <= maxLen) return ref;

  const maxIni = Math.max(1, maxLen - 1 - prog.length);
  return join(prog, initials.slice(0, maxIni)).slice(0, maxLen);
}

/**
 * @deprecated Prefer {@link buildWireReferenceFromApplicant} for new wire UX.
 */
export function wireReferenceFromSessionId(sessionId: string): string {
  const compact = sessionId.replace(/-/g, "").slice(0, 12).toUpperCase();
  return `CEPRIJA-${compact}`;
}
