import { test, expect } from "@playwright/test";

const PROGRAM_PATH = "/oferta-academica/webinar-psicologos-cnpcyf";

async function dismissCookieBanner(page: import("@playwright/test").Page) {
  const accept = page.getByRole("button", { name: "Aceptar todas" });
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
  }
}

test("webinar program page shows registration CTA and details", async ({ page }) => {
  await page.goto(PROGRAM_PATH);
  await dismissCookieBanner(page);

  await expect(
    page.getByRole("heading", {
      name: /La función de los psicólogos en el nuevo Código Nacional/i,
    }),
  ).toBeVisible();
  await expect(page.getByText("25 de julio de 2026")).toBeVisible();
  await expect(page.getByText("9:00–12:00 h")).toBeVisible();
  await expect(page.getByText("En línea").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Regístrate Gratis" }).first(),
  ).toBeVisible();
});

test("free webinar registration without constancia submits successfully", async ({
  page,
}) => {
  await page.goto(PROGRAM_PATH);
  await dismissCookieBanner(page);

  await page
    .getByRole("button", { name: "Regístrate Gratis" })
    .click();

  const enrollmentDialog = page.getByRole("dialog", {
    name: "Regístrate Gratis",
  });
  await expect(enrollmentDialog).toBeVisible();
  await expect(
    enrollmentDialog.getByText("¿Deseas constancia de participación?"),
  ).toBeVisible();

  await enrollmentDialog.locator('input[name="name"]').fill("Playwright Test Psicólogos");
  await enrollmentDialog.locator('input[name="email"]').fill("jorgestebanmr@gmail.com");
  await enrollmentDialog.locator('input[name="phone"]').fill("3312345678");
  await enrollmentDialog
    .locator('input[name="wantsConstancia"][value="no"]')
    .check();

  const registerResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/register") && response.request().method() === "POST",
  );

  await enrollmentDialog
    .getByRole("button", { name: "Confirmar registro" })
    .click();

  const response = await registerResponse;
  expect(response.ok()).toBeTruthy();

  await expect(
    page.getByText(/¡Formulario recibido con éxito!/i),
  ).toBeVisible({ timeout: 10_000 });
});

test("homepage hero includes psicólogos webinar slide", async ({ page }) => {
  await page.goto("/");
  await dismissCookieBanner(page);
  await expect(
    page.getByRole("heading", {
      name: /La función de los psicólogos en el nuevo Código Nacional/i,
    }),
  ).toBeVisible();
  await expect(page.getByText("Webinar Gratuito | 25 de julio 2026")).toBeVisible();
});
