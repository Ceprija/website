import { test, expect } from "@playwright/test";

const LANDINGS = [
  {
    path: "/landing/especialidad-en-criminalistica-y-ciencias-forenses",
    title: /Especialidad en Criminalística y Ciencias Forenses/i,
    programa: "especialidad-en-criminalistica-y-ciencias-forenses",
    formTitle: "Especialidad en Criminalística y Ciencias Forenses",
  },
  {
    path: "/landing/maestria-en-derecho-civil-y-familiar",
    title: /Maestría en Derecho Civil y Familiar/i,
    programa: "maestria-en-derecho-civil-y-familiar",
    formTitle: "Maestría en Derecho Civil y Familiar",
  },
  {
    path: "/landing/maestria-en-derecho-internacional-derechos-humanos-y-litigio-estrategico",
    title:
      /Maestría en Derecho Internacional de Derechos Humanos y Litigio Estratégico/i,
    programa:
      "maestria-en-derecho-internacional-derechos-humanos-y-litigio-estrategico",
    formTitle:
      "Maestría en Derecho Internacional de Derechos Humanos y Litigio Estratégico",
  },
  {
    path: "/landing/doctorado-en-derecho-procesal-y-sistemas-contemporaneos",
    title: /Doctorado en Derecho Procesal y Sistemas Contemporáneos/i,
    programa: "doctorado-en-derecho-procesal-y-sistemas-contemporaneos",
    formTitle: "Doctorado en Derecho Procesal y Sistemas Contemporáneos",
  },
] as const;

async function dismissCookieBanner(page: import("@playwright/test").Page) {
  const accept = page.getByRole("button", { name: "Aceptar todas" });
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
  }
}

for (const landing of LANDINGS) {
  test(`ads landing ${landing.programa} has chrome-light layout and CTA`, async ({
    page,
  }) => {
    await page.goto(landing.path);
    await dismissCookieBanner(page);

    await expect(
      page.getByRole("heading", { level: 1, name: landing.title }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: "Oferta Académica" }),
    ).toHaveCount(0);

    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute("content", /noindex/);

    const cta = page.getByRole("link", { name: /Quiero inscribirme/i }).first();
    await expect(cta).toHaveAttribute(
      "href",
      new RegExp(
        `inscripciones-septiembre-2026\\?programa=${landing.programa}`,
      ),
    );

    const brochureBtn = page
      .getByRole("button", { name: /Descargar brochure/i })
      .first();
    await expect(brochureBtn).toBeVisible();
    await expect(brochureBtn).not.toHaveAttribute("href", /\.pdf/i);
    await brochureBtn.click();
    const brochureModal = page.locator("#brochure-modal");
    await expect(brochureModal).toHaveAttribute("aria-hidden", "false");
    await expect(
      page.getByRole("heading", { name: /Descarga el brochure/i }),
    ).toBeVisible();
  });

  test(`septiembre form preselects ${landing.programa}`, async ({ page }) => {
    await page.goto(
      `/inscripciones-septiembre-2026?programa=${landing.programa}`,
    );
    await dismissCookieBanner(page);

    await expect(page.locator("#program")).toHaveValue(landing.formTitle);
  });
}

test("brochure modal exposes lead fields and landingSlug, not a raw PDF link", async ({
  page,
}) => {
  const landing = LANDINGS[0];
  await page.goto(landing.path);
  await dismissCookieBanner(page);

  await expect(page.locator('a[href$=".pdf"]')).toHaveCount(0);

  await page.getByRole("button", { name: /Descargar brochure/i }).first().click();
  const form = page.locator("#brochure-lead-form");
  await expect(form).toBeVisible();
  await expect(form).toHaveAttribute("data-program-slug", landing.programa);
  await expect(form).toHaveAttribute(
    "data-landing-slug",
    "especialidad-en-criminalistica-y-ciencias-forenses",
  );
  await expect(form).toHaveAttribute("data-brochure", /\.pdf$/);

  await expect(page.locator("#brochure-name")).toBeVisible();
  await expect(page.locator("#brochure-email")).toBeVisible();
  await expect(page.locator("#brochure-phone")).toBeVisible();

  await page.locator("#brochure-modal-close").click();
  await expect(page.locator("#brochure-modal")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});

test("primary CTA navigates to Septiembre with program preselect", async ({
  page,
}) => {
  const landing = LANDINGS[0];
  await page.goto(landing.path);
  await dismissCookieBanner(page);

  await page.getByRole("link", { name: /Quiero inscribirme/i }).first().click();
  await expect(page).toHaveURL(
    new RegExp(`inscripciones-septiembre-2026\\?programa=${landing.programa}`),
  );
  await expect(page.locator("#program")).toHaveValue(landing.formTitle);
});
