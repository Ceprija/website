export const prerender = false;

import type { APIRoute } from 'astro';
import Busboy from 'busboy';
import { createWriteStream, existsSync } from 'fs';
import { mkdir, appendFile, readFile } from 'fs/promises';
import { join } from 'path';

// Helper function to sanitize filename
function sanitizeFilename(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

// Helper to parse multipart form data
function parseFormData(request: Request): Promise<{ fields: Record<string, string>, files: Record<string, { filepath: string, filename: string, mimetype: string }> }> {
    return new Promise((resolve, reject) => {
        const busboy = Busboy({ headers: Object.fromEntries(request.headers.entries()) });
        const fields: Record<string, string> = {};
        const files: Record<string, { filepath: string, filename: string, mimetype: string }> = {};
        const fileUploadPromises: Promise<void>[] = [];

        busboy.on('field', (fieldname: string, value: string) => {
            fields[fieldname] = value;
        });

        busboy.on('file', (fieldname: string, file: any, info: any) => {
            const { filename, mimeType } = info;
            if (!filename) {
                file.resume();
                return;
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const sanitizedUser = sanitizeFilename(`${fields.nombre || 'usuario'}_${fields.apellidos || ''}`);
            const ext = filename.split('.').pop() || 'file';
            const newFilename = `${sanitizedUser}_${fieldname}_${timestamp}.${ext}`;

            const uploadDir = join(process.cwd(), 'public', 'uploads', 'inscripciones');
            const filepath = join(uploadDir, newFilename);

            const filePromise = (async () => {
                await mkdir(uploadDir, { recursive: true });
                return new Promise<void>((fResolve, fReject) => {
                    const writeStream = createWriteStream(filepath);
                    file.pipe(writeStream);
                    writeStream.on('finish', () => {
                        files[fieldname] = { filepath, filename: newFilename, mimetype: mimeType };
                        fResolve();
                    });
                    writeStream.on('error', fReject);
                });
            })();
            fileUploadPromises.push(filePromise);
        });

        busboy.on('finish', async () => {
            try {
                await Promise.all(fileUploadPromises);
                resolve({ fields, files });
            } catch (err) {
                reject(err);
            }
        });

        busboy.on('error', reject);

        if (request.body) {
            request.body.pipeTo(new WritableStream({
                write(chunk) { busboy.write(chunk); },
                close() { busboy.end(); }
            }));
        }
    });
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const { fields, files } = await parseFormData(request);
        const { programTitle } = fields;

        // 1. Save to CSV
        const csvDir = join(process.cwd(), 'src', 'data', 'inscripciones');
        await mkdir(csvDir, { recursive: true });
        const csvPath = join(csvDir, `${sanitizeFilename(programTitle || 'general')}.csv`);

        const headers = [
            "Fecha Registro", "Programa", "Nombre", "Apellidos", "Género", "Teléfono", "Email",
            "Fecha Nacimiento", "CURP", "Nacionalidad", "Entidad Federativa", "Estado Civil",
            "Calle", "Colonia", "CP", "Ciudad", "Estado", "Modalidad Estudo", "Grado Estudios",
            "Carrera", "Institución", "Fecha Inicio", "Fecha Fin", "Estado Licenciatura", "Cédula Num",
            "Cédula Doc", "Acta Nacimiento", "CURP Doc", "Comprobante Dom", "INE",
            "Capacidad Dif", "Detalle Capacidad", "Enf Crónica", "Detalle Enf", "Alergia", "Detalle Alergia",
            "Tratamiento", "Detalle Tratamiento", "Contacto Emergencia", "Parentesco", "Tel Emergencia",
            "Lengua Indígena", "Ocupación", "Origen"
        ];

        const formatDate = (dateStr: string) => {
            if (!dateStr) return '';
            const parts = dateStr.split('-');
            if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
            return dateStr;
        };

        const row = [
            new Date().toLocaleString(),
            programTitle,
            fields.nombre,
            fields.apellidos,
            fields.genero,
            fields.telefono,
            fields.email,
            formatDate(fields.fechaNacimiento),
            fields.curp,
            fields.nacionalidad,
            fields.entidadNacimiento,
            fields.estadoCivil,
            fields.calle,
            fields.colonia,
            fields.cp,
            fields.ciudad,
            fields.estadoDireccion,
            fields.modalidadEstudio,
            fields.ultimoGrado,
            fields.carrera,
            fields.institucion,
            formatDate(fields.fechaInicioLic),
            formatDate(fields.fechaFinLic),
            fields.estadoLic,
            fields.cedulaNum,
            files.cedulaDoc?.filename || '',
            files.actaNacimiento?.filename || '',
            files.curpDoc?.filename || '',
            files.comprobanteDom?.filename || '',
            files.ineDoc?.filename || '',
            fields.capacidadDif,
            fields.detalleCapacidad,
            fields.enfCronica,
            fields.detalleEnf,
            fields.alergia,
            fields.detalleAlergia,
            fields.tratamiento,
            fields.detalleTratamiento,
            fields.contactoEmergencia,
            fields.parentesco,
            fields.telEmergencia,
            fields.lenguaIndigena,
            fields.ocupacion,
            fields.origen
        ].map((val, index) => {
            let processed = (val || '').toString();
            if (index !== 6) { // Skip uppercase for email (index 6)
                processed = processed.toUpperCase();
            }
            return `"${processed.replace(/"/g, '""')}"`;
        }).join(',');

        if (!existsSync(csvPath)) {
            await appendFile(csvPath, headers.join(',') + '\n');
        }
        await appendFile(csvPath, row + '\n');

        // 2. Send Emails
        const brevoKey = import.meta.env.KEY_API_BREVO;
        const senderEmail = import.meta.env.SMTP_FROM || 'contacto@ceprija.edu.mx';
        const controlEscolar = import.meta.env.EMAIL_CONTROL_ESCOLAR || 'admin@ceprija.edu.mx';
        const soporteWeb = import.meta.env.EMAIL_SOPORTE_WEB || 'soporte@ceprija.edu.mx';

        // Read CSV
        const csvContent = await readFile(csvPath);
        const csvBase64 = csvContent.toString('base64');
        const attachments = [
            { name: `${sanitizeFilename(programTitle || 'inscripcion')}.csv`, content: csvBase64 }
        ];

        // Attach all uploaded files
        for (const [key, file] of Object.entries(files)) {
            if (existsSync(file.filepath)) {
                const fileContent = await readFile(file.filepath);
                attachments.push({
                    name: file.filename,
                    content: fileContent.toString('base64')
                });
            }
        }

        const adminBody = {
            sender: { email: senderEmail },
            to: [{ email: controlEscolar }, { email: soporteWeb }],
            subject: `Nueva Inscripción: ${programTitle}`,
            htmlContent: `<h2>Nueva inscripción recibida</h2><p>Se adjunta el archivo CSV con los registros y los documentos adjuntos de <b>${fields.nombre} ${fields.apellidos}</b>.</p>`,
            attachment: attachments
        };

        const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'api-key': brevoKey },
            body: JSON.stringify(adminBody)
        });

        if (!brevoRes.ok) console.error('Brevo Error:', await brevoRes.text());

        return new Response(JSON.stringify({ message: 'Inscripción exitosa' }), { status: 200 });
    } catch (error) {
        console.error('API Error:', error);
        return new Response(JSON.stringify({ message: 'Error en el servidor', error: String(error) }), { status: 500 });
    }
};
