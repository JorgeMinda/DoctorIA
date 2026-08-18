import { defineConfig, devices } from "@playwright/test";

/**
 * Config de validación visual contra el client desplegado en Render (prod).
 * Uso: npx playwright test --config=playwright.prod.config.ts
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/redesignProdValidation.spec.ts",
  outputDir: "./test-results",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "https://doctoria-client.onrender.com",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});