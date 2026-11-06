import { describe, expect, it } from "vitest";
import {
  formatDictation,
  parseFloatingVoiceCommand,
} from "../../src/client/voice/floatingVoice";

describe("formatDictation", () => {
  it("convierte 'punto y coma' en ';'", () => {
    expect(formatDictation("dolor torácico punto y coma tos seca")).toBe(
      "dolor torácico; tos seca",
    );
  });

  it("convierte paréntesis hablados", () => {
    expect(formatDictation("abrir paréntesis nota cerrar paréntesis")).toBe(
      "( nota)",
    );
  });

  it("convierte salto de línea hablado", () => {
    expect(formatDictation("nueva línea plan terapéutico")).toBe(
      "\nplan terapéutico",
    );
  });

  it("convierte signos de interrogación y exclamación", () => {
    expect(formatDictation("signo de interrogación")).toBe("?");
    expect(formatDictation("signo de exclamación")).toBe("!");
  });

  it("no altera términos clínicos ('coma' médica, 'punto' de inyección)", () => {
    expect(formatDictation("paciente en coma hipoglucémico")).toBe(
      "paciente en coma hipoglucémico",
    );
    expect(formatDictation("punto de inyección limpio")).toBe(
      "punto de inyección limpio",
    );
  });

  it("devuelve el texto sin cambios si no hay puntuación hablada", () => {
    expect(formatDictation("  paciente refiere cefalea  ")).toBe(
      "paciente refiere cefalea",
    );
  });
});

describe("parseFloatingVoiceCommand", () => {
  it("detecta intención de pacientes", () => {
    const r = parseFloatingVoiceCommand("buscar paciente Ana Paredes");
    expect(r).toEqual({
      type: "NAVIGATE",
      path: "/clinical/patients",
      message: "Abriendo pacientes",
    });
  });

  it("detecta intención de agenda por 'cita', 'agenda' o 'turno'", () => {
    expect(parseFloatingVoiceCommand("abrir mis citas").type).toBe("NAVIGATE");
    expect(parseFloatingVoiceCommand("ver la agenda").type).toBe("NAVIGATE");
    expect(parseFloatingVoiceCommand("siguiente turno").type).toBe("NAVIGATE");
    const r = parseFloatingVoiceCommand("agendar cita");
    expect(r.type === "NAVIGATE" && r.path).toBe("/clinical/agenda");
  });

  it("detecta intención del asistente de voz", () => {
    const r = parseFloatingVoiceCommand("abrir asistente de voz");
    expect(r.type === "NAVIGATE" && r.path).toBe("/clinical/voice");
  });

  it("detecta auditoría y administración", () => {
    expect(
      parseFloatingVoiceCommand("ver auditoría").type === "NAVIGATE" &&
        (parseFloatingVoiceCommand("ver auditoría") as any).path,
    ).toBe("/clinical/audit");
    expect(
      parseFloatingVoiceCommand("ir a administración").type === "NAVIGATE" &&
        (parseFloatingVoiceCommand("ir a administración") as any).path,
    ).toBe("/clinical/admin");
  });

  it("detecta el portal del paciente", () => {
    const r = parseFloatingVoiceCommand("abrir mi portal");
    expect(r.type === "NAVIGATE" && r.path).toBe("/patient/dashboard");
  });

  it("ignora acentos al detectar intención", () => {
    const r = parseFloatingVoiceCommand("abrir auditoria");
    expect(r.type === "NAVIGATE" && r.path).toBe("/clinical/audit");
  });

  it("devuelve NONE para texto sin intención reconocida", () => {
    expect(parseFloatingVoiceCommand("hola qué tal")).toEqual({ type: "NONE" });
    expect(parseFloatingVoiceCommand("")).toEqual({ type: "NONE" });
    expect(parseFloatingVoiceCommand("   ")).toEqual({ type: "NONE" });
  });

  it("prefiere agenda sobre pacientes cuando ambos aparecen", () => {
    const r = parseFloatingVoiceCommand("citas de pacientes de mañana");
    expect(r.type === "NAVIGATE" && r.path).toBe("/clinical/agenda");
  });
});
