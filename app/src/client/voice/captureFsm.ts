// FSM pura de captura guiada (Formulario 002 MSP → secciones SOAP).
// Sin DOM ni React: las transiciones son testeables en
// tests/unit/captureFsm.test.ts. El host (ClinicalNotePage) aplica los
// efectos: TTS (tts.service), micrófono (SpeechRecognition) y persistDraft.
//
// Diseño preparado para fase 2 (signos vitales §5): agregar un CaptureFieldDef
// nuevo con destino "vitalSigns" no requiere rehacer la FSM — solo el host
// debe enrutar ese COMMIT a createVitalSignAction en vez de persistDraft.

import { formatDictation } from "./floatingVoice";

export type CaptureSectionKey =
  | "motivoConsulta"
  | "notaClinica"
  | "examenFisico"
  | "valoracionClinica"
  | "planIndicaciones";

export type CaptureFieldId =
  | "motivo"
  | "antecedentes"
  | "enfermedadActual"
  | "examenFisico"
  | "diagnostico"
  | "plan"
  // Fase 2 (§5 signos vitales) — reservado, fuera del MVP:
  | "signosVitales";

export interface CaptureFieldDef {
  id: CaptureFieldId;
  label: string;
  prompt: string;
  section: CaptureSectionKey;
  // Prefijo del bloque al anexarlo a la sección ("Antecedentes: …").
  prefix?: string;
}

// Guion = Formulario 002 MSP (Consulta Externa: Anamnesis y Examen Físico).
// Orden idéntico al formulario; §1 (filiación) no se captura porque ya vive
// en la ficha del paciente.
export const CAPTURE_FIELDS: CaptureFieldDef[] = [
  {
    id: "motivo",
    label: "Motivo de consulta",
    prompt: "¿Cuál es el motivo de consulta?",
    section: "motivoConsulta",
  },
  {
    id: "antecedentes",
    label: "Antecedentes",
    prompt: "¿Antecedentes personales y familiares relevantes?",
    section: "notaClinica",
    prefix: "Antecedentes",
  },
  {
    id: "enfermedadActual",
    label: "Enfermedad actual",
    prompt: "¿Enfermedad o problema actual? Cronología, localización e intensidad.",
    section: "notaClinica",
    prefix: "Enfermedad actual",
  },
  {
    id: "examenFisico",
    label: "Examen físico",
    prompt: "¿Hallazgos del examen físico?",
    section: "examenFisico",
  },
  {
    id: "diagnostico",
    label: "Diagnóstico",
    prompt: "¿Diagnóstico o impresión diagnóstica?",
    section: "valoracionClinica",
  },
  {
    id: "plan",
    label: "Plan de tratamiento",
    prompt: "¿Plan de tratamiento y recomendaciones?",
    section: "planIndicaciones",
  },
];

export type CaptureStep =
  | "IDLE"
  | "ASK"
  | "LISTEN"
  | "CONFIRM"
  | "DONE"
  | "CANCELLED";

export interface CaptureState {
  step: CaptureStep;
  fieldIndex: number;
  captured: string | null;
  answers: Partial<Record<CaptureFieldId, string>>;
}

export type CaptureEvent =
  | { type: "START" }
  | { type: "TTS_DONE" }
  | { type: "TRANSCRIPT"; text: string }
  | { type: "CONFIRM_YES" }
  | { type: "CONFIRM_NO" }
  | { type: "SKIP" }
  | { type: "CANCEL" }
  | { type: "FINISH" };

export type CaptureEffect =
  | { type: "SPEAK"; text: string }
  | { type: "LISTEN_ON" }
  | { type: "LISTEN_OFF" }
  | {
      type: "COMMIT";
      fieldId: CaptureFieldId;
      section: CaptureSectionKey;
      text: string;
    }
  | {
      type: "FINISHED";
      answers: Partial<Record<CaptureFieldId, string>>;
    }
  | { type: "CANCELLED" };

export interface CaptureResult {
  state: CaptureState;
  effects: CaptureEffect[];
}

export function initialCaptureState(): CaptureState {
  return { step: "IDLE", fieldIndex: 0, captured: null, answers: {} };
}

// ---------------------------------------------------------------------------
// Parser local (sin IA): comandos de control y normalización de transcripción
// ---------------------------------------------------------------------------

const stripForMatch = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,!?;:]+$/g, "")
    .trim();

export function normalizeCaptureTranscript(raw: string): string {
  return formatDictation(raw).replace(/\s+/g, " ").trim();
}

export function isAffirmative(text: string): boolean {
  return /^(si|s|correcto|correcta|exacto|exacta|aceptar|acepto|de acuerdo|vale|ok|esta bien|asi es|adelante|seguro)$/.test(
    stripForMatch(text),
  );
}

export function isNegative(text: string): boolean {
  return /^(no|corregir|corrige|incorrecto|incorrecta|equivocado|mal|repetir|otra vez|no es|para nada)$/.test(
    stripForMatch(text),
  );
}

export function isSkipCommand(text: string): boolean {
  return /^(omitir|omite|saltar|salta|siguiente|no aplica|no aplican|no corresponde)$/.test(
    stripForMatch(text),
  );
}

export function isCancelCommand(text: string): boolean {
  return /^(cancelar|cancela|abortar|aborta|salir|detener|deten|parar)$/.test(
    stripForMatch(text),
  );
}

export function isFinishCommand(text: string): boolean {
  return /^(terminar|termina|finalizar|finaliza|fin|basta)$/.test(
    stripForMatch(text),
  );
}

// Normalizador de números en palabras — reservado para campos estructurados
// (fase 2: signos vitales "ciento veinte" → 120). No se aplica a prosa libre.
const NUMBER_WORDS: Record<string, number> = {
  cero: 0, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50,
  sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100,
  ciento: 100, mil: 1000,
};

export function normalizeNumberWords(text: string): string {
  const joined = stripForMatch(text)
    .split(/\s+/)
    .map((token) => {
      if (token in NUMBER_WORDS) return String(NUMBER_WORDS[token]);
      return token;
    })
    .join(" ");
  return joined
    .replace(/\b(\d+)\s*y\s*(\d+)\b/g, (_m, a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      return na < 100 && nb < 100 && na % 10 === 0 && na > 0
        ? String(na + nb)
        : `${na} y ${nb}`;
    })
    // "ciento veinte" → 100 20 → 120 (tens/units después de 100).
    .replace(/\b100\s+(\d{1,2})\b/g, (_m, n) => String(100 + parseInt(n, 10)));
}

// ---------------------------------------------------------------------------
// Anexado de respuestas a secciones (RNF-004: solo se tocan secciones)
// ---------------------------------------------------------------------------

export function applyCaptureAnswer(
  current: string | null | undefined,
  field: CaptureFieldDef,
  text: string,
): string {
  const clean = text.trim();
  const block = field.prefix ? `${field.prefix}: ${clean}` : clean;
  if (!current?.trim()) return block;
  return `${current.replace(/\s+$/, "")}\n${block}`;
}

// ---------------------------------------------------------------------------
// Transiciones
// ---------------------------------------------------------------------------

function speak(text: string): CaptureEffect {
  return { type: "SPEAK", text };
}

function askPrompt(
  answers: Partial<Record<CaptureFieldId, string>>,
  fieldIndex: number,
): CaptureResult {
  return {
    state: { step: "ASK", fieldIndex, captured: null, answers },
    effects: [{ type: "LISTEN_OFF" }, speak(CAPTURE_FIELDS[fieldIndex].prompt)],
  };
}

function cancelled(): CaptureResult {
  return {
    state: { step: "CANCELLED", fieldIndex: 0, captured: null, answers: {} },
    effects: [
      { type: "LISTEN_OFF" },
      speak("Captura cancelada."),
      { type: "CANCELLED" },
    ],
  };
}

function finished(state: CaptureState): CaptureResult {
  return {
    state: { ...state, step: "DONE", captured: null },
    effects: [
      { type: "LISTEN_OFF" },
      speak("Captura finalizada."),
      { type: "FINISHED", answers: state.answers },
    ],
  };
}

function advance(
  state: CaptureState,
  commit: boolean,
): CaptureResult {
  const field = CAPTURE_FIELDS[state.fieldIndex];
  let answers = state.answers;
  const effects: CaptureEffect[] = [{ type: "LISTEN_OFF" }];

  if (commit && state.captured) {
    answers = { ...answers, [field.id]: state.captured };
    effects.push({
      type: "COMMIT",
      fieldId: field.id,
      section: field.section,
      text: state.captured,
    });
  }

  const nextIndex = state.fieldIndex + 1;
  if (nextIndex >= CAPTURE_FIELDS.length) {
    return {
      state: { step: "DONE", fieldIndex: state.fieldIndex, captured: null, answers },
      effects: [...effects, speak("Captura completada."), { type: "FINISHED", answers }],
    };
  }
  return {
    state: { step: "ASK", fieldIndex: nextIndex, captured: null, answers },
    effects: [...effects, speak(CAPTURE_FIELDS[nextIndex].prompt)],
  };
}

function echo(captured: string): string {
  return `Entendí ${captured}. ¿Correcto?`;
}

export function transition(
  state: CaptureState,
  event: CaptureEvent,
): CaptureResult {
  const ignore: CaptureResult = { state, effects: [] };

  if (event.type === "START") {
    if (state.step !== "IDLE" && state.step !== "DONE" && state.step !== "CANCELLED") {
      return ignore;
    }
    return askPrompt({}, 0);
  }

  if (state.step === "IDLE" || state.step === "DONE" || state.step === "CANCELLED") {
    return ignore;
  }

  if (event.type === "CANCEL") return cancelled();
  if (event.type === "FINISH") return finished(state);

  if (event.type === "SKIP") {
    if (state.step === "LISTEN" || state.step === "CONFIRM") {
      return advance(state, false);
    }
    return ignore;
  }

  if (event.type === "TTS_DONE") {
    // Tras hablar (pregunta o eco) el micrófono se abre para la respuesta.
    // ASK → LISTEN: la pregunta terminó, ahora se escucha. En LISTEN y
    // CONFIRM se re-emite LISTEN_ON (idempotente en el host: si el mic ya
    // está corriendo no se reinicia).
    if (state.step === "ASK") {
      return {
        state: { ...state, step: "LISTEN" },
        effects: [{ type: "LISTEN_ON" }],
      };
    }
    if (state.step === "CONFIRM" || state.step === "LISTEN") {
      return { state, effects: [{ type: "LISTEN_ON" }] };
    }
    return ignore;
  }

  if (event.type === "CONFIRM_YES") {
    if (state.step === "CONFIRM") return advance(state, true);
    return ignore;
  }

  if (event.type === "CONFIRM_NO") {
    if (state.step === "CONFIRM") {
      const field = CAPTURE_FIELDS[state.fieldIndex];
      return {
        state: { ...state, step: "LISTEN", captured: null },
        effects: [
          { type: "LISTEN_OFF" },
          speak(`Vale. Repite ${field.label.toLowerCase()}.`),
        ],
      };
    }
    return ignore;
  }

  if (event.type === "TRANSCRIPT") {
    const text = normalizeCaptureTranscript(event.text);
    if (!text) return ignore;

    // Comandos de control en cualquier estado activo.
    if (isCancelCommand(text)) return cancelled();
    if (isFinishCommand(text)) return finished(state);
    if (
      (state.step === "LISTEN" || state.step === "CONFIRM") &&
      isSkipCommand(text)
    ) {
      return advance(state, false);
    }

    if (state.step === "ASK") return ignore;

    if (state.step === "LISTEN") {
      return {
        state: { ...state, step: "CONFIRM", captured: text },
        effects: [{ type: "LISTEN_OFF" }, speak(echo(text))],
      };
    }

    // step === "CONFIRM"
    if (isAffirmative(text)) return advance(state, true);
    if (isNegative(text)) {
      const field = CAPTURE_FIELDS[state.fieldIndex];
      return {
        state: { ...state, step: "LISTEN", captured: null },
        effects: [
          { type: "LISTEN_OFF" },
          speak(`Vale. Repite ${field.label.toLowerCase()}.`),
        ],
      };
    }
    // Valor nuevo en plena confirmación: reemplaza y se re-confirma con eco.
    return {
      state: { ...state, step: "CONFIRM", captured: text },
      effects: [{ type: "LISTEN_OFF" }, speak(echo(text))],
    };
  }

  return ignore;
}
