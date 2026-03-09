export const prerender = false;

import type { APIRoute } from 'astro';
import { programs } from '../../data/programs';
import emailTemplates from '../../data/email-templates-educacion-continua.json';
import Busboy from 'busboy';
import { createWriteStream, appendFileSync, existsSync } from 'fs';
import { mkdir, readFile } from 'fs/promises';
import { join } from 'path';

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
    return new Promise<{ fields: Record<string, string>, files: Array<{ fieldname: string, filepath: string, filename: string, mimetype: string }> }>((resolve, reject) => {
        const busboy = Busboy({ headers: Object.fromEntries(request.headers.entries()) });
        const fields: Record<string, string> = {};
        const files: Array<{ fieldname: string, filepath: string, filename: string, mimetype: string }> = [];

        busboy.on('field', (fieldname, value) => {
            fields[fieldname] = value;
        });

        busboy.on('file', async (fieldname, file, info) => {
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
            const uploadDir = join(process.cwd(), 'public', 'uploads', 'educacion-continua');
            const filepath = join(uploadDir, newFilename);

            try {
                await mkdir(uploadDir, { recursive: true });
                const writeStream = createWriteStream(filepath);
                file.pipe(writeStream);

                writeStream.on('finish', () => {
                    files.push({ fieldname, filepath, filename: newFilename, mimetype: mimeType });
                });
            } catch (err) {
                reject(err);
            }
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

        // CSV Storage
        const csvDir = join(process.cwd(), 'src', 'data', 'inscripciones');
        await mkdir(csvDir, { recursive: true });
        const csvPath = join(csvDir, `${sanitizeFilename(programTitle || 'ec-general')}.csv`);

        const header = "FECHA,NOMBRE,EMAIL,TELEFONO,MODALIDAD,FACTURA,EMAIL FACTURA\n";
        if (!existsSync(csvPath)) {
            appendFileSync(csvPath, header);
        }

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

        appendFileSync(csvPath, csvRow);

        // Brevo API Key
        const brevoKey = import.meta.env.KEY_API_BREVO;
        if (!brevoKey) throw new Error('Falta KEY_API_BREVO');

        const senderEmail = import.meta.env.SMTP_FROM || import.meta.env.CONTACT_EMAIL;
        const adminEmail1 = import.meta.env.EMAIL_EDUCACION_CONTINUA || import.meta.env.CONTACT_EMAIL;
        const adminEmail2 = import.meta.env.EMAIL_SOPORTE_WEB;

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
            to: [{ email: adminEmail1 }],
            subject: `INSCRIPCIÓN EC: ${programTitle} - ${name}`,
            htmlContent: adminHtml,
            attachment: []
        };

        if (adminEmail2) adminBody.to.push({ email: adminEmail2 });

        // Add attachments to admin email
        for (const f of files) {
            const content = await readFile(f.filepath);
            adminBody.attachment.push({
                name: f.filename,
                content: content.toString('base64')
            });
        }

        // Also attach the CSV
        const csvData = await readFile(csvPath);
        adminBody.attachment.push({
            name: `${sanitizeFilename(programTitle)}.csv`,
            content: csvData.toString('base64')
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

        return new Response(JSON.stringify({ message: 'Ok' }), { status: 200 });
    } catch (error: any) {
        console.error(error);
        return new Response(JSON.stringify({ message: error.message }), { status: 500 });
    }
};
