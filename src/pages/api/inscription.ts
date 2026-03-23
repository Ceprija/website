export const prerender = false;

import type { APIRoute } from 'astro';
import Busboy from 'busboy';

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
function parseFormData(request: Request): Promise<{ fields: Record<string, string>, files: Record<string, { buffer: Buffer, filename: string, mimetype: string }> }> {
    return new Promise((resolve, reject) => {
        const busboy = Busboy({ headers: Object.fromEntries(request.headers.entries()) });
        const fields: Record<string, string> = {};
        const files: Record<string, { buffer: Buffer, filename: string, mimetype: string }> = {};
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

            const filePromise = new Promise<void>((fResolve, fReject) => {
                const chunks: Buffer[] = [];
                file.on('data', (data: Buffer) => {
                    chunks.push(data);
                });
                file.on('end', () => {
                    files[fieldname] = {
                        buffer: Buffer.concat(chunks),
                        filename: newFilename,
                        mimetype: mimeType
                    };
                    fResolve();
                });
                file.on('error', fReject);
            });
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

        // 1. Generate CSV content

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

        // 2. Send Emails
        const brevoKey = import.meta.env.KEY_API_BREVO;
        const senderEmail = import.meta.env.SMTP_FROM;
        const controlEscolar = import.meta.env.EMAIL_CONTROL_ESCOLAR;
        const controlAdmin = import.meta.env.CONTACT_EMAIL;
        const soporteWeb = import.meta.env.EMAIL_SOPORTE_WEB;

        // Create CSV in memory
        const csvContent = headers.join(',') + '\n' + row + '\n';
        const csvBase64 = Buffer.from(csvContent).toString('base64');
        const attachments = [
            { name: `${sanitizeFilename(programTitle || 'inscripcion')}.csv`, content: csvBase64 }
        ];

        // Attach all uploaded files
        for (const [key, file] of Object.entries(files)) {
            attachments.push({
                name: file.filename,
                content: file.buffer.toString('base64')
            });
        }

        const adminBody = {
            sender: { email: senderEmail },
            to: [{ email: soporteWeb }, { email: controlEscolar }, { email: controlAdmin }],
            subject: `Nueva Inscripción: ${programTitle}`,
            htmlContent: `<h2>Nueva inscripción recibida</h2><p>Se adjunta el archivo CSV con los registros y los documentos adjuntos de <b>${fields.nombre} ${fields.apellidos}</b>.</p>`,
            attachment: attachments
        };

        const sendToBrevo = async () => {
            try {
                const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'api-key': brevoKey },
                    body: JSON.stringify(adminBody)
                });
                if (!brevoRes.ok) console.error('Brevo Error:', await brevoRes.text());
            } catch (err) {
                console.error('Error enviando a Brevo:', err);
            }
        };

        const sendToLaravel = async () => {
            try {
                const apiUrl = import.meta.env.URL_BASE_API;
                if (!apiUrl) return;

                const formPayload = new FormData();
                const isTrue = (val: string) => val === 'Sí' || val === 'Si' || val === 'true' || val === '1' ? '1' : '0';

                // Text fields
                const appendIfExists = (key: string, val: any) => { if (val) formPayload.append(key, val); };

                appendIfExists('programa_interes', programTitle);
                appendIfExists('nombre', fields.nombre);
                appendIfExists('apellidos', fields.apellidos);
                appendIfExists('genero', fields.genero || 'Otro');
                appendIfExists('telefono', fields.telefono);
                appendIfExists('email', fields.email);
                appendIfExists('fecha_nacimiento', fields.fechaNacimiento);
                appendIfExists('curp', fields.curp);
                appendIfExists('nacionalidad', fields.nacionalidad || 'Mexicana');
                appendIfExists('entidad_nacimiento', fields.entidadNacimiento);
                appendIfExists('estado_civil', fields.estadoCivil);

                appendIfExists('calle', fields.calle);
                appendIfExists('colonia', fields.colonia);
                appendIfExists('codigo_postal', fields.cp);
                appendIfExists('ciudad', fields.ciudad);
                appendIfExists('estado_direccion', fields.estadoDireccion);

                appendIfExists('modalidad_estudio', fields.modalidadEstudio);
                appendIfExists('ultimo_grado', fields.ultimoGrado);
                appendIfExists('carrera_previa', fields.carrera);
                appendIfExists('institucion_egreso', fields.institucion);
                appendIfExists('fecha_inicio_lic', fields.fechaInicioLic);
                appendIfExists('fecha_fin_lic', fields.fechaFinLic);
                appendIfExists('estado_licenciatura', fields.estadoLic);
                appendIfExists('cedula_numero', fields.cedulaNum);

                appendIfExists('capacidad_diferente', isTrue(fields.capacidadDif));
                appendIfExists('detalle_capacidad', fields.detalleCapacidad);
                appendIfExists('enfermedad_cronica', isTrue(fields.enfCronica));
                appendIfExists('detalle_enfermedad', fields.detalleEnf);
                appendIfExists('alergia', isTrue(fields.alergia));
                appendIfExists('detalle_alergia', fields.detalleAlergia);
                appendIfExists('tratamiento_medico', isTrue(fields.tratamiento));
                appendIfExists('detalle_tratamiento', fields.detalleTratamiento);

                appendIfExists('nombre_contacto', fields.contactoEmergencia);
                appendIfExists('parentesco', fields.parentesco);
                appendIfExists('telefono_contacto', fields.telEmergencia);
                appendIfExists('lengua_indigena', isTrue(fields.lenguaIndigena));
                appendIfExists('ocupacion', fields.ocupacion);
                appendIfExists('plantel', '01km1cdp5ee1tcw6phg5mm8sp8');

                appendIfExists('origen', fields.origen || 'Web');

                // Files (Native multipart, NO Base64 needed!)
                const appendFile = (key: string, fileObj: any) => {
                    if (fileObj && fileObj.buffer) {
                        formPayload.append(key, new Blob([fileObj.buffer], { type: fileObj.mimetype }), fileObj.filename);
                    }
                };

                appendFile('acta_nacimiento_doc', files.actaNacimiento);
                appendFile('curp_doc', files.curpDoc);
                appendFile('comprobante_dom_doc', files.comprobanteDom);
                appendFile('ine_doc', files.ineDoc);
                appendFile('cedula_doc', files.cedulaDoc);

                console.log(`Sending FAST Multipart formData to API: ${apiUrl}prospectos/registro`);
                const apiRes = await fetch(`${apiUrl}prospectos/registro`, {
                    method: 'POST',
                    headers: { 'Accept': 'application/json' }, // We don't set Content-Type here, let fetch generate the 'multipart/form-data; boundary=...'
                    body: formPayload
                });

                if (!apiRes.ok) {
                    console.error('Laravel API Error response:', await apiRes.text());
                } else {
                    console.log('Successfully saved to Laravel API');
                }
            } catch (apiError) {
                console.error('Failed to send data to Laravel API:', apiError);
            }
        };

        await Promise.allSettled([sendToBrevo(), sendToLaravel()]);

        return new Response(JSON.stringify({ message: 'Inscripción exitosa' }), { status: 200 });
    } catch (error) {
        console.error('API Error:', error);
        return new Response(JSON.stringify({ message: 'Error en el servidor', error: String(error) }), { status: 500 });
    }
};
