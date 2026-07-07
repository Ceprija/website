import { test, expect } from "@playwright/test";

test("septiembre 2026 form requires carrera and submits", async ({ page }) => {
  await page.goto("/inscripciones-septiembre-2026");

  await page.locator("#program").selectOption({
    label: "Maestría en Derecho Civil y Familiar",
  });

  await page.fill("#name", "Playwright Test User");
  await page.fill("#email", "jorgestebanmr@gmail.com");
  await page.fill("#phone", "3312345678");

  // New field
  await page.fill("#carrera", "Licenciatura en Derecho");

  await page.click("#septiembre-2026-submit");

  // Success message from client handler
  await expect(
    page.getByText(
      "¡Gracias! Recibimos tu registro. Un asesor de CEPRIJA se comunicará contigo pronto.",
    ),
  ).toBeVisible();
});

