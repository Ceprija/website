import { expect, test } from "@playwright/test";

/**
 * Guard against the uppercase handler mutating radio values (Sí → SÍ),
 * which would break exact-match validation and [value="Sí"] selectors.
 */
test.describe("Enrollment Sí/No radios survive uppercase handler", () => {
  async function selectRadioAndFireInput(
    page: import("@playwright/test").Page,
    name: string,
    value: "Sí" | "No",
  ) {
    const result = await page.evaluate(
      ({ name, value }) => {
        const el = document.querySelector<HTMLInputElement>(
          `input[name="${name}"][value="${value}"]`,
        );
        if (!el) return { ok: false as const, reason: "missing" };
        el.checked = true;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return {
          ok: true as const,
          valueAttr: el.getAttribute("value"),
          valueProp: el.value,
          checked: el.checked,
        };
      },
      { name, value },
    );
    expect(result.ok, `radio ${name}=${value} missing`).toBe(true);
    return result as {
      ok: true;
      valueAttr: string | null;
      valueProp: string;
      checked: boolean;
    };
  }

  test("health radios keep exact Sí/No after input event", async ({
    page,
  }) => {
    await page.goto("/enrollment/maestria-en-derecho-civil-y-familiar");

    const si = await selectRadioAndFireInput(page, "capacidadDif", "Sí");
    expect(si.valueAttr).toBe("Sí");
    expect(si.valueProp).toBe("Sí");
    expect(si.checked).toBe(true);
    await expect(
      page.locator('input[name="capacidadDif"][value="Sí"]:checked'),
    ).toHaveCount(1);

    const no = await selectRadioAndFireInput(page, "capacidadDif", "No");
    expect(no.valueAttr).toBe("No");
    expect(no.valueProp).toBe("No");
    await expect(
      page.locator('input[name="capacidadDif"][value="No"]:checked'),
    ).toHaveCount(1);
  });

  test("all health toggle pairs keep Sí literal after input", async ({
    page,
  }) => {
    await page.goto("/enrollment/maestria-en-derecho-civil-y-familiar");

    for (const name of [
      "capacidadDif",
      "enfCronica",
      "alergia",
      "tratamiento",
    ]) {
      const r = await selectRadioAndFireInput(page, name, "Sí");
      expect(r.valueProp, name).toBe("Sí");
      await expect(
        page.locator(`input[name="${name}"][value="Sí"]:checked`),
      ).toHaveCount(1);
    }
  });

  test("inscription form health radios keep Sí after input", async ({
    page,
  }) => {
    await page.goto("/inscripciones");
    const r = await selectRadioAndFireInput(page, "capacidadDif", "Sí");
    expect(r.valueProp).toBe("Sí");
    expect(r.valueAttr).toBe("Sí");
  });
});
