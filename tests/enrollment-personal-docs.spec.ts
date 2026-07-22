import { expect, test } from "@playwright/test";

const PERSONAL_FIELDS = [
  "actaNacimiento",
  "curpDoc",
  "ineDoc",
  "comprobanteDom",
] as const;

const TINY_PDF = {
  name: "tiny.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"),
};

test.describe("Enrollment personal dossier (application flow)", () => {
  test("maestría Step 3 shows required personal docs with format hints", async ({
    page,
  }) => {
    await page.goto("/enrollment/maestria-en-derecho-civil-y-familiar");

    for (const name of PERSONAL_FIELDS) {
      const input = page.locator(`input[name="${name}"]`);
      await expect(input).toHaveCount(1);
      await expect(input).toHaveAttribute("required", "");
      await expect(input).toHaveAttribute(
        "accept",
        ".pdf,.jpg,.jpeg,.png,.heic,.heif",
      );
    }

    await expect(page.getByText("Documentos personales")).toBeAttached();
    await expect(
      page.getByText("Todos los documentos de esta sección son obligatorios"),
    ).toBeAttached();
    await expect(page.getByText("INE o Pasaporte *")).toBeAttached();
    await expect(
      page.getByText("Formatos aceptados: PDF, JPG, PNG, HEIC").first(),
    ).toBeAttached();
  });

  test("especialidad also requires personal dossier fields", async ({
    page,
  }) => {
    await page.goto(
      "/enrollment/especialidad-en-criminalistica-y-ciencias-forenses",
    );
    for (const name of PERSONAL_FIELDS) {
      await expect(page.locator(`input[name="${name}"]`)).toHaveAttribute(
        "required",
        "",
      );
    }
  });

  test("API rejects application missing personal docs (no Brevo send)", async ({
    request,
  }) => {
    const res = await request.post("/api/enrollment", {
      multipart: {
        website: "",
        nombre: "Prueba",
        apellidos: "Test Docs",
        email: "jorgestebanmr@gmail.com",
        telefono: "3312345678",
        modality: "En línea",
        programSlug: "maestria-en-derecho-civil-y-familiar",
        programTitle: "Maestría en Derecho Civil y Familiar",
        genero: "Masculino",
        fechaNacimiento: "1990-01-15",
        curp: "ABCD900115HJCRRN09",
        nacionalidad: "Mexicana",
        estadoCivil: "Soltero(a)",
        entidadNacimiento: "Jalisco",
        ocupacion: "Abogado",
        lenguaIndigena: "No",
        origen: "Sitio web",
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
        cv: TINY_PDF,
        degree_0_titulo: { ...TINY_PDF, name: "titulo.pdf" },
        degree_0_cedula: { ...TINY_PDF, name: "cedula.pdf" },
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("missing_fields");
    expect(String(body.error)).toMatch(/documentos obligatorios|Acta de nacimiento/i);
    const missing = JSON.stringify(body.missing ?? []);
    expect(missing).toContain("actaNacimiento");
    expect(missing).toContain("curpDoc");
    expect(missing).toContain("ineDoc");
    expect(missing).toContain("comprobanteDom");
  });

  test("API rejects empty personal document", async ({ request }) => {
    const emptyPdf = {
      name: "empty.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(0),
    };
    const res = await request.post("/api/enrollment", {
      multipart: {
        website: "",
        nombre: "Prueba",
        apellidos: "Empty File",
        email: "desarrolloweb@ceprija.edu.mx",
        telefono: "3312345678",
        modality: "En línea",
        programSlug: "maestria-en-derecho-civil-y-familiar",
        programTitle: "Maestría en Derecho Civil y Familiar",
        genero: "Masculino",
        fechaNacimiento: "1990-01-15",
        curp: "ABCD900115HJCRRN09",
        nacionalidad: "Mexicana",
        estadoCivil: "Soltero(a)",
        entidadNacimiento: "Jalisco",
        ocupacion: "Abogado",
        lenguaIndigena: "No",
        origen: "Sitio web",
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
        actaNacimiento: emptyPdf,
        curpDoc: TINY_PDF,
        ineDoc: TINY_PDF,
        comprobanteDom: TINY_PDF,
        cv: TINY_PDF,
        degree_0_titulo: { ...TINY_PDF, name: "titulo.pdf" },
        degree_0_cedula: { ...TINY_PDF, name: "cedula.pdf" },
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    // Empty part may surface as missing_fields (filtered out) or empty_file.
    expect(["empty_file", "missing_fields"]).toContain(body.code);
    expect(
      String(body.error ?? "") + JSON.stringify(body.missing ?? []),
    ).toMatch(/Acta|actaNacimiento|vacío|empty/i);
  });
});
