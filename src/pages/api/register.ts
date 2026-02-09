export const prerender = false;

import type { APIRoute } from 'astro';
import { programs } from '../../data/programs';
import Busboy from 'busboy';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { readFile } from 'fs/promises';

// Helper function to sanitize filename
function sanitizeFilename(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric with dash
        .replace(/-+/g, '-') // Replace multiple dashes with single
        .replace(/^-|-$/g, ''); // Remove leading/trailing dashes
}

// Helper function to parse multipart form data
function parseFormData(request: Request): Promise<{ fields: Record<string, string>, file: { filepath: string, filename: string, mimetype: string } | null }> {
    return new Promise((resolve, reject) => {
        const busboy = Busboy({ headers: Object.fromEntries(request.headers.entries()) });
        const fields: Record<string, string> = {};
        let fileInfo: { filepath: string, filename: string, mimetype: string } | null = null;

        busboy.on('field', (fieldname: string, value: string) => {
            fields[fieldname] = value;
        });

        busboy.on('file', async (fieldname: string, file: any, info: any) => {
            if (fieldname !== 'paymentProof') {
                file.resume();
                return;
            }

            const { filename, mimeType } = info;

            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
            if (!allowedTypes.includes(mimeType)) {
                file.resume();
                reject(new Error('Tipo de archivo no permitido'));
                return;
            }

            // Create timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

            // Sanitize user name from fields (will be available after all fields are parsed)
            const userName = fields.name || 'usuario';
            const sanitizedName = sanitizeFilename(userName);

            // Get file extension
            const ext = filename.split('.').pop() || 'pdf';

            // Create new filename
            const newFilename = `${sanitizedName}_${timestamp}.${ext}`;
            const uploadDir = join(process.cwd(), 'public', 'uploads', 'comprobantes');
            const filepath = join(uploadDir, newFilename);

            try {
                // Ensure directory exists
                await mkdir(uploadDir, { recursive: true });

                // Save file
                const writeStream = createWriteStream(filepath);
                file.pipe(writeStream);

                writeStream.on('finish', () => {
                    fileInfo = { filepath, filename: newFilename, mimetype: mimeType };
                });

                writeStream.on('error', (err: Error) => {
                    reject(err);
                });
            } catch (err) {
                reject(err);
            }
        });

        busboy.on('finish', () => {
            // Wait a bit to ensure file write is complete
            setTimeout(() => {
                resolve({ fields, file: fileInfo });
            }, 100);
        });

        busboy.on('error', (err) => {
            reject(err);
        });

        // Pipe request body to busboy
        request.body?.pipeTo(new WritableStream({
            write(chunk) {
                busboy.write(chunk);
            },
            close() {
                busboy.end();
            }
        }));
    });
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const { fields, file } = await parseFormData(request);
        const { name, email, phone, message, program: programTitle, type, modality } = fields;

        // Find program details
        const programDetails = programs.find(p => p.title === programTitle) || {};
        const {
            instructor = "Claustro Docente CEPRIJA",
            startDate = "Por confirmar",
            schedule = "Por confirmar",
            address = "Instalaciones de CEPRIJA - Lope de Vega #273, Col. Americana Arcos. C.P. 44500",
            meetingLink = "Se enviará previo al evento"
        } = programDetails;

        // Obtener clave de API de Brevo
        const brevoKey = import.meta.env.KEY_API_BREVO;
        if (!brevoKey) {
            throw new Error('Falta KEY_API_BREVO en .env');
        }

        const senderEmail = import.meta.env.SMTP_FROM || import.meta.env.CONTACT_EMAIL;

        // 1. Send Admin Notification (Internal) with file attachment via Brevo API
        const adminHtml = `
            <h2>Nuevo contacto desde la web</h2>
            <p><strong>Tipo:</strong> ${type === 'registration' ? 'Inscripción' : 'Contacto General'}</p>
            <p><strong>Nombre:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Teléfono:</strong> ${phone}</p>
            <p><strong>Programa:</strong> ${programTitle || 'N/A'}</p>
            <p><strong>Modalidad:</strong> ${modality || 'N/A'}</p>
            <p><strong>Mensaje:</strong> ${message || 'N/A'}</p>
            ${file ? `<p><strong>Comprobante de pago:</strong> Adjunto</p>` : ''}
        `;

        const adminBody: any = {
            sender: { email: senderEmail },
            to: [{ email: import.meta.env.CONTACT_EMAIL }],
            subject: `Nuevo ${type === 'registration' ? 'Registro' : 'Mensaje'}: ${programTitle || 'General'}`,
            htmlContent: adminHtml
        };

        // Adjuntar archivo si existe
        if (file && file.filepath) {
            try {
                const fileData = await readFile(file.filepath);
                const base64 = fileData.toString('base64');
                adminBody.attachment = [{ name: file.filename, content: base64 }];
            } catch (e) {
                console.warn('No se pudo leer archivo adjunto:', e);
            }
        }

        try {
            const adminRes = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': brevoKey
                },
                body: JSON.stringify(adminBody)
            });

            if (!adminRes.ok) {
                const txt = await adminRes.text();
                console.error('ERROR Brevo (admin):', adminRes.status, txt);
            } else {
                console.log('Admin email sent via Brevo');
            }
        } catch (error) {
            console.error('Error sending admin email:', error);
        }

        // 2. Send User Confirmation Email (Only for Registrations)
        if (type === 'registration' && email) {
            // Normalize logic to catch 'Online', 'En línea', 'en línea', etc.
            const isOnline = (modality || '').toLowerCase().includes('línea') || (modality || '').toLowerCase().includes('online');

            // Template Content
            const emailSubject = `Confirmación de Registro - ${programTitle}`;

            const emailBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <!-- Header -->
                <div style="background-color: #1e3a8a; padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">CEPRIJA</h1>
                    <p style="color: #bfdbfe; margin: 5px 0 0;">Centro de Preparación Integral en Materia Jurídica y Administrativa</p>
                </div>

                <!-- Body -->
                <div style="padding: 30px 20px; background-color: #f8fafc;">
                    <p style="font-size: 16px; margin-bottom: 20px;">
                        <strong>${programTitle}</strong>
                    </p>
                    <p>Estimado(a): <strong>${name}</strong></p>
                    
                    <p>Reciba un cordial saludo, le notificamos por este medio que se ha confirmado su participación 
                    <strong>${isOnline ? 'en línea' : 'presencial'}</strong> para el <strong>${programTitle}</strong> 
                    con el <strong>${instructor}</strong>. Su participación es muy valiosa para nosotros 
                    y estamos seguros de que esta capacitación será de mucho aprendizaje para usted.</p>
                    
                    <p>A continuación le compartimos información valiosa para su asistencia.</p>

                    <div style="background-color: white; border-left: 4px solid #1e3a8a; padding: 15px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <h3 style="color: #1e3a8a; margin-top: 0;">Detalles del evento:</h3>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            <li style="margin-bottom: 8px;">📅 <strong>Fecha:</strong> ${startDate}</li>
                            <li style="margin-bottom: 8px;">⏰ <strong>Duración:</strong> ${schedule}</li>
                            ${isOnline
                            ? `<li style="margin-bottom: 8px;">💻 <strong>Enlace en línea:</strong> <a href="${meetingLink}" style="color: #2563eb;">${meetingLink}</a></li>
                                   <li style="margin-bottom: 8px;">📍 <strong>Alternativa presencial:</strong> ${address}</li>`
                            : `<li style="margin-bottom: 8px;">📍 <strong>Instalaciones:</strong> ${address}</li>`
                    }           </ul>
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
                sender: { email: senderEmail },
                to: [{ email: email }],
                subject: emailSubject,
                htmlContent: emailBody
            };

            try {
                const userRes = await fetch('https://api.brevo.com/v3/smtp/email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'api-key': brevoKey
                    },
                    body: JSON.stringify(userBody)
                });

                if (!userRes.ok) {
                    const txt = await userRes.text();
                    console.error('ERROR Brevo (user):', userRes.status, txt);
                } else {
                    console.log('User confirmation email sent via Brevo');
                }
            } catch (error) {
                console.error('Error sending user confirmation email:', error);
            }
        }



        return new Response(
            JSON.stringify({
                message: 'Recibido correctamente',
            }),
            { status: 200 }
        );
    } catch (error) {
        console.error('Error processing registration:', error);
        return new Response(
            JSON.stringify({
                message: 'Error al procesar la solicitud',
                error: error instanceof Error ? error.message : 'Unknown error'
            }),
            { status: 500 }
        );
    }
};