import { expect, test } from "@playwright/test";

test.describe("Generación on long inscription + enrollment", () => {
  test("inscripciones: generación fills from program selection", async ({
    page,
  }) => {
    await page.goto("/inscripciones");

    const generacion = page.locator("#generacion-input");
    await expect(generacion).toBeVisible();
    await expect(page.getByText("Generación *")).toBeVisible();
    await expect(generacion).toHaveAttribute("readonly", "");
    await expect(generacion).toHaveValue("");

    // Prefer exact option values from the select (titles, not forced uppercase labels)
    const programSelect = page.locator("#program-select");
    const options = await programSelect.locator("option").allTextContents();
    const pick = (re: RegExp) => {
      const match = options.find((o) => re.test(o.trim()));
      if (!match) throw new Error(`No option matching ${re}; got: ${options.join(" | ")}`);
      return match.trim();
    };

    await programSelect.selectOption(pick(/maestr[ií]a en derecho civil/i));
    await expect(generacion).toHaveValue("2026C -2028B");

    await programSelect.selectOption(pick(/doctorado/i));
    await expect(generacion).toHaveValue("2026C -2028C");

    await programSelect.selectOption(pick(/especialidad/i));
    await expect(generacion).toHaveValue("2026C -2027B");

    // Email must stay lowercase under the uppercase handler
    const email = page.locator('input[name="email"]');
    await email.fill("Test.User@Example.COM");
    await expect(email).toHaveValue("Test.User@Example.COM");

    const nombre = page.locator('input[name="nombre"]');
    await nombre.fill("maría");
    await expect(nombre).toHaveValue("MARÍA");
  });

  test("enrollment maestría: generación is prefilled and readonly", async ({
    page,
  }) => {
    await page.goto("/enrollment/maestria-en-derecho-civil-y-familiar");

    const generacion = page.locator('input[name="generacion"]');
    await expect(generacion).toBeVisible();
    await expect(generacion).toHaveAttribute("readonly", "");
    await expect(generacion).toHaveValue("2026C -2028B");

    const email = page.locator('input[name="email"]').first();
    await email.fill("Applicant@Example.COM");
    await expect(email).toHaveValue("Applicant@Example.COM");

    const nombre = page.locator('input[name="nombre"]');
    await nombre.fill("juan");
    await expect(nombre).toHaveValue("JUAN");
  });

  test("enrollment doctorado: generación 2026C -2028C", async ({ page }) => {
    await page.goto(
      "/enrollment/doctorado-en-derecho-procesal-y-sistemas-contemporaneos",
    );
    await expect(page.locator('input[name="generacion"]')).toHaveValue(
      "2026C -2028C",
    );
  });

  test("enrollment especialidad: generación 2026C -2027B", async ({
    page,
  }) => {
    await page.goto(
      "/enrollment/especialidad-en-criminalistica-y-ciencias-forenses",
    );
    await expect(page.locator('input[name="generacion"]')).toHaveValue(
      "2026C -2027B",
    );
  });
});
