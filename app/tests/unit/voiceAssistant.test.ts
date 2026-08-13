import { describe, expect, it } from "vitest";
import {
  buildVoiceError,
  buildVoiceSummary,
  parseVoiceQuery,
  resolvePatientByName,
  type VoicePatientMatch,
} from "../../src/clinical/services/voiceAssistant";

const patients: VoicePatientMatch[] = [
  {
    id: "p1",
    firstName: "María",
    lastName: "Torres",
    syntheticId: "PAC-003",
    birthDate: new Date("1978-07-25"),
    sex: "F",
    medicalHistory: "Asma bronquial. Hipotiroidismo.",
    allergies: null,
  },
  {
    id: "p2",
    firstName: "Ana",
    lastName: "Paredes",
    syntheticId: "PAC-001",
    birthDate: new Date("1990-04-12"),
    sex: "F",
    medicalHistory: "Hipertensión arterial controlada.",
    allergies: null,
  },
];

describe("parseVoiceQuery", () => {
  it("extrae el nombre tras 'resumen de'", () => {
    const { name } = parseVoiceQuery("dame el resumen de María Torres");
    expect(name).toBe("María Torres");
  });

  it("extrae el nombre tras 'resumen del paciente'", () => {
    const { name } = parseVoiceQuery("resumen del paciente María Torres");
    expect(name).toBe("María Torres");
  });

  it("reconoce 'ficha de' y 'historia de'", () => {
    expect(parseVoiceQuery("ficha de Ana Paredes").name).toBe("Ana Paredes");
    expect(parseVoiceQuery("historia de Ana Paredes").name).toBe("Ana Paredes");
  });

  it("soporta el patrón 'paciente <Nombre>' sin verbo", () => {
    const { name } = parseVoiceQuery("paciente María Torres");
    expect(name).toBe("María Torres");
  });

  it("retorna name null si no menciona un paciente", () => {
    const { name, tokens } = parseVoiceQuery("cuáles son los pacientes asignados?");
    expect(name).toBeNull();
    expect(tokens.length).toBeGreaterThan(0);
  });

  it("ignora signos de puntuación al final", () => {
    const { name } = parseVoiceQuery("resumen de María Torres!");
    expect(name).toBe("María Torres");
  });
});

describe("resolvePatientByName", () => {
  it("resuelve por syntheticId exacto", () => {
    const match = resolvePatientByName(patients, "pac-003");
    expect(match?.id).toBe("p1");
  });

  it("resuelve por nombre y apellido completo", () => {
    const match = resolvePatientByName(patients, "María Torres");
    expect(match?.id).toBe("p1");
  });

  it("resuelve con coincidencia parcial", () => {
    const match = resolvePatientByName(patients, "paredes");
    expect(match?.id).toBe("p2");
  });

  it("retorna null con nombre desconocido", () => {
    expect(resolvePatientByName(patients, "Zulma Ramírez")).toBeNull();
  });

  it("retorna null con nombre nulo", () => {
    expect(resolvePatientByName(patients, null)).toBeNull();
  });
});

describe("buildVoiceSummary", () => {
  it("genera resumen determinista y marcado como sintético", () => {
    const a = buildVoiceSummary("resumen de María Torres", patients[0]);
    const b = buildVoiceSummary("resumen de María Torres", patients[0]);

    expect(a.summary).toEqual(b.summary);
    expect(a.vitals).toEqual(b.vitals);
    expect(a.evolutionSeries).toEqual(b.evolutionSeries);
    expect(a.requiresValidation).toBe(true);
    expect(a.source).toBe("DEMO_SYNTHETIC");
  });

  it("incluye datos del paciente y serie de evolución", () => {
    const res = buildVoiceSummary("resumen de María Torres", patients[0]);
    expect(res.patient?.syntheticId).toBe("PAC-003");
    expect(res.patient?.age).toBeGreaterThanOrEqual(45);
    expect(res.vitals.length).toBe(2);
    expect(res.evolutionSeries.length).toBe(4);
    expect(res.actionLinks.openPatient).toBe(true);
  });
});

describe("buildVoiceError", () => {
  it("retorna error NOT_FOUND sin paciente", () => {
    const res = buildVoiceError("resumen de Zulma", "NOT_FOUND");
    expect(res.patient).toBeNull();
    expect(res.summary.join(" ")).toContain("No encontré");
    expect(res.actionLinks.openPatient).toBe(false);
    expect(res.requiresValidation).toBe(true);
  });

  it("retorna error NO_ACCESS", () => {
    const res = buildVoiceError("resumen de Zulma", "NO_ACCESS");
    expect(res.summary.join(" ")).toMatch(/No tienes acceso/i);
  });
});
