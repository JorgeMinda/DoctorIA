import { describe, expect, it } from "vitest";
import {
  PATIENT_ATTENTION_CATEGORIES,
  filterDoctorsByCategory,
  matchesCategory,
} from "../../src/patient/patientCategories";

const doctors = [
  { id: "1", specialty: "Medicina Interna" },
  { id: "2", specialty: "Cardiología" },
  { id: "3", specialty: "Pediatría" },
  { id: "4", specialty: null },
];

describe("matchesCategory", () => {
  it("devuelve todos los médicos con la categoría all", () => {
    expect(doctors.every((d) => matchesCategory(d.specialty, "all"))).toBe(true);
  });

  it("mapea Medicina Interna a Atención General sin importar acentos", () => {
    expect(matchesCategory("Medicina Interna", "general")).toBe(true);
    expect(matchesCategory("Medicina General", "general")).toBe(true);
    expect(matchesCategory("Cardiología", "general")).toBe(false);
  });

  it("detecta Pediatría con keyword sin acento", () => {
    expect(matchesCategory("Pediatría", "pediatria")).toBe(true);
    expect(matchesCategory("Pediatria", "pediatria")).toBe(true);
  });

  it("envía especialidades no clasificadas al catch-all", () => {
    expect(matchesCategory("Cardiología", "especialidades")).toBe(true);
    expect(matchesCategory("Pediatría", "especialidades")).toBe(false);
    expect(matchesCategory(null, "especialidades")).toBe(true);
  });
});

describe("filterDoctorsByCategory", () => {
  it("filtra la lista según la categoría", () => {
    expect(filterDoctorsByCategory(doctors, "pediatria")).toHaveLength(1);
    expect(filterDoctorsByCategory(doctors, "general")).toHaveLength(1);
    expect(filterDoctorsByCategory(doctors, "especialidades")).toHaveLength(2);
    expect(filterDoctorsByCategory(doctors, "all")).toHaveLength(4);
  });

  it("incluye las 6 categorías del selector", () => {
    expect(PATIENT_ATTENTION_CATEGORIES.map((c) => c.id)).toEqual([
      "all",
      "general",
      "odontologia",
      "pediatria",
      "urgencias",
      "especialidades",
    ]);
  });
});