export const prerender = false;

import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { parseWireRegistrationMultipart } from "@lib/multipart/parseWireRegistration";
import { escapeHtml } from "@lib/htmlEscape";
import { validateUploadBuffer } from "@lib/uploads/fileValidation";
import { parseWireRegisterFields } from "@lib/validation/enrollment";
import { CONTACT_EMAIL, KEY_API_BREVO, SMTP_FROM } from "astro:env/server";
import { getProgramStatus } from "@lib/programPayments";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { fields, paymentProof } = await parseWireRegistrationMultipart(request);

    const parsed = parseWireRegisterFields(fields);
    if (!parsed.ok) {
      return new Response(
        JSON.stringify({
          message: parsed.err.error,
          code: parsed.err.code,
          ...(parsed.err.field && { field: parsed.err.field }),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { name, email, phone, message, program: programTitle, type, modality } =
      parsed.data;

    if (paymentProof) {
      const fileCheck = validateUploadBuffer(paymentProof.buffer, paymentProof.mimetype, {
        field: "paymentProof",
      });
      if (!fileCheck.ok) {
        return new Response(
          JSON.stringify({
            message: fileCheck.err.error,
            code: fileCheck.err.code,
            ...(fileCheck.err.field && { field: fileCheck.err.field }),
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // Get program details from content collection
    const programs = await getCollection("programas");
    const program = programs.find((p) => p.data.title === programTitle);
    if (program && getProgramStatus(program) === "disabled") {
      return new Response(
        JSON.stringify({
          message: "Programa no disponible",
          code: "program_unavailable",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const instructor = String(program?.data.instructor || "Claustro Docente CEPRIJA");
    const startDate = String(program?.data.startDate || "Por confirmar");
    const schedule = String(program?.data.schedule || "Por confirmar");
    const address = String(program?.data.address || "Instalaciones de CEPRIJA - Lope de Vega #273, Col. Americana Arcos. C.P. 44500");
    const meetingLink = String((program?.data as { meetingLink?: string })?.meetingLink || "Se enviará previo al evento");

    const brevoKey = KEY_API_BREVO;
    if (!brevoKey) {
      throw new Error("Falta KEY_API_BREVO en .env");
    }

    const senderEmail = (SMTP_FROM ?? "").trim() || "desarrolloweb@ceprija.edu.mx";

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone);
    const safeProgram = escapeHtml(programTitle || "N/A");
    const safeMessage = escapeHtml(message || "N/A");
    const modalityDisplay = type === "contact" ? "No aplica" : modality;
    const safeModality = escapeHtml(modalityDisplay);

    const adminHtml = `
            <h2>Nuevo contacto desde la web</h2>
            <p><strong>Tipo:</strong> ${type === "registration" ? "Inscripción" : "Contacto General"}</p>
            <p><strong>Nombre:</strong> ${safeName}</p>
            <p><strong>Email:</strong> ${safeEmail}</p>
            <p><strong>Teléfono:</strong> ${safePhone}</p>
            <p><strong>Programa:</strong> ${safeProgram}</p>
            <p><strong>Modalidad:</strong> ${safeModality}</p>
            <p><strong>Mensaje:</strong> ${safeMessage}</p>
            ${paymentProof ? `<p><strong>Comprobante de pago:</strong> Adjunto</p>` : ""}
        `;

    const adminBody: Record<string, unknown> = {
      sender: { email: senderEmail },
      to: [{ email: CONTACT_EMAIL }],
      subject: `Nuevo ${type === "registration" ? "Registro" : "Mensaje"}: ${programTitle || "General"}`,
      htmlContent: adminHtml,
    };

    if (paymentProof?.buffer.length) {
      adminBody.attachment = [
        {
          name: paymentProof.filename,
          content: paymentProof.buffer.toString("base64"),
        },
      ];
    }

    try {
      const adminRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": brevoKey,
        },
        body: JSON.stringify(adminBody),
      });

      if (!adminRes.ok) {
        const txt = await adminRes.text();
        console.error("ERROR Brevo (admin):", adminRes.status, txt);
      } else {
        console.log("Admin email sent via Brevo");
      }
    } catch (error) {
      console.error("Error sending admin email:", error);
    }

    if (type === "registration" && email) {
      const isOnline = modality === "En línea";

      const emailSubject = `Confirmación de Registro - ${programTitle}`;

      const safeInstructor = escapeHtml(instructor);
      const safeStart = escapeHtml(startDate);
      const safeSchedule = escapeHtml(schedule);
      const safeAddress = escapeHtml(address);
      const safeMeeting = escapeHtml(meetingLink);
      const safeProgramTitle = escapeHtml(programTitle);

      const emailBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <div style="background-color: #f8fafc; padding: 30px 20px; text-align: center; border-bottom: 2px solid #1e3a8a;">
                    <img src="https://ceprija.edu.mx/images/logo.png" alt="CEPRIJA" style="max-width: 200px; height: auto; margin: 0 auto; display: block;">
                </div>

                <div style="padding: 30px 20px; background-color: #ffffff;">
                    <p style="font-size: 16px; margin-bottom: 20px;">
                        <strong>${safeProgramTitle}</strong>
                    </p>
                    <p>Estimado(a): <strong>${safeName}</strong></p>
                    
                    <p>Reciba un cordial saludo, le notificamos por este medio que se ha confirmado su participación 
                    <strong>${isOnline ? "en línea" : "presencial"}</strong> para el <strong>${safeProgramTitle}</strong> 
                    con el <strong>${safeInstructor}</strong>. Su participación es muy valiosa para nosotros 
                    y estamos seguros de que esta capacitación será de mucho aprendizaje para usted.</p>
                    
                    <p>A continuación le compartimos información valiosa para su asistencia.</p>

                    <div style="background-color: #f8fafc; border-left: 4px solid #1e3a8a; padding: 15px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <h3 style="color: #1e3a8a; margin-top: 0;">Detalles del evento:</h3>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            <li style="margin-bottom: 8px;">📅 <strong>Fecha:</strong> ${safeStart}</li>
                            <li style="margin-bottom: 8px;">⏰ <strong>Duración:</strong> ${safeSchedule}</li>
                            ${
                              isOnline
                                ? `<li style="margin-bottom: 8px;">💻 <strong>Enlace en línea:</strong> <a href="${escapeHtml(meetingLink)}" style="color: #2563eb;">${safeMeeting}</a></li>
                                   <li style="margin-bottom: 8px;">📍 <strong>Alternativa presencial:</strong> ${safeAddress}</li>`
                                : `<li style="margin-bottom: 8px;">📍 <strong>Instalaciones:</strong> ${safeAddress}</li>`
                            }
                        </ul>
                    </div>

                    <p style="font-size: 14px; color: #666; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                        Para cualquier duda o aclaración favor de comunicarse al:<br>
                        📱 <strong>Whatsapp:</strong> <a href="https://wa.me/+523317674864" style="color: #2563eb; text-decoration: none;">33 1767 4864</a><br>
                        ✉️ <strong>Correo electrónico:</strong> <a href="mailto:contacto@ceprija.edu.mx" style="color: #2563eb; text-decoration: none;">contacto@ceprija.edu.mx</a>
                    </p>

                    <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #94a3b8;">
                        <p>Para más información visite nuestros sitios oficiales:<br>
                        <a href="https://ceprija.edu.mx/" style="color: #64748b;">Página Web</a> • 
                        <a href="https://www.facebook.com/ceprijaedu.mx" style="color: #64748b;">Facebook</a> • 
                        <a href="https://www.instagram.com/ceprijaedu" style="color: #64748b;">Instagram</a></p>
                    </div>
                </div>
            </div>
            `;

      const userBody = {
        sender: { email: senderEmail, name: "Equipo CEPRIJA" },
        to: [{ email: email }],
        subject: emailSubject,
        htmlContent: emailBody,
      };

      try {
        const userRes = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": brevoKey,
          },
          body: JSON.stringify(userBody),
        });

        if (!userRes.ok) {
          const txt = await userRes.text();
          console.error("ERROR Brevo (user):", userRes.status, txt);
        } else {
          console.log("User confirmation email sent via Brevo");
        }
      } catch (error) {
        console.error("Error sending user confirmation email:", error);
      }
    }

    return new Response(JSON.stringify({ message: "Recibido correctamente" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const code =
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "file_too_large"
        ? "file_too_large"
        : undefined;
    if (code === "file_too_large") {
      return new Response(
        JSON.stringify({
          message: "Archivo demasiado grande (máx. 10 MB)",
          code: "file_too_large",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    console.error("Error processing registration:", error);
    return new Response(
      JSON.stringify({
        message: "Error al procesar la solicitud",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
