import { defineConfig } from "@playwright/test";

/** Force all Brevo traffic from the test server to this inbox only. */
const TEST_EMAIL_ONLY = "jorgestebanmr@gmail.com";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:4321",
    trace: "retain-on-failure",
  },
  webServer: {
    command: [
      `EMAIL_ADMIN_ONLY_RECIPIENT=${TEST_EMAIL_ONLY}`,
      `EMAIL_PARTICIPANT_ONLY_RECIPIENT=${TEST_EMAIL_ONLY}`,
      "NOTIFY_CONTROL_ESCOLAR_ENROLLMENT=true",
      "astro dev --port 4321 --host",
    ].join(" "),
    url: "http://localhost:4321",
    // Do not reuse a server started from .env (may point admin mail at desarrolloweb).
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
