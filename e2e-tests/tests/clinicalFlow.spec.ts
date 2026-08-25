// E2E: flujo clínico de asistencia IA (kickoff Fase 10).
//
// NOTA ARQUITECTÓNICA: OpenRouter se llama DESDE EL SERVIDOR, por lo que
// `page.route()` NO puede interceptarlo. El mock se hace contra las rutas HTTP
// de las operaciones, devolviendo respuestas superjson válidas que simulan al
// backend. OJO: Wasp kebab-cases los identificadores pegando siglas —
// requestAIStructuring -> `/operations/request-aistructuring`.
//
// Requiere la app corriendo localmente (`wasp start`) con la BD seedeada:
//   npx playwright test -c playwright.local.config.ts tests/clinicalFlow.spec.ts

import { expect, test, type Page } from "@playwright/test";
import SuperJSON from "superjson";

const MEDICO = {
  email: "medico1@doctoria.com",
  password: "Doctoria2026!",
};

const ROUTE_AI = "**/operations/request-aistructuring";
const ROUTE_NOTE = "**/operations/get-clinical-note";

async function loginMedico(page: Page): Promise<void> {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', MEDICO.email);
  await page.fill('input[name="password"]', MEDICO.password);
  const clickLogin = page.click('button:has-text("Log in")');
  await Promise.all([
    page
      .waitForResponse((r) => r.url().includes("login") && r.status() === 200)
      .catch((err) => console.error(err.message)),
    clickLogin,
  ]);
  await page.waitForURL("**/clinical/patients");
}

async function callOperation(
  page: Page,
  route: string,
  args: Record<string, unknown>,
): Promise<any> {
  const resp = await page.request.post(`/operations/${route}`, {
    data: JSON.stringify(SuperJSON.serialize(args)),
    headers: { "Content-Type": "application/json" },
  });
  expect(resp.status()).toBe(200);
  return SuperJSON.parse(await resp.text());
}

function buildMockNote(noteId: string, status: string) {
  return {
    // Shape completo de ClinicalNoteDetail tal como lo devuelve getClinicalNote.
    id: noteId,
    patientId: "seed-patient",
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    status,
    aiAssisted: status === "DRAFT_AI_ASSISTED",
    noteType: "ORIGINAL",
    originalText:
      "Motivo: cefalea persistente. Examen: sin focalidad. Plan: analgesia.",
    motivoConsulta:
      status === "DRAFT_AI_ASSISTED"
        ? "Cefalea persistente de 3 días de evolución"
        : null,
    notaClinica:
      status === "DRAFT_AI_ASSISTED"
        ? "Consciente y orientado, sin signos de alarma"
        : null,
    examenFisico:
      status === "DRAFT_AI_ASSISTED"
        ? "Exploración neurológica sin focalidad"
        : null,
    valoracionClinica:
      status === "DRAFT_AI_ASSISTED" ? "Cefalea tensional probable" : null,
    planIndicaciones:
      status === "DRAFT_AI_ASSISTED"
        ? "Analgesia sintomática y control en 7 días"
        : null,
    sectionsNotApplicable: {},
    unclassifiedContent: null,
    addendumReason: null,
    confirmedAt: null,
    author: {
      fullName: "Dra. Laura Méndez",
      username: null,
      email: MEDICO.email,
    },
    confirmedBy: null,
    parentNote: null,
    childNotes: [],
    patient: {
      id: "seed-patient",
      syntheticId: "PAC-001",
      firstName: "Ana",
      lastName: "Paredes",
    },
  };
}

test.describe.configure({ mode: "serial" });

let page: Page;
let noteId = "";
let aiApplied = false;
let casTokenReceived = false;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();

  await loginMedico(page);

  const patientsPayload = await callOperation(page, "get-patients", {
    page: 1,
    pageSize: 20,
  });
  const patients = patientsPayload?.json?.patients ?? [];
  expect(patients.length).toBeGreaterThan(0);

  const created = await callOperation(page, "create-clinical-note", {
    patientId: patients[0].id,
    originalText:
      "Motivo: cefalea persistente. Examen: sin focalidad. Plan: analgesia y control.",
  });
  noteId = created?.json?.id;
  expect(noteId).toBeTruthy();
});

test.afterAll(async () => {
  await page.close();
});

async function installAiMocks(options: { conflict?: boolean } = {}) {
  aiApplied = false;
  casTokenReceived = false;

  await page.unroute(ROUTE_AI);
  await page.unroute(ROUTE_NOTE);

  // La lectura de la nota refleja el estado simulado (manual -> IA).
  await page.route(ROUTE_NOTE, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        SuperJSON.serialize({
          json: buildMockNote(noteId, aiApplied ? "DRAFT_AI_ASSISTED" : "DRAFT_MANUAL"),
        }),
      ),
    });
  });

  await page.route(ROUTE_AI, async (route) => {
    if (options.conflict) {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          message:
            "El documento fue modificado mientras la IA procesaba. Recarga para ver los cambios.",
        }),
      });
      return;
    }
    try {
      const parsed = SuperJSON.parse(route.request().postData() ?? "{}") as {
        json?: { expectedUpdatedAt?: string };
      };
      casTokenReceived =
        typeof parsed.json?.expectedUpdatedAt === "string" &&
        parsed.json.expectedUpdatedAt.length > 0;
    } catch {
      casTokenReceived = false;
    }
    aiApplied = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        SuperJSON.serialize({
          json: buildMockNote(noteId, "DRAFT_AI_ASSISTED"),
        }),
      ),
    });
  });
}

test("estructurar con IA mockeada deja la nota en DRAFT_AI_ASSISTED con badge", async () => {
  await installAiMocks();
  await page.goto(`/clinical/notes/${noteId}`, { waitUntil: "domcontentloaded" });

  // Estado inicial: borrador manual, sin badge IA.
  await expect(page.getByText("Borrador manual").first()).toBeVisible();

  await page.getByRole("button", { name: /Estructurar con IA/ }).click();

  // La UI aplica la respuesta mockeada: estado, badge, toast y disclaimer.
  await expect(
    page.getByText("Borrador asistido por IA").first(),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Nota estructurada con IA")).toBeVisible();
  await expect(
    page.getByText(/debe ser revisada y validada por el profesional/),
  ).toBeVisible();

  // Fase 7: el cliente envió el token CAS (updatedAt esperado).
  expect(casTokenReceived).toBe(true);
});

test("409 del CAS muestra toast destructivo unificado", async () => {
  await installAiMocks({ conflict: true });
  await page.goto(`/clinical/notes/${noteId}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Borrador manual").first()).toBeVisible();

  await page.getByRole("button", { name: /Estructurar con IA/ }).click();

  await expect(
    page.getByText("No se pudo aplicar la asistencia de IA"),
  ).toBeVisible({ timeout: 10_000 });
});
