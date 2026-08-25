// Tests unitarios: esquema de validación de signos vitales (Fase B3).
// Rangos clínicamente plausibles; campos obligatorios.

import { describe, expect, it } from "vitest";

import { vitalSignInputSchema } from "../../src/clinical/services/vitalSigns";

const VALID = {
  patientId: "p1",
  systolicBP: 120,
  diastolicBP: 80,
  heartRate: 72,
  temperature: 36.6,
  respiratoryRate: 16,
  oxygenSaturation: 98,
  weight: 70,
  height: 175,
};

describe("vitalSignInputSchema", () => {
  it("acepta un registro válido", () => {
    const r = vitalSignInputSchema.safeParse(VALID);
    expect(r.success).toBe(true);
  });

  it("acepta citaId opcional", () => {
    const r = vitalSignInputSchema.safeParse({ ...VALID, citaId: "c1" });
    expect(r.success).toBe(true);
  });

  it("rechaza patientId ausente", () => {
    const { patientId: _omit, ...sinPaciente } = VALID;
    const r = vitalSignInputSchema.safeParse(sinPaciente);
    expect(r.success).toBe(false);
  });

  const casosFueraDeRango: [string, Record<string, number>][] = [
    ["sistólica 400", { systolicBP: 400 }],
    ["diastólica 10", { diastolicBP: 10 }],
    ["frecuencia cardíaca 500", { heartRate: 500 }],
    ["temperatura 50", { temperature: 50 }],
    ["temperatura 20", { temperature: 20 }],
    ["frecuencia respiratoria 2", { respiratoryRate: 2 }],
    ["saturación 120", { oxygenSaturation: 120 }],
    ["peso negativo", { weight: -3 }],
    ["talla 0", { height: 0 }],
  ];

  it.each(casosFueraDeRango)("%s → rechaza", (_nombre, campoMalo) => {
    const r = vitalSignInputSchema.safeParse({ ...VALID, ...campoMalo });
    expect(r.success).toBe(false);
  });
});
