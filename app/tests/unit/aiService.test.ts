import { describe, expect, it } from "vitest";
import {
  generateEpicrisisFromHistory,
  structureClinicalText,
} from "../../src/clinical/services/aiService";

describe("aiService mock — structureClinicalText", () => {
  it("clasifica texto con señales en las secciones correspondientes", async () => {
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
    const text = "Motivo: dolor de cabeza persistente";
    const result = await structureClinicalText({ text, mode: "NOTE" });
    expect(result.originalTextPreserved).toBe(true);
  });

  it("coloca texto sin señales en notaClinica sin perder contenido", async () => {
    const text = "zz qux aaa bbb";
    const result = await structureClinicalText({ text, mode: "NOTE" });
    expect(result.sections.notaClinica).toContain("zz qux aaa bbb");
    expect(result.originalTextPreserved).toBe(true);
  });

  it("devuelve confianza numérica en rango válido", async () => {
    const result = await structureClinicalText({
      text: "Motivo: fiebre\nExamen: normal\nValoración: leve\nPlan: reposo",
      mode: "NOTE",
    });
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

describe("aiService mock — generateEpicrisisFromHistory", () => {
  it("sintetiza epicrisis desde el historial", async () => {
    const result = await generateEpicrisisFromHistory([
      "Paciente con diabetes tipo 2 en control",
      "Última revisión: HbA1c 7.2%",
    ]);

    expect(result.elements.reasonForAdmission).toBeTruthy();
    expect(result.elements.relevantHistory).toBeTruthy();
    expect(result.elements.evolutionSummary).toBeTruthy();
  });

  it("detecta diagnóstico mencionado en el historial", async () => {
    const result = await generateEpicrisisFromHistory([
      "diagnóstico: hipertensión arterial en tratamiento",
    ]);
    expect(result.elements.validatedDiagnoses).toMatch(/hipertensi|diagn/i);
  });

  it("incluye instrucciones de seguimiento por defecto", async () => {
    const result = await generateEpicrisisFromHistory(["nota de control"]);
    expect(result.elements.followUpInstructions).toBeTruthy();
  });
});