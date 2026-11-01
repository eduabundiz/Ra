import { defineConfig, devices } from "@playwright/test";
import chromium from "@sparticuz/chromium";
import { rmSync } from "node:fs";
const port = 3100;
const url = `http://127.0.0.1:${port}`;
if (!process.env.PLAYWRIGHT_REUSE_SERVER)
  rmSync(".data/e2e", { recursive: true, force: true });
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: url,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...(process.env.USE_BUNDLED_CHROMIUM === "1"
      ? {
          launchOptions: {
            executablePath: await chromium.executablePath(),
            args: chromium.args.filter(
              (a) =>
                !a.startsWith("--disable-web-security") &&
                !a.startsWith("--allow-running-insecure-content"),
            ),
          },
        }
      : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run start -- -p ${port}`,
    url: url + "/api/health",
    reuseExistingServer: false,
    timeout: 45000,
    env: {
      DATA_MODE: "demo",
      SITE_URL: url,
      DEMO_DATA_NAMESPACE: "e2e",
      DEMO_ADMIN_PASSWORD: "e2e-password-local-only",
      DEMO_SESSION_SECRET: "e2e-secret-local-only-at-least-32-characters",
      WHATSAPP_MODE: "disabled",
      WHATSAPP_APP_SECRET: "e2e-whatsapp-secret",
      WHATSAPP_PHONE_NUMBER_ID: "e2e-phone-id",
      WHATSAPP_VERIFY_TOKEN: "e2e-verify",
    },
  },
});
