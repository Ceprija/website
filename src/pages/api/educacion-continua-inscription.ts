export const prerender = false;

import type { APIRoute } from 'astro';
import { programs } from '../../data/legacy/programs';
import emailTemplates from '../../data/forms/email-templates-educacion-continua.json';
import Busboy from 'busboy';

function sanitizeFilename(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

async function parseFormData(request: Request) {
    return new Promise<{ fields: Record<string, string>, files: Array<{ fieldname: string, buffer: Buffer, filename: string, mimetype: string }> }>((resolve, reject) => {
        const busboy = Busboy({ headers: Object.fromEntries(request.headers.entries()) });
        const fields: Record<string, string> = {};
        const files: Array<{ fieldname: string, buffer: Buffer, filename: string, mimetype: string }> = [];

        busboy.on('field', (fieldname, value) => {
            fields[fieldname] = value;
        });

        busboy.on('file', (fieldname, file, info) => {
            const { filename, mimeType } = info;

            if (!filename) {
                file.resume();
                return;
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const userName = fields.name || 'usuario';
            const sanitizedName = sanitizeFilename(userName);
            const ext = filename.split('.').pop() || 'file';

            const newFilename = `${fieldname}_${sanitizedName}_${timestamp}.${ext}`;

            const chunks: Buffer[] = [];
            file.on('data', (data: Buffer) => {
                chunks.push(data);
            });
            file.on('end', () => {
                files.push({
                    fieldname,
                    buffer: Buffer.concat(chunks),
                    filename: newFilename,
                    mimetype: mimeType
                });
            });
            file.on('error', (err: Error) => {
                reject(err);
            });
        });

        busboy.on('finish', () => {
            setTimeout(() => resolve({ fields, files }), 200);
        });

        busboy.on('error', reject);

        request.body?.pipeTo(new WritableStream({
            write(chunk) { busboy.write(chunk); },
            close() { busboy.end(); }
        }));
    });
}

function replacePlaceholders(template: string, data: Record<string, string>) {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, value || '');
    }
    return result;
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const { fields, files } = await parseFormData(request);
        const {
            name, email, phone, programTitle, programId, modality,
            requiresInvoice, invoiceEmail
        } = fields;

        const programDetails = programs.find(p => p.id === programId || p.title === programTitle) || {};

        // CSV in-memory generation
        const header = "FECHA,NOMBRE,EMAIL,TELEFONO,MODALIDAD,FACTURA,EMAIL FACTURA\n";
        const now = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
        const csvRow = [
            `"${now}"`,
            `"${name.toUpperCase()}"`,
            email.toLowerCase(),
            phone,
            modality.toUpperCase(),
            requiresInvoice.toUpperCase(),
            (invoiceEmail || '').toLowerCase()
        ].join(',') + '\n';

        const csvContent = header + csvRow;

        // Brevo API Key
        const brevoKey = import.meta.env.KEY_API_BREVO;
        if (!brevoKey) throw new Error('Falta KEY_API_BREVO');

        const senderEmail = import.meta.env.SMTP_FROM || import.meta.env.CONTACT_EMAIL;
        const adminEmail1 = import.meta.env.EMAIL_EDUCACION_CONTINUA || import.meta.env.CONTACT_EMAIL;
        const adminEmail2 = import.meta.env.EMAIL_SOPORTE_WEB;

        // 1. Admin Email
        const sendToBrevo = async () => {
            try {
                // 1. Admin Email
                const adminHtml = `
                    <h2>Nueva Inscripción Educación Continua</h2>
                    <p><strong>Programa:</strong> ${programTitle}</p>
                    <p><strong>Participante:</strong> ${name}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Teléfono:</strong> ${phone}</p>
                    <p><strong>Modalidad:</strong> ${modality}</p>
                    <p><strong>¿Factura?:</strong> ${requiresInvoice}</p>
                    ${requiresInvoice === 'Sí' ? `<p><strong>Email Factura:</strong> ${invoiceEmail}</p>` : ''}
                `;

                const adminBody: any = {
                    sender: { email: senderEmail, name: "CEPRIJA Web" },
                    to: [{ email: adminEmail1 }, { email: adminEmail2 }],
                    subject: `INSCRIPCIÓN EC: ${programTitle} - ${name}`,
                    htmlContent: adminHtml,
                    attachment: []
                };

                if (adminEmail2) adminBody.to.push({ email: adminEmail2 });

                // Add attachments to admin email
                for (const f of files) {
                    adminBody.attachment.push({
                        name: f.filename,
                        content: f.buffer.toString('base64')
                    });
                }

                // Also attach the CSV
                const csvBase64 = Buffer.from(csvContent).toString('base64');
                adminBody.attachment.push({
                    name: `${sanitizeFilename(programTitle || 'ec-general')}.csv`,
                    content: csvBase64
                });

                await fetch('https://api.brevo.com/v3/smtp/email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'api-key': brevoKey },
                    body: JSON.stringify(adminBody)
                });

                // 2. User Confirmation Email
                const templateSet = (emailTemplates as any)[programId] || emailTemplates.default;
                const modalityKey = modality.toLowerCase().includes('línea') || modality.toLowerCase().includes('online') ? 'en_linea' : 'presencial';
                const template = templateSet[modalityKey] || emailTemplates.default[modalityKey];

                const templateData = {
                    name: name,
                    programTitle: programTitle,
                    startDate: programDetails.startDate || 'Por confirmar',
                    schedule: programDetails.schedule || 'Por confirmar',
                    instructor: programDetails.instructor || 'Claustro Docente CEPRIJA',
                    address: programDetails.address || (programDetails as any).address || 'Lope de Vega #273, Guadalajara',
                    meetingLink: (programDetails as any).meetingLink || 'Se enviará previo al inicio'
                };

                const userHtml = replacePlaceholders(template.body, templateData);
                const userSubject = replacePlaceholders(template.subject, templateData);

                await fetch('https://api.brevo.com/v3/smtp/email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'api-key': brevoKey },
                    body: JSON.stringify({
                        sender: { email: senderEmail, name: "Equipo CEPRIJA" },
                        to: [{ email }],
                        subject: userSubject,
                        htmlContent: userHtml
                    })
                });
            } catch (err) {
                console.error('Error enviando a Brevo:', err);
            }
        };

        const sendToLaravel = async () => {
            try {
                const apiUrl = import.meta.env.URL_BASE_API;
                if (!apiUrl) return;

                const formPayload = new FormData();

                const appendIfExists = (key: string, val: any) => { if (val) formPayload.append(key, val); };

                appendIfExists('nombre', name);
                appendIfExists('email', email);
                appendIfExists('telefono', phone);
                appendIfExists('programa', programTitle);
                appendIfExists('programa_id', programId);
                appendIfExists('modalidad', modality);
                formPayload.append('requiere_factura', requiresInvoice === 'Sí' ? '1' : '0');
                appendIfExists('email_factura', invoiceEmail);

                // Comprobante de pago (si existe)
                const paymentProof = files.find(f => f.fieldname === 'paymentProof' || f.fieldname === 'comprobantePago');
                if (paymentProof && paymentProof.buffer) {
                    formPayload.append('comprobante_pago_doc', new Blob([new Uint8Array(paymentProof.buffer)], { type: paymentProof.mimetype }), paymentProof.filename);
                }

                // Constancia de Situación Fiscal (si existe)
                const fiscalConstancy = files.find(f => f.fieldname === 'fiscalConstancy');
                if (fiscalConstancy && fiscalConstancy.buffer) {
                    formPayload.append('comprobante_fiscal_doc', new Blob([new Uint8Array(fiscalConstancy.buffer)], { type: fiscalConstancy.mimetype }), fiscalConstancy.filename);
                }

                console.log(`Sending EC data to API: ${apiUrl}educacion-continua/registro`);
                const apiRes = await fetch(`${apiUrl}educacion-continua/registro`, {
                    method: 'POST',
                    headers: { 'Accept': 'application/json' },
                    body: formPayload
                });

                if (!apiRes.ok) {
                    console.error('Laravel API Error response:', await apiRes.text());
                } else {
                    console.log('Successfully saved EC registration to Laravel API.');
                }
            } catch (apiError) {
                console.error('Failed to send EC data to Laravel API:', apiError);
            }
        };


        await Promise.allSettled([sendToBrevo(), sendToLaravel()]);

        return new Response(JSON.stringify({ message: 'Ok' }), { status: 200 });
    } catch (error: any) {
        console.error(error);
        return new Response(JSON.stringify({ message: error.message }), { status: 500 });
    }
};
