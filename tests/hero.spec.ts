import { test, expect } from "@playwright/test";

test("hero shows Litigación accent", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Taller en Técnicas de Litigación Oral")).toBeVisible();
});

