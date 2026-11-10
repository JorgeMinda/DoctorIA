import { describe, expect, it } from "vitest";
import {
  CAPTURE_FIELDS,
  applyCaptureAnswer,
  initialCaptureState,
  isAffirmative,
  isCancelCommand,
  isFinishCommand,
  isNegative,
  isSkipCommand,
  normalizeCaptureTranscript,
  normalizeNumberWords,
  transition,
  type CaptureEffect,
  type CaptureEvent,
  type CaptureState,
} from "../../src/client/voice/captureFsm";

const run = (state: CaptureState, ...events: CaptureEvent[]) =>
  events.reduce(
    (acc, ev) => transition(acc.state, ev),
    { state, effects: [] as CaptureEffect[] },
  );

describe("CAPTURE_FIELDS (guion Formulario 002)", () => {
  it("tiene 6 campos en el orden del formulario", () => {
    expect(CAPTURE_FIELDS.map((f) => f.id)).toEqual([
      "motivo",
      "antecedentes",
      "enfermedadActual",
      "examenFisico",
      "diagnostico",
      "plan",
    ]);
  });

  it("mapea a secciones SOAP válidas con prefijos donde corresponde", () => {
    const sections = new Set([
      "motivoConsulta",
      "notaClinica",
      "examenFisico",
      "valoracionClinica",
      "planIndicaciones",
    ]);
    for (const field of CAPTURE_FIELDS) {
      expect(sections.has(field.section)).toBe(true);
      expect(field.prompt.length).toBeGreaterThan(0);
      expect(field.label.length).toBeGreaterThan(0);
    }
    expect(
      CAPTURE_FIELDS.find((f) => f.id === "antecedentes")?.prefix,
    ).toBe("Antecedentes");
    expect(
      CAPTURE_FIELDS.find((f) => f.id === "enfermedadActual")?.prefix,
    ).toBe("Enfermedad actual");
    expect(
      CAPTURE_FIELDS.find((f) => f.id === "motivo")?.prefix,
    ).toBeUndefined();
  });
});

describe("flujo feliz de captura guiada", () => {
  const CONTENTS = [
    "Dolor abdominal",
    "Hipertensión desde 2019",
    "Dolor abdominal de 2 días",
    "Abdomen blando doloroso",
    "Apendicitis aguda",
    "Cirugía y antibióticos",
  ];

  it("recorre los 6 campos con eco, confirmación y COMMIT por campo", () => {
    let r = transition(initialCaptureState(), { type: "START" });
    expect(r.state.step).toBe("ASK");
    expect(r.state.fieldIndex).toBe(0);
    expect(r.effects).toEqual([
      { type: "LISTEN_OFF" },
      { type: "SPEAK", text: CAPTURE_FIELDS[0].prompt },
    ]);

    const commits: CaptureEffect[] = [];
    for (const content of CONTENTS) {
      r = transition(r.state, { type: "TTS_DONE" });
      expect(r.state.step).toBe("LISTEN");
      expect(r.effects).toEqual([{ type: "LISTEN_ON" }]);

      r = transition(r.state, { type: "TRANSCRIPT", text: content });
      expect(r.state.step).toBe("CONFIRM");
      expect(r.state.captured).toBe(content);
      expect(r.effects[0]).toEqual({ type: "LISTEN_OFF" });
      expect(r.effects[1]).toEqual({
        type: "SPEAK",
        text: `Entendí ${content}. ¿Correcto?`,
      });

      r = transition(r.state, { type: "TTS_DONE" });
      expect(r.effects).toEqual([{ type: "LISTEN_ON" }]);

      r = transition(r.state, { type: "TRANSCRIPT", text: "sí" });
      commits.push(...r.effects.filter((e) => e.type === "COMMIT"));
    }

    expect(r.state.step).toBe("DONE");
    expect(Object.keys(r.state.answers)).toHaveLength(6);
    expect(commits).toHaveLength(6);
    expect(commits.map((c) => (c as any).fieldId)).toEqual([
      "motivo",
      "antecedentes",
      "enfermedadActual",
      "examenFisico",
      "diagnostico",
      "plan",
    ]);
    expect(commits.map((c) => (c as any).section)).toEqual([
      "motivoConsulta",
      "notaClinica",
      "notaClinica",
      "examenFisico",
      "valoracionClinica",
      "planIndicaciones",
    ]);
    expect(r.effects[r.effects.length - 1]).toEqual({
      type: "FINISHED",
      answers: r.state.answers,
    });
  });
});

describe("corrección y re-confirmación", () => {
  const toConfirm = (text: string) =>
    run(
      initialCaptureState(),
      { type: "START" },
      { type: "TTS_DONE" },
      { type: "TRANSCRIPT", text },
      { type: "TTS_DONE" },
    );

  it("'no' vuelve a escuchar el mismo campo sin COMMIT", () => {
    const r = toConfirm("dolor abdominal");
    expect(r.state.step).toBe("CONFIRM");
    const after = transition(r.state, { type: "TRANSCRIPT", text: "no" });
    expect(after.state.step).toBe("LISTEN");
    expect(after.state.fieldIndex).toBe(0);
    expect(after.state.captured).toBeNull();
    expect(after.effects[0]).toEqual({ type: "LISTEN_OFF" });
    expect(after.effects[1]).toEqual({
      type: "SPEAK",
      text: "Vale. Repite motivo de consulta.",
    });
    expect(after.effects.some((e) => e.type === "COMMIT")).toBe(false);
  });

  it("un valor nuevo en CONFIRM reemplaza el anterior y re-eco", () => {
    const r = toConfirm("dolor");
    const after = transition(r.state, { type: "TRANSCRIPT", text: "dolor abdominal intenso" });
    expect(after.state.step).toBe("CONFIRM");
    expect(after.state.captured).toBe("dolor abdominal intenso");
    expect(after.effects[1]).toEqual({
      type: "SPEAK",
      text: "Entendí dolor abdominal intenso. ¿Correcto?",
    });
  });

  it("CONFIRM_YES / CONFIRM_NO también funcionan como eventos directos", () => {
    const r = toConfirm("fiebre");
    const yes = transition(r.state, { type: "CONFIRM_YES" });
    expect(yes.state.step).toBe("ASK");
    expect(yes.state.fieldIndex).toBe(1);
    expect(yes.effects.some((e) => e.type === "COMMIT")).toBe(true);

    const no = transition(r.state, { type: "CONFIRM_NO" });
    expect(no.state.step).toBe("LISTEN");
    expect(no.state.captured).toBeNull();
  });
});

describe("comandos de control y anti-falsos-positivos", () => {
  const toListen = () =>
    run(initialCaptureState(), { type: "START" }, { type: "TTS_DONE" });

  it("en LISTEN, 'sí' y 'no' se tratan como CONTENIDO (no como confirmación)", () => {
    const yes = transition(toListen().state, { type: "TRANSCRIPT", text: "sí" });
    expect(yes.state.step).toBe("CONFIRM");
    expect(yes.state.captured).toBe("sí");

    const no = transition(toListen().state, { type: "TRANSCRIPT", text: "no" });
    expect(no.state.step).toBe("CONFIRM");
    expect(no.state.captured).toBe("no");
  });

  it("'omitir' avanza sin guardar el campo", () => {
    const r = transition(toListen().state, { type: "TRANSCRIPT", text: "omitir" });
    expect(r.state.step).toBe("ASK");
    expect(r.state.fieldIndex).toBe(1);
    expect(r.effects.some((e) => e.type === "COMMIT")).toBe(false);
    expect(r.effects[r.effects.length - 1]).toEqual({
      type: "SPEAK",
      text: CAPTURE_FIELDS[1].prompt,
    });
  });

  it("'cancelar' aborta desde LISTEN y desde CONFIRM", () => {
    const fromListen = transition(toListen().state, {
      type: "TRANSCRIPT",
      text: "Cancelar",
    });
    expect(fromListen.state.step).toBe("CANCELLED");
    expect(fromListen.effects.some((e) => e.type === "CANCELLED")).toBe(true);
    expect(fromListen.effects[0]).toEqual({ type: "LISTEN_OFF" });

    const confirmed = run(
      toListen().state,
      { type: "TRANSCRIPT", text: "dolor" },
    );
    const fromEvent = transition(confirmed.state, { type: "CANCEL" });
    expect(fromEvent.state.step).toBe("CANCELLED");
    expect(fromEvent.effects.some((e) => e.type === "CANCELLED")).toBe(true);
  });

  it("'terminar' finaliza parcialmente con los answers acumulados", () => {
    const partial = run(
      toListen().state,
      { type: "TRANSCRIPT", text: "dolor abdominal" },
      { type: "CONFIRM_YES" },
      { type: "TTS_DONE" },
      { type: "TRANSCRIPT", text: "terminar" },
    );
    expect(partial.state.step).toBe("DONE");
    const finished = partial.effects.find((e) => e.type === "FINISHED") as any;
    expect(finished.answers).toEqual({ motivo: "dolor abdominal" });
    expect(partial.effects.some((e) => e.type === "COMMIT")).toBe(false);
  });

  it("START se ignora mientras la captura está activa", () => {
    const active = toListen();
    const r = transition(active.state, { type: "START" });
    expect(r.state).toBe(active.state);
    expect(r.effects).toEqual([]);
  });

  it("TTS_DONE en LISTEN reabre el micrófono de forma idempotente", () => {
    const active = toListen();
    expect(active.state.step).toBe("LISTEN");
    const r = transition(active.state, { type: "TTS_DONE" });
    expect(r.state.step).toBe("LISTEN");
    expect(r.effects).toEqual([{ type: "LISTEN_ON" }]);
  });

  it("transcripción vacía se ignora", () => {
    const r = transition(toListen().state, { type: "TRANSCRIPT", text: "   " });
    expect(r.effects).toEqual([]);
    expect(r.state.step).toBe("LISTEN");
  });

  it("eventos en IDLE/DONE/CANCELLED no producen efectos", () => {
    for (const step of ["IDLE", "DONE", "CANCELLED"] as const) {
      const state: CaptureState = { step, fieldIndex: 0, captured: null, answers: {} };
      expect(transition(state, { type: "TTS_DONE" }).effects).toEqual([]);
      expect(transition(state, { type: "TRANSCRIPT", text: "hola" }).effects).toEqual([]);
      expect(transition(state, { type: "SKIP" }).effects).toEqual([]);
    }
  });
});

describe("parser local de comandos", () => {
  it("afirmativas con variantes, mayúsculas y acentos", () => {
    for (const t of ["sí", "SÍ", "si", "correcto", "Exacto", "está bien", "de acuerdo", "ok", "vale"]) {
      expect(isAffirmative(t), t).toBe(true);
    }
    for (const t of ["dolor abdominal", "siempre", "no"]) {
      expect(isAffirmative(t), t).toBe(false);
    }
  });

  it("negativas", () => {
    for (const t of ["no", "No", "corregir", "otra vez", "equivocado"]) {
      expect(isNegative(t), t).toBe(true);
    }
    expect(isNegative("dolor abdominal")).toBe(false);
  });

  it("omitir / cancelar / terminar", () => {
    for (const t of ["omitir", "no aplica", "siguiente"]) {
      expect(isSkipCommand(t), t).toBe(true);
    }
    for (const t of ["cancelar", "CANCELAR", "salir", "abortar"]) {
      expect(isCancelCommand(t), t).toBe(true);
    }
    for (const t of ["terminar", "basta", "finalizar"]) {
      expect(isFinishCommand(t), t).toBe(true);
    }
    expect(isCancelCommand("dolor abdominal")).toBe(false);
    expect(isSkipCommand("omito mucho")).toBe(false);
  });
});

describe("normalizeCaptureTranscript", () => {
  it("aplica puntuación hablada y colapsa espacios", () => {
    expect(normalizeCaptureTranscript("  fiebre   punto y coma tos ")).toBe(
      "fiebre; tos",
    );
    expect(normalizeCaptureTranscript("dolor abdominal")).toBe("dolor abdominal");
  });
});

describe("normalizeNumberWords (reservado fase 2 vitales)", () => {
  it("convierte números en palabras a dígitos", () => {
    expect(normalizeNumberWords("cuarenta y cinco")).toBe("45");
    expect(normalizeNumberWords("veinte y uno")).toBe("21");
    expect(normalizeNumberWords("ciento veinte")).toBe("120");
    expect(normalizeNumberWords("noventa")).toBe("90");
  });

  it("no altera prosa sin números en palabras", () => {
    expect(normalizeNumberWords("dolor abdominal")).toBe("dolor abdominal");
  });
});

describe("applyCaptureAnswer (anexo a secciones, RNF-004)", () => {
  const motivo = CAPTURE_FIELDS[0];
  const antecedentes = CAPTURE_FIELDS[1];

  it("sección vacía sin prefijo → texto tal cual", () => {
    expect(applyCaptureAnswer("", motivo, "Dolor abdominal")).toBe(
      "Dolor abdominal",
    );
    expect(applyCaptureAnswer(undefined, motivo, "Dolor abdominal")).toBe(
      "Dolor abdominal",
    );
  });

  it("sección vacía con prefijo → 'Antecedentes: …'", () => {
    expect(applyCaptureAnswer("", antecedentes, "HTA desde 2019")).toBe(
      "Antecedentes: HTA desde 2019",
    );
  });

  it("sección existente → anexa en nueva línea", () => {
    expect(
      applyCaptureAnswer("Nota previa.", antecedentes, "HTA desde 2019"),
    ).toBe("Nota previa.\nAntecedentes: HTA desde 2019");
  });

  it("recorta espacios finales del valor actual", () => {
    expect(applyCaptureAnswer("Nota previa.   ", motivo, "Fiebre")).toBe(
      "Nota previa.\nFiebre",
    );
  });
});
