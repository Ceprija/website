/**
 * Mitiga inyección de cabeceras (p. ej. CRLF en Subject) y nombres de adjunto
 * extraños al enviar JSON a proveedores tipo Brevo.
 */

const CTRL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Asunto de correo: una línea, sin saltos ni caracteres de control; longitud acotada. */
export function sanitizeEmailSubjectLine(input: string, maxLen = 200): string {
  let s = String(input ?? "").replace(/\r|\n/g, " ");
  s = s.replace(CTRL_RE, "");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > maxLen) s = s.slice(0, maxLen).trim();
  return s || "(sin asunto)";
}

/**
 * Nombre de archivo en el JSON de adjuntos: sin rutas, sin saltos de línea, longitud acotada.
 */
export function sanitizeMailAttachmentFileName(input: string, maxLen = 120): string {
  let s = String(input ?? "").replace(/\\/g, "/");
  const slash = s.lastIndexOf("/");
  if (slash >= 0) s = s.slice(slash + 1);
  s = s.replace(CTRL_RE, "").trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s || "adjunto";
}
