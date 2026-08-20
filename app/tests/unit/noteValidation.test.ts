import { describe, expect, it } from "vitest";
import {
  REQUIRED_SECTIONS,
  SECTION_LABELS,
  validateConfirmableNote,
} from "../../src/clinical/services/noteValidation";

const completeSections = {
  motivoConsulta: "Dolor abdominal de 3 días",
  notaClinica: "Paciente refiere dolor...",
  examenFisico: "TA 120/80, abdomen blando",
  valoracionClinica: "Cuadro leve, sin signos de alarma",
  planIndicaciones: "Paracetamol 500mg cada 8h",
};

describe("validateConfirmableNote — RF-026", () => {
  it("acepta una nota con las 5 secciones completas", () => {
    const result = validateConfirmableNote({
      sections: completeSections,
      originalText: "Dolor abdominal de 3 días",
      patientId: "p1",
      authorId: "u1",
    });
    expect(result.ok).toBe(true);
  });

  it("exige paciente seleccionado", () => {
    const result = validateConfirmableNote({
      sections: completeSections,
      originalText: "texto",
      patientId: "",
      authorId: "u1",
    });
    expect(result.ok).toBe(false);
  });

  it("exige texto original íntegro (RNF-004)", () => {
    const result = validateConfirmableNote({
      sections: completeSections,
      originalText: "   ",
      patientId: "p1",
      authorId: "u1",
    });
    expect(result.ok).toBe(false);
  });

  it("exige profesional responsable", () => {
    const result = validateConfirmableNote({
      sections: completeSections,
      originalText: "texto",
      patientId: "p1",
      authorId: "",
    });
    expect(result.ok).toBe(false);
  });
});

describe("validateConfirmableNote — RF-027 (bloqueo con secciones vacías)", () => {
  it("bloquea si una sección obligatoria está vacía", () => {
    const result = validateConfirmableNote({
      sections: { ...completeSections, examenFisico: "" },
      originalText: "texto",
      patientId: "p1",
      authorId: "u1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toContain("examenFisico");
    }
  });

  it("identifica todas las secciones faltantes", () => {
    const result = validateConfirmableNote({
      sections: { motivoConsulta: "solo esto" },
      originalText: "texto",
      patientId: "p1",
      authorId: "u1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing.sort()).toEqual(
        REQUIRED_SECTIONS.filter((s) => s !== "motivoConsulta").sort(),
      );
    }
  });
});

describe("validateConfirmableNote — secciones 'No aplica' con justificación", () => {
  it("acepta una sección 'No aplica' con justificación", () => {
    const result = validateConfirmableNote({
      sections: { ...completeSections, examenFisico: null },
      sectionsNotApplicable: { examenFisico: "Paciente sin consulta presencial" },
      originalText: "texto",
      patientId: "p1",
      authorId: "u1",
    });
    expect(result.ok).toBe(true);
  });

  it("bloquea una sección 'No aplica' sin justificación", () => {
    const result = validateConfirmableNote({
      sections: { ...completeSections, examenFisico: null },
      sectionsNotApplicable: { examenFisico: "" },
      originalText: "texto",
      patientId: "p1",
      authorId: "u1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toContain("examenFisico");
    }
  });

  it("regresión: marcar 'No aplica' (clave presente, sin justificar) bloquea aunque la sección tenga texto", () => {
    // El bug: el checkbox guardaba "" y `Boolean("") === false` hacía que el
    // estado "No aplica" no existiera. Con la semántica corregida, la clave
    // presente (aunque sea "") ES "No aplica" y exige justificación (RF-026-5).
    const result = validateConfirmableNote({
      sections: completeSections,
      sectionsNotApplicable: { examenFisico: "" },
      originalText: "texto",
      patientId: "p1",
      authorId: "u1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toContain("examenFisico");
    }
  });
});

describe("constantes de secciones", () => {
  it("define exactamente 5 secciones obligatorias", () => {
    expect(REQUIRED_SECTIONS).toHaveLength(5);
  });

  it("tiene etiqueta legible para cada sección", () => {
    for (const key of REQUIRED_SECTIONS) {
      expect(SECTION_LABELS[key]).toBeTruthy();
    }
  });
});
