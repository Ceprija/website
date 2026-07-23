import { test, expect } from "@playwright/test";

const CLASSIC_LANDINGS = [
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

const CRIMINALISTICA = {
  path: "/landing/especialidad-en-criminalistica-y-ciencias-forenses",
  programa: "especialidad-en-criminalistica-y-ciencias-forenses",
  formTitle: "Especialidad en Criminalística y Ciencias Forenses",
} as const;

async function dismissCookieBanner(page: import("@playwright/test").Page) {
  const accept = page.getByRole("button", { name: "Aceptar todas" });
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
  }
}

for (const landing of CLASSIC_LANDINGS) {
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

test("criminalística narrative landing: hero, CTAs, brochure plan", async ({
  page,
}) => {
  await page.goto(CRIMINALISTICA.path);
  await dismissCookieBanner(page);

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /La evidencia habla\. Prepárate para interpretarla/i,
    }),
  ).toBeVisible();

  await expect(
    page.getByText("Especialidad en Criminalística y Ciencias Forenses").first(),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", {
      name: /Aprende de quienes viven la práctica/i,
    }),
  ).toBeVisible();

  // Image bands (disciplinas + rvoe) alternate with solid color sections.
  await expect(
    page.locator("#disciplinas img[src*='disciplinas-tablero']"),
  ).toHaveCount(1);
  await expect(
    page.locator("#rvoe img[src*='rvoe-tablero']"),
  ).toHaveCount(1);

  await expect(
    page.getByRole("link", { name: "Oferta Académica" }),
  ).toHaveCount(0);

  const robots = page.locator('meta[name="robots"]');
  await expect(robots).toHaveAttribute("content", /noindex/);

  const cta = page
    .getByRole("link", { name: /Quiero apartar mi lugar/i })
    .first();
  await expect(cta).toHaveAttribute(
    "href",
    new RegExp(
      `inscripciones-septiembre-2026\\?programa=${CRIMINALISTICA.programa}`,
    ),
  );

  await expect(
    page.getByRole("link", { name: /Necesito esta especialidad/i }).first(),
  ).toHaveAttribute(
    "href",
    new RegExp(
      `inscripciones-septiembre-2026\\?programa=${CRIMINALISTICA.programa}`,
    ),
  );

  const brochureBtn = page
    .getByRole("button", { name: /Descargar plan de estudios/i })
    .first();
  await expect(brochureBtn).toBeVisible();
  await brochureBtn.click();
  await expect(page.locator("#brochure-modal")).toHaveAttribute(
    "aria-hidden",
    "false",
  );
});

test("criminalística brochure modal exposes landingSlug and lead fields", async ({
  page,
}) => {
  await page.goto(CRIMINALISTICA.path);
  await dismissCookieBanner(page);

  await expect(page.locator('a[href$=".pdf"]')).toHaveCount(0);

  await page
    .getByRole("button", { name: /Descargar plan de estudios/i })
    .first()
    .click();
  const form = page.locator("#brochure-lead-form");
  await expect(form).toBeVisible();
  await expect(form).toHaveAttribute(
    "data-program-slug",
    CRIMINALISTICA.programa,
  );
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

test("criminalística primary CTA navigates to Septiembre with program preselect", async ({
  page,
}) => {
  await page.goto(CRIMINALISTICA.path);
  await dismissCookieBanner(page);

  await page
    .getByRole("link", { name: /Quiero apartar mi lugar/i })
    .first()
    .click();
  await expect(page).toHaveURL(
    new RegExp(
      `inscripciones-septiembre-2026\\?programa=${CRIMINALISTICA.programa}`,
    ),
  );
  await expect(page.locator("#program")).toHaveValue(CRIMINALISTICA.formTitle);
});

test("septiembre form preselects criminalística", async ({ page }) => {
  await page.goto(
    `/inscripciones-septiembre-2026?programa=${CRIMINALISTICA.programa}`,
  );
  await dismissCookieBanner(page);
  await expect(page.locator("#program")).toHaveValue(CRIMINALISTICA.formTitle);
});
