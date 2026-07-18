import { test, expect } from "@playwright/test";

test("hero shows Litigación accent", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.locator("#hero-slider").getByRole("heading", {
      name: "Taller en Técnicas de Litigación Oral",
    }),
  ).toBeVisible();
});
