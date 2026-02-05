export const prerender = false;

import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';
import { programs } from '../../data/programs';
import Busboy from 'busboy';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { Readable } from 'stream';

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
    console.log('DEBUG: parseFormData iniciado');

    return new Promise<{ fields: any, file: any }>(async (resolve, reject) => {

        const headers = Object.fromEntries(request.headers.entries());
        const busboy = Busboy({ headers });

        const fields: any = {};
        let fileInfo: any = null;

        busboy.on('field', (name, val) => {
            console.log('DEBUG FIELD:', name, val);
            fields[name] = val;
        });

        busboy.on('file', async (fieldname, file, info) => {
            console.log('DEBUG FILE FIELD:', fieldname);

            if (fieldname !== 'paymentProof') {
                file.resume();
                return;
            }

            const { filename, mimeType } = info;

            const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
            if (!allowed.includes(mimeType)) {
                console.log('DEBUG: tipo no permitido', mimeType);
                file.resume();
                return reject(new Error('Tipo no permitido'));
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const sanitized = sanitizeFilename(fields.name || 'usuario');
            const ext = filename.split('.').pop();
            const newName = `${sanitized}_${timestamp}.${ext}`;

            const uploadDir = join(process.cwd(), 'public', 'uploads', 'comprobantes');
            const filepath = join(uploadDir, newName);

            await mkdir(uploadDir, { recursive: true });

            const ws = createWriteStream(filepath);
            file.pipe(ws);

            ws.on('finish', () => {
                console.log('DEBUG: archivo guardado', filepath);
                fileInfo = { filepath, filename: newName };
            });

            ws.on('error', reject);
        });

        busboy.on('finish', () => {
            console.log('DEBUG: busboy finish');
            resolve({ fields, file: fileInfo });
        });

        busboy.on('error', reject);

        // FIX STREAM NODE
        const nodeStream = Readable.fromWeb(request.body as any);
        nodeStream.pipe(busboy);
    });
}

export const POST: APIRoute = async ({ request }) => {

    console.log('DEBUG: endpoint POST ejecutado');

    try {

        const { fields, file } = await parseFormData(request);

        console.log('DEBUG fields:', fields);
        console.log('DEBUG file:', file);

        if (!import.meta.env.SMTP_HOST) {
            console.error('ERROR: variables .env no cargadas');
        }

        const transporter = nodemailer.createTransport({
            host: import.meta.env.SMTP_HOST,
            port: parseInt(import.meta.env.SMTP_PORT),
            secure: import.meta.env.SMTP_SECURE === 'true',
            auth: {
                user: import.meta.env.SMTP_USER,
                pass: import.meta.env.SMTP_PASS,
            },
        });

        console.log('DEBUG: transporter creado');

        await transporter.verify();
        console.log('DEBUG: SMTP OK');

        await transporter.sendMail({
            from: import.meta.env.CONTACT_EMAIL,
            to: import.meta.env.CONTACT_EMAIL,
            subject: 'TEST FORM OK',
            text: JSON.stringify(fields, null, 2),
            attachments: file ? [{ path: file.filepath }] : []
        });

        console.log('DEBUG: correo enviado');

        return new Response(JSON.stringify({ ok: true }), { status: 200 });

    } catch (err) {
        console.error('DEBUG ERROR:', err);

        return new Response(JSON.stringify({
            error: err instanceof Error ? err.message : 'unknown'
        }), { status: 500 });
    }
};
