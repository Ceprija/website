import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:4321",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "EMAIL_ADMIN_ONLY_RECIPIENT=jorgestebanmr@gmail.com EMAIL_PARTICIPANT_ONLY_RECIPIENT=jorgestebanmr@gmail.com astro dev --port 4321 --host",
    url: "http://localhost:4321",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

