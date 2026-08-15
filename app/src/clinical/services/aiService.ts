// Servicio de IA — contrato tipado desacoplado del proveedor (research R-03, clinical-operations.md §6).
// Implementado llamando directamente a la API REST de Gemini con Structured Outputs (PD-01 resuelto).
// La IA es EXCLUSIVAMENTE asistiva: organiza texto, nunca decide (Constitución P4).

import { env } from "wasp/server";

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

const AI_TIMEOUT_MS = 30_000; // RNF-011

// Esquema estructurado de salida de nota clínica para Gemini
const CLINICAL_NOTE_SCHEMA = {
  type: "OBJECT",
  properties: {
    sections: {
      type: "OBJECT",
      properties: {
        motivoConsulta: { type: "STRING", description: "Motivo de la consulta médica." },
        notaClinica: { type: "STRING", description: "Subjetivo, anamnesis, historia de la enfermedad actual, antecedentes." },
        examenFisico: { type: "STRING", description: "Signos vitales y hallazgos del examen físico." },
        valoracionClinica: { type: "STRING", description: "Diagnósticos sospechados o confirmados, juicio clínico." },
        planIndicaciones: { type: "STRING", description: "Tratamiento, dosis, laboratorios solicitados, recomendaciones." }
      },
      required: ["motivoConsulta", "notaClinica", "examenFisico", "valoracionClinica", "planIndicaciones"]
    },
    unclassifiedContent: { type: "STRING", description: "Cualquier texto que no calce en las secciones anteriores o requiera revisión." },
    originalTextPreserved: { type: "BOOLEAN", description: "Debe ser true siempre si la información del texto original fue preservada." },
    confidence: { type: "NUMBER", description: "Nivel de confianza de 0.0 a 1.0 en la estructuración." }
  },
  required: ["sections", "originalTextPreserved", "confidence"]
};

// Esquema estructurado de salida de epicrisis para Gemini
const EPICRISIS_SCHEMA = {
  type: "OBJECT",
  properties: {
    elements: {
      type: "OBJECT",
      properties: {
        reasonForAdmission: { type: "STRING", description: "Motivo de ingreso o de atención." },
        relevantHistory: { type: "STRING", description: "Antecedentes de relevancia para este caso." },
        evolutionSummary: { type: "STRING", description: "Resumen del curso clínico y la evolución en el tiempo." },
        proceduresResults: { type: "STRING", description: "Procedimientos realizados y resultados relevantes de exámenes." },
        validatedDiagnoses: { type: "STRING", description: "Diagnósticos de egreso validados clínicamente." },
        conditionAtDischarge: { type: "STRING", description: "Condición clínica del paciente al momento del alta." },
        followUpInstructions: { type: "STRING", description: "Instrucciones detalladas de seguimiento, citas y recetas." }
      },
      required: [
        "reasonForAdmission",
        "relevantHistory",
        "evolutionSummary",
        "proceduresResults",
        "validatedDiagnoses",
        "conditionAtDischarge",
        "followUpInstructions"
      ]
    },
    unclassifiedContent: { type: "STRING", description: "Información residual no clasificada." }
  },
  required: ["elements"]
};

// Helper genérico para llamar a Gemini con un prompt y un esquema estructurado (Structured Outputs)
async function callGeminiREST(prompt: string, schema: any): Promise<any> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no está configurada.");
  }

  // Se utiliza Gemini 1.5 Flash por su costo ultra-bajo, alta velocidad y soporte nativo de Structured Outputs
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`La API de Gemini retornó un código de error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error("Estructura de respuesta inválida o vacía de Gemini.");
    }

    return JSON.parse(candidateText);
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error(`Timeout al llamar al asistente de IA (${AI_TIMEOUT_MS / 1000}s superados).`);
    }
    throw new Error(error.message || "Error de red o de API al consultar el asistente de IA.");
  }
}

// Limpia las respuestas de Gemini mapeando cadenas vacías, nulas o "null" a null real de TypeScript
function cleanResponseString(val: any): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (s === "" || s.toLowerCase() === "null" || s.toLowerCase() === "n/a") return null;
  return s;
}

// Estructura el texto clínico libre
export async function structureClinicalText(
  input: AIStructuringInput,
): Promise<AIStructuringOutput> {
  const prompt = `Actúa como un asistente clínico inteligente de alta precisión para estructurar registros médicos.
Tu única tarea es estructurar el siguiente texto libre (en español) dictado o escrito por un médico en las 5 secciones clínicas correspondientes.

Reglas estrictas:
1. No inventes información clínica, diagnósticos ni prescripciones. Todo debe provenir del texto original.
2. Si para una sección no existe información correspondiente en el texto original, pon obligatoriamente una cadena vacía "".
3. Asegúrate de conservar intacta toda la información clínica del texto original (RNF-004).

Texto libre clínico a estructurar:
"${input.text}"`;

  const raw = await callGeminiREST(prompt, CLINICAL_NOTE_SCHEMA);

  return {
    sections: {
      motivoConsulta: cleanResponseString(raw.sections?.motivoConsulta),
      notaClinica: cleanResponseString(raw.sections?.notaClinica),
      examenFisico: cleanResponseString(raw.sections?.examenFisico),
      valoracionClinica: cleanResponseString(raw.sections?.valoracionClinica),
      planIndicaciones: cleanResponseString(raw.sections?.planIndicaciones),
    },
    unclassifiedContent: cleanResponseString(raw.unclassifiedContent),
    originalTextPreserved: raw.originalTextPreserved ?? true,
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0.8,
  };
}

// Genera una epicrisis a partir de los textos originales del historial clínico
export async function generateEpicrisisFromHistory(
  originalTexts: string[],
): Promise<AIEpicrisisOutput> {
  const notesSummary = originalTexts
    .map((t, idx) => `[Nota Clínica ${idx + 1}]:\n${t}`)
    .join("\n\n");

  const prompt = `Actúa como un asistente clínico experto encargado de redactar el borrador de una Epicrisis médica.
Sintetiza la información clínica contenida en las siguientes notas médicas para rellenar de forma coherente, cronológica y profesional las secciones de la epicrisis.

Reglas estrictas:
1. No inventes datos. Si en el historial clínico provisto no hay información suficiente para una sección específica, pon obligatoriamente una cadena vacía "".
2. Toda la información debe ser fiel al historial provisto.

Historial de notas del paciente:
${notesSummary}`;

  const raw = await callGeminiREST(prompt, EPICRISIS_SCHEMA);

  return {
    elements: {
      reasonForAdmission: cleanResponseString(raw.elements?.reasonForAdmission),
      relevantHistory: cleanResponseString(raw.elements?.relevantHistory),
      evolutionSummary: cleanResponseString(raw.elements?.evolutionSummary),
      proceduresResults: cleanResponseString(raw.elements?.proceduresResults),
      validatedDiagnoses: cleanResponseString(raw.elements?.validatedDiagnoses),
      conditionAtDischarge: cleanResponseString(raw.elements?.conditionAtDischarge),
      followUpInstructions: cleanResponseString(raw.elements?.followUpInstructions),
    },
    unclassifiedContent: cleanResponseString(raw.unclassifiedContent),
  };
}
