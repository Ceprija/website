import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // 1) Hero accent
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Taller en Técnicas de Litigación Oral", { timeout: 10_000 });

  // 2) Septiembre 2026 form includes carrera and submits
  await page.goto(`${BASE_URL}/inscripciones-septiembre-2026`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#septiembre-2026-form", { timeout: 10_000 });

  await page.selectOption("#program", { label: "Maestría en Derecho Civil y Familiar" });
  await page.fill("#name", "Playwright CLI Test User");
  await page.fill("#email", "jorgestebanmr@gmail.com");
  await page.fill("#phone", "3312345678");
  await page.fill("#carrera", "Licenciatura en Derecho");

  await page.click("#septiembre-2026-submit");

  await page.waitForSelector(
    "text=¡Gracias! Recibimos tu registro. Un asesor de CEPRIJA se comunicará contigo pronto.",
    { timeout: 15_000 },
  );

  await browser.close();
  // eslint-disable-next-line no-console
  console.log("E2E OK");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("E2E FAILED:", err);
  process.exit(1);
});

