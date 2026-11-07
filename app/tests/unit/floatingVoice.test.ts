import { describe, expect, it } from "vitest";
import {
  formatDictation,
  parseFloatingVoiceCommand,
  wantsCreateNote,
  wantsPatientSummary,
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
  it("agendar cita → agenda con modal nueva cita (?new=1)", () => {
    expect(parseFloatingVoiceCommand("agendar cita")).toEqual({
      type: "NAVIGATE",
      path: "/clinical/agenda?new=1",
      message: "Abriendo nueva cita",
    });
    expect(parseFloatingVoiceCommand("nuevo turno")).toEqual({
      type: "NAVIGATE",
      path: "/clinical/agenda?new=1",
      message: "Abriendo nueva cita",
    });
  });

  it("buscar citas/turnos → agenda", () => {
    expect(parseFloatingVoiceCommand("buscar mis citas")).toEqual({
      type: "NAVIGATE",
      path: "/clinical/agenda",
      message: "Abriendo agenda",
    });
    expect(parseFloatingVoiceCommand("siguiente turno").type).toBe("NAVIGATE");
    expect(parseFloatingVoiceCommand("abrir la agenda").type).toBe("NAVIGATE");
  });

  it("citas pendientes/completadas → agenda con filtro de estado", () => {
    expect(parseFloatingVoiceCommand("citas pendientes")).toEqual({
      type: "NAVIGATE",
      path: "/clinical/agenda?status=SCHEDULED",
      message: "Abriendo citas pendientes",
    });
    expect(parseFloatingVoiceCommand("citas completadas")).toEqual({
      type: "NAVIGATE",
      path: "/clinical/agenda?status=COMPLETED",
      message: "Abriendo historial de citas",
    });
  });

  it("buscar paciente con nombre → padrón filtrado por ?q=", () => {
    expect(parseFloatingVoiceCommand("buscar paciente Ana Paredes")).toEqual({
      type: "NAVIGATE",
      path: "/clinical/patients?q=Ana%20Paredes",
      message: "Buscando Ana Paredes",
    });
    expect(parseFloatingVoiceCommand("abrir ficha de Juan Pérez")).toEqual({
      type: "NAVIGATE",
      path: "/clinical/patients?q=Juan%20P%C3%A9rez",
      message: "Buscando Juan Pérez",
    });
    expect(
      parseFloatingVoiceCommand("ver la historia del paciente María López").path,
    ).toBe("/clinical/patients?q=Mar%C3%ADa%20L%C3%B3pez");
  });

  it("acepta imperativo 'busca' además de 'buscar'", () => {
    expect(parseFloatingVoiceCommand("busca paciente Ana Paredes")).toEqual({
      type: "NAVIGATE",
      path: "/clinical/patients?q=Ana%20Paredes",
      message: "Buscando Ana Paredes",
    });
    expect(parseFloatingVoiceCommand("busca paciente ana paredes").path).toBe(
      "/clinical/patients?q=ana%20paredes",
    );
    expect(parseFloatingVoiceCommand("busca la ficha de Juan Pérez").path).toBe(
      "/clinical/patients?q=Juan%20P%C3%A9rez",
    );
    expect(parseFloatingVoiceCommand("muestra el paciente María López").path).toBe(
      "/clinical/patients?q=Mar%C3%ADa%20L%C3%B3pez",
    );
    expect(parseFloatingVoiceCommand("consulta el paciente José Díaz").path).toBe(
      "/clinical/patients?q=Jos%C3%A9%20D%C3%ADaz",
    );
  });

  it("navegación a pacientes acepta 'busca pacientes' y 'mostrar pacientes'", () => {
    expect(parseFloatingVoiceCommand("busca pacientes")).toEqual({
      type: "NAVIGATE",
      path: "/clinical/patients",
      message: "Abriendo pacientes",
    });
    expect(parseFloatingVoiceCommand("mostrar pacientes")).toEqual({
      type: "NAVIGATE",
      path: "/clinical/patients",
      message: "Abriendo pacientes",
    });
  });

  it("navegación general: auditoría, administración, asistente, portal, pacientes", () => {
    expect(parseFloatingVoiceCommand("ver auditoría").type === "NAVIGATE" &&
      (parseFloatingVoiceCommand("ver auditoría") as any).path,
    ).toBe("/clinical/audit");
    expect(
      parseFloatingVoiceCommand("ir a administración").type === "NAVIGATE" &&
        (parseFloatingVoiceCommand("ir a administración") as any).path,
    ).toBe("/clinical/admin");
    expect(
      parseFloatingVoiceCommand("abrir asistente de voz").type === "NAVIGATE" &&
        (parseFloatingVoiceCommand("abrir asistente de voz") as any).path,
    ).toBe("/clinical/voice");
    expect(
      parseFloatingVoiceCommand("abrir mi portal").type === "NAVIGATE" &&
        (parseFloatingVoiceCommand("abrir mi portal") as any).path,
    ).toBe("/patient/dashboard");
    expect(
      parseFloatingVoiceCommand("abrir pacientes").type === "NAVIGATE" &&
        (parseFloatingVoiceCommand("abrir pacientes") as any).path,
    ).toBe("/clinical/patients");
  });

  it("ignora acentos al detectar intención", () => {
    const r = parseFloatingVoiceCommand("ver auditoria");
    expect(r.type === "NAVIGATE" && r.path).toBe("/clinical/audit");
  });

  it("devuelve NONE para texto clínico dictado o saludos (sin intención)", () => {
    expect(parseFloatingVoiceCommand("paciente refiere cefalea")).toEqual({
      type: "NONE",
    });
    expect(parseFloatingVoiceCommand("hola qué tal")).toEqual({ type: "NONE" });
    expect(parseFloatingVoiceCommand("")).toEqual({ type: "NONE" });
    expect(parseFloatingVoiceCommand("   ")).toEqual({ type: "NONE" });
  });

  it("prefiere agenda sobre pacientes cuando ambos aparecen", () => {
    const r = parseFloatingVoiceCommand("citas de pacientes de mañana");
    expect(r.type === "NAVIGATE" && r.path).toBe("/clinical/agenda");
  });

  it("'agendar' tiene prioridad sobre 'citas'", () => {
    const r = parseFloatingVoiceCommand("agendar cita pendiente");
    expect(r.type === "NAVIGATE" && r.path).toBe("/clinical/agenda?new=1");
  });

  it("'agenda cita' (imperativo) abre el modal de nueva cita", () => {
    expect(parseFloatingVoiceCommand("agenda cita")).toEqual({
      type: "NAVIGATE",
      path: "/clinical/agenda?new=1",
      message: "Abriendo nueva cita",
    });
    expect(parseFloatingVoiceCommand("agenda una cita").path).toBe(
      "/clinical/agenda?new=1",
    );
    expect(parseFloatingVoiceCommand("agenda la cita").path).toBe(
      "/clinical/agenda?new=1",
    );
  });

  it("plurales/posesivos con 'agenda' siguen abriendo la agenda normal", () => {
    expect(parseFloatingVoiceCommand("agenda mis citas").path).toBe(
      "/clinical/agenda",
    );
    expect(parseFloatingVoiceCommand("agenda citas pendientes").path).toBe(
      "/clinical/agenda?status=SCHEDULED",
    );
    expect(parseFloatingVoiceCommand("abrir la agenda de citas").path).toBe(
      "/clinical/agenda",
    );
  });
});

describe("wantsCreateNote / wantsPatientSummary (comandos profundos)", () => {
  it("detecta comando explícito de nota por voz", () => {
    expect(wantsCreateNote("anota en la historia de PAC-001 que presenta fiebre")).toBe(
      true,
    );
    expect(wantsCreateNote("crea una nota para Ana Paredes")).toBe(true);
    expect(wantsCreateNote("registra que el paciente refiere náuseas")).toBe(true);
  });

  it("no confunde dictado clínico ni consultas de resumen con nota", () => {
    expect(wantsCreateNote("paciente refiere cefalea")).toBe(false);
    expect(wantsCreateNote("dame el resumen de Ana Paredes")).toBe(false);
    expect(wantsCreateNote("")).toBe(false);
  });

  it("detecta consulta explícita de resumen con paciente citado", () => {
    expect(wantsPatientSummary("dame el resumen de Ana Paredes")).toBe(true);
    expect(wantsPatientSummary("DoctorIA, dame el resumen de María Torres")).toBe(true);
    expect(wantsPatientSummary("resumen de PAC-001")).toBe(true);
    expect(wantsPatientSummary("dame la ficha de Andrés Núñez")).toBe(true);
  });

  it("no secuestra dictado genérico ni comandos de nota", () => {
    expect(wantsPatientSummary("paciente refiere cefalea")).toBe(false);
    expect(wantsPatientSummary("anota en la historia de PAC-001 que hay fiebre")).toBe(
      false,
    );
    expect(wantsPatientSummary("")).toBe(false);
  });
});
