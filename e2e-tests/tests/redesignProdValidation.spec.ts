import { expect, test, type Page } from "@playwright/test";

/**
 * Validación visual del rediseño "Clinical Intelligence" + identidad
 * "Ambient Voice Interface" contra el client desplegado en Render (prod).
 */
const MEDICO = { email: "medico1@doctoria.com", password: "Doctoria2026!" };

test.describe.configure({ mode: "serial" });

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.afterAll(async () => {
  await page.close();
});

async function acceptCookies() {
  const banner = page.locator('button:has-text("Accept all")');
  if (await banner.isVisible().catch(() => false)) {
    await banner.first().click();
  }
}

test("login muestra la identidad Ambient Voice Interface", async () => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await acceptCookies();
  await expect(page.getByText("Ambient Voice Interface")).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText("DoctorIA", { exact: false }).first()).toBeVisible();
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await page.screenshot({
    path: "test-results/redesign-login.png",
    fullPage: true,
  });
});

test("login como médico aterriza en el dashboard rediseñado", async () => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await acceptCookies();
  await page.fill('input[name="email"]', MEDICO.email);
  await page.fill('input[name="password"]', MEDICO.password);
  await Promise.all([
    page.waitForURL("**/clinical/patients", { timeout: 25000 }),
    page.click('button:has-text("Log in")'),
  ]);
  await expect(page.getByText("Panel clínico")).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("heading", { name: "Pacientes" }),
  ).toBeVisible();
  await expect(page.getByText("Pacientes en vista")).toBeVisible();
  await expect(page.getByText("Asistencia IA")).toBeVisible();
  await expect(page.getByText("Lista de pacientes asignados")).toBeVisible();
  await expect(page.locator("span:has-text('PAC-0')").first()).toBeVisible();
  await page.screenshot({
    path: "test-results/redesign-patients.png",
    fullPage: true,
  });
});

test("detalle de paciente historial clínico agarra bien (tabla + badges)", async () => {
  await page.goto("/clinical/patients");
  await page
    .locator('a[href^="/clinical/patients/"]', { hasText: "Ver historia" })
    .first()
    .click();
  await page.waitForURL("**/clinical/patients/*");
  await expect(page.getByText("Historia clínica")).toBeVisible();
  await expect(page.getByText(/notas|epicrisis/i).first()).toBeVisible();
  await page.screenshot({
    path: "test-results/redesign-patient-detail.png",
    fullPage: true,
  });
});

test("auditoría y asistente de voz renderizan", async () => {
  await page.goto("/clinical/audit");
  await expect(page.getByRole("heading", { name: "Auditoría" })).toBeVisible();
  await expect(page.locator("text=Registro").first()).toBeVisible();

  await page.goto("/clinical/voice");
  await expect(
    page.getByRole("heading", { name: "Asistente de voz" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/redesign-voice.png",
    fullPage: true,
  });
});