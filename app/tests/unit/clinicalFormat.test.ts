import { describe, expect, it } from "vitest";
import {
  extractSuggestedDiagnoses,
  patientAge,
  sexLabel,
} from "../../src/clinical/services/clinicalFormat";

describe("clinicalFormat — extractSuggestedDiagnoses", () => {
  it("extrae diagnósticos limpios de texto con listas numeradas", () => {
    const text = `
      1. Hipertensión arterial esencial
      2. Diabetes mellitus tipo 2
      Plan: Control metabólico en 3 meses
    `;
    const suggestions = extractSuggestedDiagnoses(text);
    expect(suggestions).toContain("Hipertensión arterial esencial");
    expect(suggestions).toContain("Diabetes mellitus tipo 2");
    // "Plan: ..." debe ser descartado por la regla de prefijos no diagnósticos
    expect(suggestions).not.toContain("Plan: Control metabólico en 3 meses");
  });

  it("elimina prefijos de viñetas, guiones y etiquetas como 'Diagnóstico:'", () => {
    const text = `
      - Faringitis aguda estreptocócica
      • Otitis media serosa
      Diagnóstico presuntivo: Rinofaringitis
    `;
    const suggestions = extractSuggestedDiagnoses(text);
    expect(suggestions).toEqual([
      "Faringitis aguda estreptocócica",
      "Otitis media serosa",
      "Rinofaringitis",
    ]);
  });

  it("ignora valores vacíos, nulos, textos demasiado cortos o demasiado largos", () => {
    const longText = "A".repeat(80);
    const suggestions = extractSuggestedDiagnoses(
      null,
      undefined,
      "",
      "Ok", // < 3 chars
      longText, // > 60 chars
      "Asma bronquial moderada persistente",
    );
    expect(suggestions).toEqual(["Asma bronquial moderada persistente"]);
  });

  it("elimina duplicados sin distinción de mayúsculas/minúsculas y limita a un máximo de 4", () => {
    const text1 = "Cefalea tensional\nMigraña con aura\nGastritis crónica";
    const text2 = "cefalea tensional\nLumbago agudo\nArtrosis de rodilla";
    const suggestions = extractSuggestedDiagnoses(text1, text2);

    expect(suggestions).toHaveLength(4);
    expect(suggestions).toEqual([
      "Cefalea tensional",
      "Migraña con aura",
      "Gastritis crónica",
      "Lumbago agudo",
    ]);
  });
});

describe("clinicalFormat — patientAge and sexLabel", () => {
  it("calcula la edad del paciente en base a su fecha de nacimiento", () => {
    const thirtyYearsInMs = 30 * 365.25 * 24 * 60 * 60 * 1000 + 1000;
    const birthDate = new Date(Date.now() - thirtyYearsInMs);
    expect(patientAge(birthDate)).toBe(30);
  });

  it("formatea la etiqueta de sexo correctamente", () => {
    expect(sexLabel("M")).toBe("Masculino");
    expect(sexLabel("F")).toBe("Femenino");
    expect(sexLabel("O")).toBe("Otro");
  });
});
