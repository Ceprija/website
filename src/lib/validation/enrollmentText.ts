/**
 * Validación y saneamiento defensivo para campos de texto en solicitudes de admisión.
 * Objetivo: limitar caracteres problemáticos para correos/HTML sin rechazar texto español.
 */

import { isValidPhone } from "@lib/validation/phone";

const CONTROL_CHARS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

/** Nombre / apellidos / carrera / institución */
const SAFE_NAME_RE =
  /^[\p{L}\p{M}0-9\s.,'\-()/&°]{1,200}$/u;

/** Domicilio (limitado: hay campos separados de CP/ciudad/estado en el flujo extendido) */
const SAFE_ADDRESS_RE =
  /^[\p{L}\p{M}0-9\s.,'\-#/():;&°\n\r]{1,500}$/u;

/** Notas de salud / texto libre largo */
const SAFE_LONG_TEXT_RE =
  /^[\p{L}\p{M}0-9\s.,'\-#/():;&°\n\r]{1,2000}$/u;

/** Cédula profesional SEP (típicamente 7 u 8 dígitos) */
export const CEDULA_PROFESIONAL_RE = /^\d{7,8}$/;

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/** Caracteres permitidos en un teléfono antes de validar longitud con isValidPhone */
const PHONE_ALLOWED_CHARS_RE = /^[+()\d\s\-]{1,25}$/;

export function stripControlChars(input: string): string {
  return input.replace(CONTROL_CHARS, "").trim();
}

export function clampLength(input: string, max: number): string {
  return input.length <= max ? input : input.slice(0, max);
}

export function validateEmailBasic(email: string): boolean {
  return EMAIL_RE.test(email) && email.length <= 254;
}

/**
 * Teléfono MX: exactamente 10 dígitos nacionales (permite prefijos +52 / 521).
 * Se apoya en `isValidPhone` para mantener client/server consistentes y rechazar
 * cadenas de 11+ dígitos aleatorios que antes pasaban con la validación laxa.
 */
export function validatePhoneBasic(phone: string): boolean {
  if (!PHONE_ALLOWED_CHARS_RE.test(phone)) return false;
  return isValidPhone(phone);
}

export function validatePersonName(name: string): boolean {
  const s = stripControlChars(name);
  return SAFE_NAME_RE.test(s);
}

export function validateLongText(text: string): boolean {
  const s = stripControlChars(text);
  return SAFE_LONG_TEXT_RE.test(s);
}

export function validateAddress(text: string): boolean {
  const s = stripControlChars(text);
  return SAFE_ADDRESS_RE.test(s);
}

export function validateCedulaDoctorado(cedula: string): boolean {
  return CEDULA_PROFESIONAL_RE.test(cedula.trim());
}
