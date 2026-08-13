import { expect, test } from "@playwright/test";

test.describe("general landing page tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("has title", async ({ page }) => {
    await expect(page).toHaveTitle(/DoctorIA/);
  });

  test("get started / login link navigates to signup", async ({ page }) => {
    await page.getByRole("link", { name: /Comenzar|Iniciar Sesión/ }).first().click();
    await page.waitForURL(/\/(signup|login)/);
  });

  test("hero headings visible", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /DoctorIA|asistencia de IA/i }).first(),
    ).toBeVisible();
  });

  test("features section contains a known feature", async ({ page }) => {
    await expect(
      page.getByRole("heading", {
        name: /Historia clínica estructurada|IA que estructura el texto/i,
      }).first(),
    ).toBeVisible();
  });

  test("FAQ section contains '¿Qué es DoctorIA?'", async ({ page }) => {
    await expect(
      page.getByText("¿Qué es DoctorIA?"),
    ).toBeVisible();
  });

  test("testimonials are present", async ({ page }) => {
    await expect(
      page.getByText(/Dra\. Laura Méndez|Dr\. Carlos Vega/).first(),
    ).toBeVisible();
  });
});

test.describe("cookie consent tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("cookie consent banner rejection sets cc_cookie without analytics", async ({
    context,
    page,
  }) => {
    await page.click('button:has-text("Reject all")');

    const cookies = await context.cookies();
    const consentCookie = cookies.find((c) => c.name === "cc_cookie");
    const cookieObject = JSON.parse(decodeURIComponent(consentCookie.value));
    expect(cookieObject.categories.includes("analytics")).toBeFalsy();
  });

  test("cookie consent banner acceptance sets cc_cookie", async ({
    context,
    page,
  }) => {
    await page.click('button:has-text("Accept all")');

    const cookies = await context.cookies();
    const consentCookie = cookies.find((c) => c.name === "cc_cookie");
    const cookieObject = JSON.parse(decodeURIComponent(consentCookie.value));
    expect(cookieObject.categories.includes("necessary")).toBeTruthy();
  });
});