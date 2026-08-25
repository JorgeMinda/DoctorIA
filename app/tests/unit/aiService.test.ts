// Tests unitarios del servicio de IA (herméticos: mockean fetch de OpenRouter).
// FASE 2/10: aserciones originales conservadas + validación Zod
// (AI_INVALID_RESPONSE_ERROR), timeout, reintentos e interfaz AIService.

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AIInvalidResponseError,
  aiService,
  generateEpicrisisFromHistory,
  structureClinicalText,
} from "../../src/clinical/services/aiService";

function openRouterJsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    }),
    text: async () => "",
  };
}

function stubFetchOnce(impl: () => Promise<unknown>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

const VALID_NOTE_RESPONSE = {
  sections: {
    motivoConsulta: "El paciente refiere dolor abdominal de 3 días",
    notaClinica: "Cuadro leve, sin signos de alarma",
    examenFisico: "TA 120/80, abdomen blando",
    valoracionClinica: "cuadro leve",
    planIndicaciones: "paracetamol 500mg cada 8h",
  },
  unclassifiedContent: null,
  originalTextPreserved: true,
  confidence: 0.9,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("aiService mock — structureClinicalText", () => {
  it("clasifica texto con señales en las secciones correspondientes", async () => {
    stubFetchOnce(async () => openRouterJsonResponse(VALID_NOTE_RESPONSE));

    const input = [
      "Motivo: dolor abdominal de 3 días",
      "Examen: TA 120/80, abdomen blando",
      "Valoración: cuadro leve",
      "Plan: paracetamol 500mg cada 8h",
    ].join("\n\n");

    const result = await structureClinicalText({ text: input, mode: "NOTE" });

    expect(result.sections.motivoConsulta).toContain("dolor abdominal");
    expect(result.sections.examenFisico).toContain("TA 120/80");
    expect(result.sections.valoracionClinica).toContain("cuadro leve");
    expect(result.sections.planIndicaciones).toContain("paracetamol");
  });

  it("preserva el texto original (RNF-004)", async () => {
    stubFetchOnce(async () =>
      openRouterJsonResponse({
        ...VALID_NOTE_RESPONSE,
        sections: {
          motivoConsulta: "dolor de cabeza persistente",
          notaClinica: "",
          examenFisico: "",
          valoracionClinica: "",
          planIndicaciones: "",
        },
      }),
    );

    const text = "Motivo: dolor de cabeza persistente";
    const result = await structureClinicalText({ text, mode: "NOTE" });
    expect(result.originalTextPreserved).toBe(true);
    expect(JSON.stringify(result)).toContain("dolor de cabeza");
  });

  it("coloca texto sin señales en notaClinica sin perder contenido", async () => {
    stubFetchOnce(async () =>
      openRouterJsonResponse({
        sections: {
          motivoConsulta: "",
          notaClinica: "",
          examenFisico: "",
          valoracionClinica: "",
          planIndicaciones: "",
        },
        unclassifiedContent: null,
      }),
    );

    const text = "Texto libre sin marcadores de sección";
    const result = await structureClinicalText({ text, mode: "NOTE" });

    // RNF-004: si no clasificó nada, el texto original se preserva íntegro.
    expect(result.sections.notaClinica).toBe(text);
    expect(result.unclassifiedContent).toBeNull();
  });

  it("retorna confidence numérico entre 0 y 1", async () => {
    stubFetchOnce(async () => openRouterJsonResponse(VALID_NOTE_RESPONSE));

    const result = await structureClinicalText({ text: "nota", mode: "NOTE" });
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

describe("aiService — interfaz unificada (Fase 2)", () => {
  it("expone los tres métodos de AIService", () => {
    expect(typeof aiService.structureClinicalText).toBe("function");
    expect(typeof aiService.generateEpicrisisDraft).toBe("function");
    expect(typeof aiService.generateAddendumDraft).toBe("function");
  });

  it("generateEpicrisisDraft es alias del generador desde historial", () => {
    expect(aiService.generateEpicrisisDraft).toBe(generateEpicrisisFromHistory);
  });
});

describe("aiService — validación Zod de respuesta", () => {
  it("lanza AI_INVALID_RESPONSE_ERROR si falta la estructura de secciones", async () => {
    stubFetchOnce(async () =>
      openRouterJsonResponse({ foo: "respuesta sin sections" }),
    );

    await expect(
      structureClinicalText({ text: "texto", mode: "NOTE" }),
    ).rejects.toBeInstanceOf(AIInvalidResponseError);

    await expect(
      structureClinicalText({ text: "texto", mode: "NOTE" }),
    ).rejects.toMatchObject({ code: "AI_INVALID_RESPONSE_ERROR" });
  });

  it("lanza AI_INVALID_RESPONSE_ERROR si la epicrisis no trae elements", async () => {
    stubFetchOnce(async () =>
      openRouterJsonResponse({ elements: { reasonForAdmission: "x" } }),
    );

    await expect(generateEpicrisisFromHistory(["nota"])).rejects.toMatchObject({
      code: "AI_INVALID_RESPONSE_ERROR",
    });
  });

  it("generateAddendumDraft valida estructura y limpia valores nulos", async () => {
    stubFetchOnce(async () =>
      openRouterJsonResponse({
        sections: {
          motivoConsulta: "Sin cambios",
          notaClinica: "Se aclara plan de analgesia",
          examenFisico: null,
          valoracionClinica: "n/a",
          planIndicaciones: "",
        },
        unclassifiedContent: "Texto adicional no clasificado",
      }),
    );

    const result = await aiService.generateAddendumDraft(
      "Nota original confirmada…",
      "Aclarar el plan de analgesia",
    );
    expect(result.sections.notaClinica).toContain("analgesia");
    expect(result.sections.examenFisico).toBeNull();
    expect(result.sections.valoracionClinica).toBeNull();
    expect(result.unclassifiedContent).toContain("no clasificado");
  });
});

describe("aiService — transporte (timeout y reintentos)", () => {
  it("mapea AbortError a mensaje de timeout controlado", async () => {
    stubFetchOnce(async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      throw abortError;
    });

    await expect(
      structureClinicalText({ text: "t", mode: "NOTE" }),
    ).rejects.toThrow(/Timeout al llamar al asistente de IA/);
  });

  it("reintenta ante 429 y tiene éxito en el segundo intento", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ "Retry-After": "0" }),
        json: async () => ({}),
        text: async () => "",
      })
      .mockResolvedValueOnce(openRouterJsonResponse(VALID_NOTE_RESPONSE));
    vi.stubGlobal("fetch", fetchMock);

    const result = await structureClinicalText({ text: "nota", mode: "NOTE" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.sections.motivoConsulta).toContain("dolor abdominal");
  });
});

describe("aiService mock — generateEpicrisisFromHistory", () => {
  it("sintetiza epicrisis desde el historial", async () => {
    stubFetchOnce(async () =>
      openRouterJsonResponse({
        elements: {
          reasonForAdmission: "Control de diabetes tipo 2",
          relevantHistory: "Diabetes tipo 2 en seguimiento",
          evolutionSummary: "Última revisión con HbA1c 7.2%",
          proceduresResults: "",
          validatedDiagnoses: "",
          conditionAtDischarge: "",
          followUpInstructions: "",
        },
        unclassifiedContent: null,
      }),
    );

    const result = await generateEpicrisisFromHistory([
      "Paciente con diabetes tipo 2 en control",
      "Última revisión: HbA1c 7.2%",
    ]);

    expect(result.elements.reasonForAdmission).toBeTruthy();
    expect(result.elements.relevantHistory).toBeTruthy();
    expect(result.elements.evolutionSummary).toBeTruthy();
  });

  it("detecta diagnóstico mencionado en el historial", async () => {
    stubFetchOnce(async () =>
      openRouterJsonResponse({
        elements: {
          reasonForAdmission: "",
          relevantHistory: "",
          evolutionSummary: "",
          proceduresResults: "",
          validatedDiagnoses: "Hipertensión arterial en tratamiento",
          conditionAtDischarge: "",
          followUpInstructions: "",
        },
        unclassifiedContent: null,
      }),
    );

    const result = await generateEpicrisisFromHistory([
      "diagnóstico: hipertensión arterial en tratamiento",
    ]);
    expect(result.elements.validatedDiagnoses).toMatch(/hipertensi|diagn/i);
  });

  it("incluye instrucciones de seguimiento por defecto", async () => {
    stubFetchOnce(async () =>
      openRouterJsonResponse({
        elements: {
          reasonForAdmission: "",
          relevantHistory: "",
          evolutionSummary: "",
          proceduresResults: "",
          validatedDiagnoses: "",
          conditionAtDischarge: "",
          followUpInstructions: "Control rutinario en consulta externa",
        },
        unclassifiedContent: null,
      }),
    );

    const result = await generateEpicrisisFromHistory(["nota de control"]);
    expect(result.elements.followUpInstructions).toBeTruthy();
  });
});
