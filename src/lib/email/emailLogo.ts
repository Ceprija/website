/** PNG logo for HTML emails (Gmail/Outlook do not reliably render WebP or SVG). */
export const EMAIL_LOGO_URL =
  "https://ceprija.edu.mx/images/branding/logos/logo-email.png";

/** Logo is 400×210; scale height proportionally when width changes. */
export function emailLogoImgTag(width = 150): string {
  const height = Math.round((width * 210) / 400);
  return `<img src="${EMAIL_LOGO_URL}" alt="CEPRIJA" width="${width}" height="${height}" style="max-width: ${width}px; width: ${width}px; height: ${height}px; margin: 0 auto; display: block; border: 0; outline: none; text-decoration: none;">`;
}
