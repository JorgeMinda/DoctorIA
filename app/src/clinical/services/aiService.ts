// Servicio de IA — contrato tipado desacoplado del proveedor (research R-03, clinical-operations.md §6).
// En desarrollo se usa un MOCK determinista. El proveedor real reemplaza este mock cuando se
// apruebe la decisión PD-01. La IA es EXCLUSIVAMENTE asistiva: organiza texto, nunca decide (P4).

export type AIMode = "NOTE" | "EPICRISIS";

export interface AIStructuringInput {
  text: string;
  mode: AIMode;
}

export interface AIStructuringOutput {
  sections: {
    motivoConsulta: string | null;
    notaClinica: string | null;
    examenFisico: string | null;
    valoracionClinica: string | null;
    planIndicaciones: string | null;
  };
  unclassifiedContent: string | null;
  originalTextPreserved: boolean; // DEBE ser siempre true (RNF-004)
  confidence: number; // 0-1
}

export interface AIEpicrisisOutput {
  elements: {
    reasonForAdmission: string | null;
    relevantHistory: string | null;
    evolutionSummary: string | null;
    proceduresResults: string | null;
    validatedDiagnoses: string | null;
    conditionAtDischarge: string | null;
    followUpInstructions: string | null;
  };
  unclassifiedContent: string | null;
}

export type AIServiceError =
  | { type: "TIMEOUT"; message: string }
  | { type: "UNAVAILABLE"; message: string }
  | { type: "PARSE_ERROR"; message: string };

const AI_TIMEOUT_MS = 30_000; // RNF-011

// Mock determinista: estructura el texto por heurística simple de párrafos/señales.
// Con esto el MVP es testeable E2E sin proveedor real (PD-01 pendiente).
export async function structureClinicalText(
  input: AIStructuringInput,
): Promise<AIStructuringOutput> {
  await simulateLatency();
  return mockStructure(input.text);
}

export async function generateEpicrisisFromHistory(
  originalTexts: string[],
): Promise<AIEpicrisisOutput> {
  await simulateLatency();
  return mockEpicrisis(originalTexts);
}

async function simulateLatency(): Promise<void> {
  // Latencia determinista (~600ms) para observar el indicador de procesamiento sin exceder P95.
  await new Promise((resolve) => setTimeout(resolve, 600));
}

function mockStructure(text: string): AIStructuringOutput {
  const clean = text.trim();
  const paragraphs = clean
    .split(/\n{2,}|(?=(?:Motivo|Paciente|Examen|Valoraci|Plan|Diagn|Tratamiento|Indicaciones|Antecedentes)[:\s])/i)
    .map((p) => p.trim())
    .filter(Boolean);

  const get = (patterns: RegExp[]): string | null => {
    const match = paragraphs.find((p) => patterns.some((re) => re.test(p)));
    return match ?? null;
  };

  const motivo = get([/^motivo/i, /consulta por|acude por|refiere/i]);
  const exam = get([/^examen/i, /^ef[: ]/i, /tensión|presión arterial|ta:|fr:|fc:|temperatura/i]);
  const valor = get([/^valoraci/i, /^impresi|^diagnóstico/i, /correlacionar|sugerir|interpret/i]);
  const plan = get([/^plan/i, /^tratamiento/i, /^indicaciones/i, /paracetamol|ibuprofeno|indicar/i]);
  const nota = paragraphs.filter((p) => p !== motivo && p !== exam && p !== valor && p !== plan);

  const notaClinica =
    nota.length > 0
      ? nota.join("\n\n")
      : clean.length > 200
        ? clean.slice(0, Math.floor(clean.length / 2))
        : null;

  const classified = [motivo, notaClinica, exam, valor, plan].filter(Boolean);
  const unclassified =
    classified.length === 0 ? clean : null;

  return {
    sections: {
      motivoConsulta: motivo ?? null,
      notaClinica,
      examenFisico: exam ?? null,
      valoracionClinica: valor ?? null,
      planIndicaciones: plan ?? null,
    },
    unclassifiedContent: unclassified,
    originalTextPreserved: true,
    confidence: classified.length >= 3 ? 0.9 : 0.6,
  };
}

function mockEpicrisis(originalTexts: string[]): AIEpicrisisOutput {
  const combined = originalTexts.join(" ").slice(0, 1200);

  const diagnoses = /(diagn[oó]stico|dx|diabetes|hipertensi[oó]n)/i.test(combined)
    ? combined.match(/[^.]*(diabetes|hipertensi[oó]n)[^.]*\.?/i)?.[0]?.trim() ?? null
    : null;

  return {
    elements: {
      reasonForAdmission: "Atención de control clínico (motivo de ingreso según historial)",
      relevantHistory: combined ? combined.slice(0, 300) : null,
      evolutionSummary: combined ? combined.slice(0, 400) : null,
      proceduresResults: null,
      validatedDiagnoses: diagnoses,
      conditionAtDischarge: null,
      followUpInstructions: "Continuar tratamiento indicado y acudir a control según evolución",
    },
    unclassifiedContent: null,
  };
}
