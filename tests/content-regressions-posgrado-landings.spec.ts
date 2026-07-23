import { expect, test } from "@playwright/test";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

async function dismissCookieBanner(page: import("@playwright/test").Page) {
  const accept = page.getByRole("button", { name: "Aceptar todas" });
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
  }
}

test.describe("Content / UI regressions after posgrado + landings work", () => {
  test("doctorado ficha uses semestres (not cuatrimestres)", async ({
    page,
  }) => {
    await page.goto(
      "/oferta-academica/doctorado-en-derecho-procesal-y-sistemas-contemporaneos",
    );
    await dismissCookieBanner(page);

    await expect(page.getByText(/4 semestres/i).first()).toBeVisible();
    await expect(page.getByText(/cuatrimestre/i)).toHaveCount(0);
  });

  test("doctorado Meta landing uses semestres", async ({ page }) => {
    await page.goto(
      "/landing/doctorado-en-derecho-procesal-y-sistemas-contemporaneos",
    );
    await dismissCookieBanner(page);

    await expect(page.getByText(/4 semestres/i).first()).toBeVisible();
    await expect(page.getByText(/cuatrimestre/i)).toHaveCount(0);
  });

  test("maestría DDHH ficha is En línea only", async ({ page }) => {
    await page.goto(
      "/oferta-academica/maestria-en-derecho-internacional-derechos-humanos-y-litigio-estrategico",
    );
    await dismissCookieBanner(page);

    await expect(page.getByText(/^En línea$/).first()).toBeVisible();
    await expect(page.getByText(/Presencial\s*\/\s*En línea/i)).toHaveCount(0);
  });

  test("maestría DDHH Meta landing is En línea only", async ({ page }) => {
    await page.goto(
      "/landing/maestria-en-derecho-internacional-derechos-humanos-y-litigio-estrategico",
    );
    await dismissCookieBanner(page);

    await expect(page.getByText(/Modalidad En línea/i).first()).toBeVisible();
    await expect(page.getByText(/Presencial\s*\/\s*En línea/i)).toHaveCount(0);
  });

  test("posgrado ficha shows 48 horas (not 48-72)", async ({ page }) => {
    await page.goto(
      "/oferta-academica/especialidad-en-criminalistica-y-ciencias-forenses",
    );
    await dismissCookieBanner(page);

    await expect(
      page.getByText(/Respuesta en 48 horas/i).first(),
    ).toBeVisible();
    await expect(page.getByText(/48-72/i)).toHaveCount(0);
  });

  test("criminalística narrative color bands use shared burgundy", async ({
    page,
  }) => {
    await page.goto(
      "/landing/especialidad-en-criminalistica-y-ciencias-forenses",
    );
    await dismissCookieBanner(page);

    const colorBand = page.locator("#expertos");
    await expect(colorBand).toBeVisible();
    await expect(colorBand).toHaveCSS("background-color", "rgb(131, 18, 0)");

    const imageBand = page.locator("#disciplinas");
    await expect(imageBand).toBeVisible();
    await expect(
      imageBand.locator("img[src*='disciplinas-tablero']"),
    ).toHaveCount(1);
  });

  test("doctorado brochure file is present and replaced", async () => {
    const brochure = path.join(
      process.cwd(),
      "public/brochures/doctoradoDerechoProcesal.pdf",
    );
    expect(existsSync(brochure)).toBe(true);
    // Previous brochure was ~29MB; updated temario is larger (~35MB).
    expect(statSync(brochure).size).toBeGreaterThan(30_000_000);
  });

  test("admission guide email assets exist", async () => {
    const dir = path.join(process.cwd(), "public/images/email");
    for (const name of [
      "guia-tramites-especialidad-criminalistica-2026c.png",
      "guia-tramites-doctorado-derecho-procesal-2026c.png",
      "guia-tramites-maestria-derecho-civil-familiar-2026c.png",
      "guia-tramites-maestria-derecho-internacional-2026c.png",
    ]) {
      expect(existsSync(path.join(dir, name)), name).toBe(true);
    }
  });
});
