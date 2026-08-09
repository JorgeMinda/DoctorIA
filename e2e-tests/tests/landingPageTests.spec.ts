import { expect, test } from "@playwright/test";

test.describe("general landing page tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("has title", async ({ page }) => {
    await expect(page).toHaveTitle(/DoctorIA/);
  });

  test("get started link", async ({ page }) => {
    await page.getByRole("link", { name: /Comenzar/ }).click();
    await page.waitForURL("**/signup");
  });

  test("headings", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Frequently asked questions" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Some cool words" }),
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
    await page.$$('button:has-text("Reject all")');
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
    await page.$$('button:has-text("Accept all")');
    await page.click('button:has-text("Accept all")');

    const cookies = await context.cookies();
    const consentCookie = cookies.find((c) => c.name === "cc_cookie");
    const cookieObject = JSON.parse(decodeURIComponent(consentCookie.value));
    expect(cookieObject.categories.includes("necessary")).toBeTruthy();
  });
});
