import { emailLogoImgTag, EMAIL_LOGO_URL } from "@lib/email/emailLogo";
import { escapeHtml } from "@lib/htmlEscape";

/** Absolute site origin for email image URLs (same host as {@link EMAIL_LOGO_URL}). */
const EMAIL_ASSET_ORIGIN = new URL(EMAIL_LOGO_URL).origin;

/**
 * Per-program Guía de Trámites (admission stages) for posgrado application emails.
 * Same pattern as the CEPRIJA email logo: PNG under `public/images/email/`, referenced
 * with an absolute `https://ceprija.edu.mx/...` URL (must be deployed to production).
 *
 * Add a program by dropping a PNG and mapping the slug. Omit a slug to skip the image.
 */
export const ADMISSION_GUIDE_IMAGE_BY_SLUG: Record<string, string> = {
  "especialidad-en-criminalistica-y-ciencias-forenses":
    "/images/email/guia-tramites-especialidad-criminalistica-2026c.png",
  "doctorado-en-derecho-procesal-y-sistemas-contemporaneos":
    "/images/email/guia-tramites-doctorado-derecho-procesal-2026c.png",
  "maestria-en-derecho-civil-y-familiar":
    "/images/email/guia-tramites-maestria-derecho-civil-familiar-2026c.png",
  "maestria-en-derecho-internacional-derechos-humanos-y-litigio-estrategico":
    "/images/email/guia-tramites-maestria-derecho-internacional-2026c.png",
};

function admissionGuideAbsoluteUrl(publicPath: string): string {
  return `${EMAIL_ASSET_ORIGIN}${publicPath.startsWith("/") ? publicPath : `/${publicPath}`}`;
}

export function getAdmissionGuideImagePath(
  programSlug: string,
): string | undefined {
  return ADMISSION_GUIDE_IMAGE_BY_SLUG[programSlug];
}

type PosgradoApplicationEmailOptions = {
  participantName: string;
  participantLastName: string;
  programTitle: string;
  programSlug: string;
  applicationId: string;
  modality: string;
  controlEscolarEmail: string;
  variantModuleDisplay?: string;
  variantDateDisplay?: string;
};

/**
 * Participant email after posgrado admission wizard submit
 * (maestría / especialidad / doctorado).
 */
export function buildPosgradoApplicationEmail(
  options: PosgradoApplicationEmailOptions,
): { subject: string; html: string } {
  const {
    participantName,
    participantLastName,
    programTitle,
    programSlug,
    applicationId,
    modality,
    controlEscolarEmail,
    variantModuleDisplay = "",
    variantDateDisplay = "",
  } = options;

  const safeNombre = escapeHtml(participantName);
  const safeApellidos = escapeHtml(participantLastName);
  const safeTitle = escapeHtml(programTitle);
  const safeModality = escapeHtml(modality);
  const safeAppId = escapeHtml(applicationId);
  const safeControl = escapeHtml(controlEscolarEmail);

  const guidePath = getAdmissionGuideImagePath(programSlug);
  const guideBlock = guidePath
    ? `
      <p style="margin: 24px 0 12px; color: #1e3a8a; font-size: 16px; font-weight: bold;">
        Etapas de tu inscripción
      </p>
      <p style="margin: 0 0 16px; font-size: 14px; color: #475569;">
        Mientras tanto, te compartimos las etapas de tu inscripción para que conozcas lo que sigue.
      </p>
      <img
        src="${escapeHtml(admissionGuideAbsoluteUrl(guidePath))}"
        alt="Guía de trámites — proceso de admisión ${safeTitle}"
        width="560"
        style="max-width: 100%; width: 100%; height: auto; display: block; margin: 0 auto 8px; border: 0; outline: none;"
      />
    `
    : `
      <p style="margin: 24px 0 0; font-size: 14px; color: #475569;">
        Mientras tanto, Control Escolar te indicará las etapas de tu inscripción cuando te contacte.
      </p>
    `;

  const variantLines = [
    variantModuleDisplay
      ? `<p style="margin: 0 0 8px;"><strong>Módulo / paquete:</strong> ${escapeHtml(variantModuleDisplay)}</p>`
      : "",
    variantDateDisplay
      ? `<p style="margin: 0;"><strong>Fecha de inicio:</strong> ${escapeHtml(variantDateDisplay)}</p>`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const detailsBlock = `
        <div style="background-color: #f8fafc; border-left: 4px solid #1e3a8a; padding: 16px; margin: 24px 0 0;">
          <p style="margin: 0 0 8px;"><strong>ID de solicitud:</strong> ${safeAppId}</p>
          <p style="margin: 0 0 8px;"><strong>Programa:</strong> ${safeTitle}</p>
          <p style="margin: 0 0 8px;"><strong>Modalidad:</strong> ${safeModality}</p>
          ${variantLines}
        </div>
  `;

  const subject = `Registro recibido — ${programTitle}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background-color: #f8fafc; padding: 20px 20px 16px; text-align: center; border-bottom: 2px solid #1e3a8a;">
        ${emailLogoImgTag()}
      </div>
      <div style="padding: 28px 20px; background-color: #ffffff;">
        <p style="font-size: 22px; line-height: 1.4; margin: 0 0 16px;">
          🎉 ¡Felicidades! Has dado el primer paso para impulsar tu desarrollo profesional.
        </p>
        <p style="margin: 0 0 12px;">
          Hola <strong>${safeNombre} ${safeApellidos}</strong>,
        </p>
        <p style="margin: 0 0 16px;">
          Tu registro para iniciar el proceso de inscripción a tu posgrado en CEPRIJA se ha realizado con éxito. ✅
        </p>
        <p style="margin: 0 0 16px;">
          En un plazo máximo de <strong>48 horas</strong>, nuestro Departamento de Control Escolar se pondrá en contacto contigo para acompañarte durante todo el proceso.
        </p>

        ${guideBlock}

        <p style="margin: 28px 0 12px;">
          ¡Gracias por confiar en CEPRIJA! Será un gusto acompañarte en esta nueva etapa de tu desarrollo académico y profesional. ⚖️📚
        </p>

        ${detailsBlock}

        <p style="font-size: 14px; color: #666; margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          ¿Dudas? Escríbenos a
          <a href="mailto:${safeControl}" style="color: #2563eb; text-decoration: none;">${safeControl}</a>
          o llama al (33) 3826-4863.
        </p>
      </div>
      <div style="background: #1e3a8a; color: white; padding: 20px; text-align: center; font-size: 12px;">
        <p style="margin: 0 0 6px;">Centro de Preparación Integral en Materia Jurídica y Administrativa (CEPRIJA)</p>
        <p style="margin: 0;">Lope de Vega #273, Col. Americana Arcos, Guadalajara, Jalisco</p>
      </div>
    </div>
  `;

  return { subject, html };
}
