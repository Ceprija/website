import { expect, test } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Live Brevo sends for posgrado application emails.
 * Playwright webServer forces BOTH admin + participant recipients to
 * desarrolloweb@ceprija.edu.mx (see playwright.config.ts).
 */

const SAFE_INBOX = "desarrolloweb@ceprija.edu.mx";
/** Form email that must NOT receive mail when EMAIL_PARTICIPANT_ONLY_RECIPIENT is set. */
const DECOY_PARTICIPANT = "email-test-decoy-do-not-deliver@example.com";

const TINY_PDF = {
  name: "tiny.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from(
    "%PDF-1.4\n%âãÏÓ\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
  ),
};

const BASE_FIELDS = {
  website: "",
  nombre: "Prueba",
  apellidos: "Email Posgrado",
  email: DECOY_PARTICIPANT,
  telefono: "3312345678",
  modality: "En línea",
  genero: "Masculino",
  fechaNacimiento: "1990-01-15",
  curp: "ABCD900115HJCRRN09",
  nacionalidad: "Mexicana",
  estadoCivil: "Soltero(a)",
  entidadNacimiento: "Jalisco",
  ocupacion: "Abogado",
  lenguaIndigena: "No",
  origen: "Sitio web prueba email",
  calle: "Calle 1",
  colonia: "Centro",
  cp: "44100",
  ciudad: "Guadalajara",
  estadoDireccion: "Jalisco",
  contactoEmergencia: "Ana Test",
  parentesco: "Madre",
  telEmergencia: "3312345679",
  capacidadDif: "No",
  enfCronica: "No",
  alergia: "No",
  tratamiento: "No",
  degree_0_grado: "Licenciatura",
  degree_0_carrera: "Derecho",
  degree_0_institucion: "UDG",
  degree_0_cedulaNum: "1234567",
} as const;

function dossierFiles() {
  return {
    actaNacimiento: TINY_PDF,
    curpDoc: TINY_PDF,
    ineDoc: TINY_PDF,
    comprobanteDom: TINY_PDF,
    cv: TINY_PDF,
    degree_0_titulo: { ...TINY_PDF, name: "titulo.pdf" },
    degree_0_cedula: { ...TINY_PDF, name: "cedula.pdf" },
  };
}

const PROGRAMS = [
  {
    slug: "especialidad-en-criminalistica-y-ciencias-forenses",
    title: "Especialidad en Criminalística y Ciencias Forenses",
    expectGuidePath: "guia-tramites-especialidad-criminalistica-2026c.png",
  },
  {
    slug: "doctorado-en-derecho-procesal-y-sistemas-contemporaneos",
    title: "Doctorado en Derecho Procesal y Sistemas Contemporáneos",
    expectGuidePath: "guia-tramites-doctorado-derecho-procesal-2026c.png",
  },
  {
    slug: "maestria-en-derecho-civil-y-familiar",
    title: "Maestría en Derecho Civil y Familiar",
    expectGuidePath: "guia-tramites-maestria-derecho-civil-familiar-2026c.png",
  },
  {
    slug: "maestria-en-derecho-internacional-derechos-humanos-y-litigio-estrategico",
    title:
      "Maestría en Derecho Internacional de Derechos Humanos y Litigio Estratégico",
    expectGuidePath: "guia-tramites-maestria-derecho-internacional-2026c.png",
  },
] as const;

test.describe("Posgrado application emails (Brevo → desarrolloweb only)", () => {
  test.beforeAll(() => {
    // Fail fast if guide assets are missing (email embeds absolute URLs).
    for (const p of PROGRAMS) {
      const file = path.join(
        process.cwd(),
        "public/images/email",
        path.basename(p.expectGuidePath),
      );
      expect(
        existsSync(file),
        `missing admission guide asset: ${file}`,
      ).toBe(true);
    }
  });

  for (const program of PROGRAMS) {
    test(`sends application mail for ${program.slug}`, async ({ request }) => {
      const failedBefore = failedEmailTail();
      const isDoctorado = program.slug.startsWith("doctorado-");

      const multipart: Record<string, string | typeof TINY_PDF> = {
        ...BASE_FIELDS,
        programSlug: program.slug,
        programTitle: program.title,
        ...dossierFiles(),
      };

      if (isDoctorado) {
        multipart.degree_1_grado = "Maestría";
        multipart.degree_1_carrera = "Derecho";
        multipart.degree_1_institucion = "UDG";
        multipart.degree_1_cedulaNum = "7654321";
        multipart.degree_1_titulo = { ...TINY_PDF, name: "titulo-maestria.pdf" };
        multipart.degree_1_cedula = { ...TINY_PDF, name: "cedula-maestria.pdf" };
      }

      const res = await request.post("/api/enrollment", {
        multipart,
      });

      const body = await res.json().catch(() => ({}));
      expect(
        res.status(),
        `enrollment failed: ${JSON.stringify(body)}`,
      ).toBe(200);
      expect(body.success).toBe(true);
      expect(body.applicationId).toBeTruthy();

      // Decoy participant must never appear as a delivery failure target for this run
      // (participant override rewrites Brevo `to` before send).
      const failedAfter = failedEmailTail();
      const newFailures = failedAfter.slice(failedBefore.length);
      for (const line of newFailures) {
        expect(line).not.toContain(DECOY_PARTICIPANT);
        // If something failed, still should only mention the safe inbox or omit decoy.
        if (line.includes('"to"') || line.includes("to")) {
          expect(line).not.toMatch(/example\.com/i);
        }
      }
    });
  }

  test("builder copy + guide map (no Brevo)", async () => {
    const { buildPosgradoApplicationEmail, ADMISSION_GUIDE_IMAGE_BY_SLUG } =
      await import("../src/lib/email/posgradoApplicationEmail");

    for (const program of PROGRAMS) {
      expect(ADMISSION_GUIDE_IMAGE_BY_SLUG[program.slug]).toContain(
        program.expectGuidePath,
      );

      const mail = buildPosgradoApplicationEmail({
        participantName: "Prueba",
        participantLastName: "Email",
        programTitle: program.title,
        programSlug: program.slug,
        applicationId: "test-app-id",
        modality: "En línea",
        controlEscolarEmail: SAFE_INBOX,
      });

      expect(mail.subject).toContain("Registro recibido");
      expect(mail.html).toContain("¡Felicidades!");
      expect(mail.html).toContain("48 horas");
      expect(mail.html).toContain(program.expectGuidePath);
      expect(mail.html).toContain("https://ceprija.edu.mx/images/email/");
      expect(mail.html).toContain("logo-email.png");
      expect(mail.html).not.toContain("48-72");
      expect(mail.html).not.toContain("archivo adjunto");
      // Details block comes after thanks, before dudas.
      const thanksIdx = mail.html.indexOf("¡Gracias por confiar en CEPRIJA!");
      const detailsIdx = mail.html.indexOf("ID de solicitud:");
      const dudasIdx = mail.html.indexOf("¿Dudas?");
      expect(thanksIdx).toBeGreaterThan(-1);
      expect(detailsIdx).toBeGreaterThan(thanksIdx);
      expect(dudasIdx).toBeGreaterThan(detailsIdx);
    }
  });
});

function failedEmailTail(): string[] {
  const p = path.join(process.cwd(), "data/failed-emails.jsonl");
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8").split("\n").filter(Boolean);
}
