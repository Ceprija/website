/**
 * Teléfonos con enfoque México: se normalizan a 10 dígitos nacionales.
 * Acepta prefijos comunes: +52, 52, 521 (móvil desde el extranjero), 00, 011.
 */

export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Devuelve los 10 dígitos del abonado en México o `null`.
 * Valida que el primer dígito del número nacional sea 2–9 (códigos de área MX).
 */
export function normalizeMexicoNationalTenDigits(raw: string): string | null {
  let d = normalizePhoneDigits(raw);
  if (d.length === 0) return null;

  if (d.startsWith("011")) d = d.slice(3);
  else if (d.startsWith("00")) d = d.slice(2);

  for (let i = 0; i < 4; i++) {
    if (d.length === 10) break;
    if (d.length >= 13 && d.startsWith("521")) {
      d = d.slice(3);
      continue;
    }
    if (d.length >= 12 && d.startsWith("52")) {
      d = d.slice(2);
      continue;
    }
    break;
  }

  if (d.length !== 10 || !/^[2-9]\d{9}$/.test(d)) return null;
  return d;
}

export function isValidPhone(phone: string): boolean {
  return normalizeMexicoNationalTenDigits(phone) !== null;
}

/**
 * Devuelve los 10 dígitos canónicos de un teléfono MX válido.
 * PRECONDICIÓN: `isValidPhone(raw)` debe ser true. Si no, lanza error.
 * Usar esto DESPUÉS de validar para normalizar en CSV/correos/metadata.
 */
export function canonicalMexicoTenDigitPhone(raw: string): string {
  const normalized = normalizeMexicoNationalTenDigits(raw);
  if (normalized === null) {
    throw new Error(
      `canonicalMexicoTenDigitPhone: teléfono inválido "${raw}". Debe validarse con isValidPhone primero.`,
    );
  }
  return normalized;
}
