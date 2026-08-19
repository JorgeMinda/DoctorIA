import { describe, expect, it } from "vitest";
import {
  buildVoiceError,
  buildVoiceSummary,
  parseVoiceCommand,
  parseVoiceQuery,
  resolvePatientByName,
  resolvePatientMatches,
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
  {
    id: "p3",
    firstName: "María",
    lastName: "López",
    syntheticId: "PAC-002",
    birthDate: new Date("1985-01-15"),
    sex: "F",
    medicalHistory: "Diabetes mellitus tipo 2.",
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

describe("parseVoiceCommand", () => {
  it("detecta intención CREATE_NOTE con 'anota en la historia de'", () => {
    const cmd = parseVoiceCommand(
      "anota en la historia de María Torres que presenta fiebre de 38",
    );
    expect(cmd.intent).toBe("CREATE_NOTE");
    expect(cmd.patientQuery).toBe("María Torres");
    expect(cmd.clinicalText).toBe("presenta fiebre de 38");
  });

  it("detecta intención CREATE_NOTE con syntheticId y dictado", () => {
    const cmd = parseVoiceCommand(
      "agrega una nota a PAC-001 el paciente presenta dolor abdominal",
    );
    expect(cmd.intent).toBe("CREATE_NOTE");
    expect(cmd.patientQuery).toBe("PAC-001");
    expect(cmd.clinicalText).toContain("dolor abdominal");
  });

  it("detecta intención CREATE_NOTE con 'registra que'", () => {
    const cmd = parseVoiceCommand("registra que la señora López mejoró de la tos");
    expect(cmd.intent).toBe("CREATE_NOTE");
    expect(cmd.clinicalText).toContain("mejoró de la tos");
  });

  it("mantiene intención RETRIEVE para consultas de resumen", () => {
    const cmd = parseVoiceCommand("dame el resumen de María Torres");
    expect(cmd.intent).toBe("RETRIEVE");
    expect(cmd.patientQuery).toBe("María Torres");
    expect(cmd.clinicalText).toBeUndefined();
  });

  it("ambigüedad: paciente en CREATE_NOTE sin texto clínico detectable", () => {
    const cmd = parseVoiceCommand("agrega una nota de María");
    expect(cmd.intent).toBe("CREATE_NOTE");
    // No se resuelve por nombre ambiguo: la decisión queda del lado del action.
    expect(cmd.patientQuery).toBe("María");
  });

  it("no asume intención CREATE_NOTE por contener 'deja' del verbo dejar", () => {
    const cmd = parseVoiceCommand("deja abierta la consulta de María Torres");
    expect(cmd.intent).toBe("RETRIEVE");
  });
});

describe("resolvePatientMatches (ambigüedad)", () => {
  it("devuelve todas las coincidencias para un nombre compartido (dos Marías)", () => {
    const matches = resolvePatientMatches(patients, "María");
    expect(matches.length).toBe(2);
    expect(matches.map((m) => m.syntheticId).sort()).toEqual(["PAC-002", "PAC-003"]);
  });

  it("syntheticId exacto NO es ambiguo", () => {
    const matches = resolvePatientMatches(patients, "pac-002");
    expect(matches.length).toBe(1);
    expect(matches[0]?.lastName).toBe("López");
  });

  it("nombre y apellido completos desambiguan", () => {
    const matches = resolvePatientMatches(patients, "María Torres");
    expect(matches.length).toBe(1);
    expect(matches[0]?.syntheticId).toBe("PAC-003");
  });

  it("sin coincidencias retorna lista vacía", () => {
    expect(resolvePatientMatches(patients, "Zulma Ramírez")).toEqual([]);
  });

  it("query vacía retorna lista vacía", () => {
    expect(resolvePatientMatches(patients, null)).toEqual([]);
  });

  it("syntheticId por encima de coincidencia de nombre (PAC-003 primero que María)", () => {
    const matches = resolvePatientMatches(patients, "PAC-003");
    expect(matches.length).toBe(1);
    expect(matches[0]?.lastName).toBe("Torres");
  });
});
