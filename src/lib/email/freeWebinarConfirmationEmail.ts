import { escapeHtml } from "@lib/htmlEscape";

export function isPlaceholderProgramCopy(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized === "por confirmar" ||
    normalized === "por definir"
  );
}

type FreeWebinarEmailOptions = {
  participantName: string;
  programTitle: string;
  startDate: string;
  horario: string;
  meetingLink: string;
  /** When false (default), show optional constancia upsell for free registrants. */
  constanciaPaid?: boolean;
  constanciaUpsellLink?: string;
  constanciaPrice?: number;
};

export function buildFreeWebinarParticipantEmail(
  options: FreeWebinarEmailOptions,
): { subject: string; html: string } {
  const {
    participantName,
    programTitle,
    startDate,
    horario,
    meetingLink,
    constanciaPaid = false,
    constanciaUpsellLink = "",
    constanciaPrice = 200,
  } = options;

  const safeName = escapeHtml(participantName);
  const safeTitle = escapeHtml(programTitle);
  const safeStart = escapeHtml(startDate);
  const safeHorario = escapeHtml(horario);
  const safeMeetingUrl = escapeHtml(meetingLink);
  const safeMeetingLabel = escapeHtml(
    meetingLink.includes("meet.google.com")
      ? "Unirse al webinar en Google Meet"
      : meetingLink,
  );

  const intro = constanciaPaid
    ? `<p>Tu registro al webinar gratuito y el pago de tu <strong>constancia de participación</strong> quedaron confirmados.</p>`
    : `<p>Tu registro al <strong>webinar gratuito</strong> quedó confirmado. Guarda este correo: aquí tienes el enlace para conectarte el día del evento.</p>`;

  const constanciaBlock = constanciaPaid
    ? `<p style="margin: 20px 0; padding: 14px 16px; background-color: #ecfdf5; border-left: 4px solid #059669; font-size: 14px;">
         Constancia de participación: <strong>pagada</strong>. La emitiremos conforme al proceso institucional después del webinar.
       </p>`
    : constanciaUpsellLink
      ? `<p style="margin: 20px 0; padding: 14px 16px; background-color: #fffbeb; border-left: 4px solid #c09418; font-size: 14px;">
           Si deseas tu <strong>constancia de participación</strong> (costo: $${constanciaPrice} MXN), puedes tramitarla en
           <a href="${escapeHtml(constanciaUpsellLink)}" style="color: #2563eb; font-weight: bold;">este enlace</a>.
         </p>`
      : "";

  const subject = constanciaPaid
    ? `Constancia y acceso al webinar — ${programTitle}`
    : `Registro confirmado — Webinar gratuito: ${programTitle}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background-color: #f8fafc; padding: 28px 20px; text-align: center; border-bottom: 2px solid #1e3a8a;">
        <img src="https://ceprija.edu.mx/images/logo.png" alt="CEPRIJA" style="max-width: 200px; height: auto; margin: 0 auto; display: block;">
      </div>
      <div style="padding: 28px 20px; background-color: #ffffff;">
        <p style="font-size: 13px; font-weight: bold; letter-spacing: 0.04em; text-transform: uppercase; color: #c09418; margin: 0 0 12px;">
          Webinar gratuito · CEPRIJA
        </p>
        <h1 style="font-size: 20px; line-height: 1.35; color: #1e3a8a; margin: 0 0 16px;">${safeTitle}</h1>
        <p>Hola <strong>${safeName}</strong>,</p>
        ${intro}
        <div style="background-color: #f8fafc; border-left: 4px solid #1e3a8a; padding: 16px; margin: 20px 0;">
          <h2 style="color: #1e3a8a; font-size: 16px; margin: 0 0 12px;">Detalles del webinar</h2>
          <p style="margin: 0 0 8px;">📅 <strong>Fecha:</strong> ${safeStart}</p>
          <p style="margin: 0 0 8px;">⏰ <strong>Horario:</strong> ${safeHorario}</p>
          <p style="margin: 0;">💻 <strong>Modalidad:</strong> En línea</p>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${safeMeetingUrl}" style="display: inline-block; background-color: #1e3a8a; color: #ffffff; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            ${safeMeetingLabel}
          </a>
        </div>
        <p style="font-size: 14px; color: #475569; margin: 0 0 8px;">
          Enlace directo: <a href="${safeMeetingUrl}" style="color: #2563eb;">${safeMeetingUrl}</a>
        </p>
        ${constanciaBlock}
        <p style="font-size: 14px; color: #666; margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          ¿Dudas? Escríbenos por WhatsApp al
          <a href="https://wa.me/+523317674864" style="color: #2563eb; text-decoration: none;">33 1767 4864</a>
          o a <a href="mailto:contacto@ceprija.edu.mx" style="color: #2563eb; text-decoration: none;">contacto@ceprija.edu.mx</a>.
        </p>
      </div>
    </div>
  `;

  return { subject, html };
}
