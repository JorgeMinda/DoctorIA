// AI service — provider-agnostic typed contract (research R-03, clinical-operations.md §6).
// Implemented via OpenRouter (OpenAI-compatible) using a free model with structured JSON output (PD-01).
// The AI is EXCLUSIVELY assistive: it organizes text, never decides (Constitution P4).
//
// FASE 2 (refactor conservador):
// - Llamada centralizada `callOpenRouter(messages)` con timeout 30s (RNF-011) y
//   reintentos 429/5xx respetando Retry-After (ya existentes, se mantienen).
// - Modelo configurable vía OPENROUTER_MODEL (validado en src/env.ts).
// - Validación Zod de la estructura de respuesta: si falla lanza
//   AIInvalidResponseError (code: "AI_INVALID_RESPONSE_ERROR").

import { env } from "wasp/server";
import { z } from "zod";

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

export interface AIAddendumOutput {
  sections: AIStructuringOutput["sections"];
  unclassifiedContent: string | null;
}

// Interfaz unificada del servicio de IA (Fase 2). Los métodos delegan en las
// funciones exportadas existentes para mantener compatibilidad con actions y tests.
export interface AIService {
  structureClinicalText(input: AIStructuringInput): Promise<AIStructuringOutput>;
  generateEpicrisisDraft(patientHistory: string[]): Promise<AIEpicrisisOutput>;
  generateAddendumDraft(
    originalDoc: string,
    instruction: string,
  ): Promise<AIAddendumOutput>;
}

const AI_TIMEOUT_MS = 25_000; // Presupuesto de tiempo seguro (< 45s acumulado) para evitar timeout 504 en Render (RNF-011)

// Maps empty/null/"null" strings to a real TypeScript null (RNF-004: original preserved as-is).
function cleanResponseString(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (s === "" || s.toLowerCase() === "null" || s.toLowerCase() === "n/a") return null;
  return s;
}

// ───────────────────────────── VALIDACIÓN ZOD ─────────────────────────────
// Estricta en la FORMA (debe existir `sections`/`elements` como objeto con sus
// claves conocidas), tolerante en valores individuales (clave ausente → null)
// para robustez ante variaciones del modelo en vivo.

const flexibleText = z.unknown().transform((v) => cleanResponseString(v));

const noteSectionsSchema = z.object({
  motivoConsulta: flexibleText,
  notaClinica: flexibleText,
  examenFisico: flexibleText,
  valoracionClinica: flexibleText,
  planIndicaciones: flexibleText,
});

const structuredNoteResponseSchema = z.object({
  sections: noteSectionsSchema,
  unclassifiedContent: flexibleText.optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const epicrisisElementsSchema = z.object({
  reasonForAdmission: flexibleText,
  relevantHistory: flexibleText,
  evolutionSummary: flexibleText,
  proceduresResults: flexibleText,
  validatedDiagnoses: flexibleText,
  conditionAtDischarge: flexibleText,
  followUpInstructions: flexibleText,
});

const epicrisisResponseSchema = z.object({
  elements: epicrisisElementsSchema,
  unclassifiedContent: flexibleText.optional(),
});

// Error controlado cuando la IA no devuelve la estructura esperada.
// La UI distingue este código del 409 de race condition sin parsear mensajes.
export class AIInvalidResponseError extends Error {
  readonly code = "AI_INVALID_RESPONSE_ERROR";
  constructor(detail?: string) {
    super(
      detail ??
        "La respuesta del asistente de IA no tuvo la estructura esperada.",
    );
    this.name = "AIInvalidResponseError";
  }
}

// Valida la respuesta cruda; registra solo rutas técnicas del fallo (sin PII).
function parseAIResponse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const paths = result.error.issues
      .map((i) => i.path.join("."))
      .filter(Boolean)
      .slice(0, 10);
    console.error(
      `[aiService] AI_INVALID_RESPONSE_ERROR — campos fuera de estructura: ${
        paths.length > 0 ? paths.join(", ") : "(estructura raíz inválida)"
      }`,
    );
    throw new AIInvalidResponseError();
  }
  return result.data;
}

// ─────────────────────────── TRANSPORTE OpenRouter ───────────────────────────

const SYSTEM_PROMPT =
  "Eres un asistente clínico de alta precisión que estructura registros médicos en JSON. " +
  "Nunca inventes información clínica. Responde SOLO con un objeto JSON válido, sin texto adicional.";

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

function buildMessages(userPrompt: string): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];
}

// Reintenta ante 429/5xx con backoff respetando Retry-After (resiliencia en producción con tope de tiempo total).
const AI_MAX_RETRIES = 1;

const FALLBACK_MODELS = [
 process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
];

async function callOpenRouterOnce(
  messages: ChatMessage[],
  modelName: string,
): Promise<any> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY no está configurada.");
  }

  const url = "https://openrouter.ai/api/v1/chat/completions";

  const body = {
    model: modelName,
    messages,
    response_format: { type: "json_object" },
    temperature: 0,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://doctoria.onrender.com",
        "X-Title": "DoctorIA",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      const retryable =
        response.status === 429 ||
        response.status >= 500 ||
        response.status === 404; // 404 permite probar el siguiente modelo fallback
      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterMs = retryAfterHeader
        ? Number(retryAfterHeader) * 1000
        : undefined;
      const err: any = new Error(
        `La API de OpenRouter retornó código ${response.status} para ${modelName}: ${errText}`,
      );
      err.status = response.status;
      err.retryable = retryable;
      err.retryAfterMs = Number.isFinite(retryAfterMs) ? retryAfterMs : undefined;
      throw err;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenRouter devolvió una respuesta vacía o inválida.");
    }

    try {
      return JSON.parse(content);
    } catch {
      throw new Error("OpenRouter no devolvió un JSON válido.");
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error(
        `Timeout al llamar al asistente de IA (${AI_TIMEOUT_MS / 1000}s superados).`,
      );
    }
    throw error;
  }
}

async function callOpenRouter(messages: ChatMessage[]): Promise<any> {
  const preferredModel =
    env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";
  const modelQueue = Array.from(
    new Set([preferredModel, ...FALLBACK_MODELS]),
  );

  let lastError: any;

  for (const model of modelQueue) {
    for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt++) {
      try {
        return await callOpenRouterOnce(messages, model);
      } catch (error: any) {
        lastError = error;
        // Si el modelo da 404 (modelo descontinuado/no disponible), pasar al siguiente modelo inmediatamente
        if (error?.status === 404) {
          console.warn(
            `[aiService] Modelo ${model} no disponible (404), probando fallback...`,
          );
          break;
        }
        if (error?.retryable && attempt < AI_MAX_RETRIES) {
          const base = error.retryAfterMs ?? 1000 * (attempt + 1);
          const wait = Math.min(base, 5000);
          await new Promise((resolve) => setTimeout(resolve, wait));
          continue;
        }
        break;
      }
    }
  }
  throw lastError;
}

// ───────────────────────────── OPERACIONES DE IA ─────────────────────────────

// Structures free clinical text into the 5 clinical sections.
export async function structureClinicalText(
  input: AIStructuringInput,
): Promise<AIStructuringOutput> {
  const prompt = `Estructura el siguiente texto libre (en español) dictado o escrito por un médico en las 5 secciones clínicas.
Devuelve EXACTAMENTE este objeto JSON (sin texto adicional):
{
  "sections": {
    "motivoConsulta": "",
    "notaClinica": "",
    "examenFisico": "",
    "valoracionClinica": "",
    "planIndicaciones": ""
  },
  "unclassifiedContent": null,
  "originalTextPreserved": true,
  "confidence": 0.9
}
Reglas estrictas:
1. No inventes información clínica, diagnósticos ni prescripciones. Todo debe provenir del texto original.
2. Si para una sección no existe información en el texto original, pon obligatoriamente "" (cadena vacía).
3. Conserva intacta toda la información clínica del texto original (RNF-004).
4. "originalTextPreserved" debe ser true.
5. "confidence" es un número de 0.0 a 1.0.

Texto libre clínico a estructurar:
"${input.text}"`;

  const raw = await callOpenRouter(buildMessages(prompt));
  const parsed = parseAIResponse(structuredNoteResponseSchema, raw);

  const sections = parsed.sections;

  // RNF-004: la IA puede descartar texto sin señal clínica; si no clasificó NADA,
  // preservamos el texto original íntegro en notaClinica (nunca se pierde contenido).
  const nothingClassified =
    Object.values(sections).every((v) => v === null) &&
    parsed.unclassifiedContent === null;
  if (nothingClassified) {
    sections.notaClinica = input.text;
  }

  return {
    sections,
    unclassifiedContent: parsed.unclassifiedContent ?? null,
    originalTextPreserved: true,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
  };
}

// Generates an epicrisis from the original texts of the clinical history.
export async function generateEpicrisisFromHistory(
  originalTexts: string[],
): Promise<AIEpicrisisOutput> {
  const notesSummary = originalTexts
    .map((t, idx) => `[Nota Clínica ${idx + 1}]:\n${t}`)
    .join("\n\n");

  const prompt = `Redacta el borrador de una Epicrisis médica sintetizando las notas provistas.
Devuelve EXACTAMENTE este objeto JSON (sin texto adicional):
{
  "elements": {
    "reasonForAdmission": "",
    "relevantHistory": "",
    "evolutionSummary": "",
    "proceduresResults": "",
    "validatedDiagnoses": "",
    "conditionAtDischarge": "",
    "followUpInstructions": ""
  },
  "unclassifiedContent": null
}
Reglas estrictas:
1. No inventes datos. Si no hay información suficiente para una sección, pon "" (cadena vacía).
2. Toda la información debe ser fiel al historial provisto.

Historial de notas del paciente:
${notesSummary}`;

  const raw = await callOpenRouter(buildMessages(prompt));
  const parsed = parseAIResponse(epicrisisResponseSchema, raw);

  return {
    elements: parsed.elements,
    unclassifiedContent: parsed.unclassifiedContent ?? null,
  };
}

// Alias unificado (Fase 2): mismo comportamiento, nombre alineado a AIService.
export const generateEpicrisisDraft = generateEpicrisisFromHistory;

// Genera un borrador de ADENDA de nota a partir del documento confirmado y la
// instrucción del profesional. Exclusivamente asistivo: no inventa contenido.
export async function generateAddendumDraft(
  originalDoc: string,
  instruction: string,
): Promise<AIAddendumOutput> {
  const prompt = `Redacta un BORRADOR de adenda (corrección/ampliación) de una nota clínica ya confirmada.
Debes basarte ÚNICAMENTE en el documento original y en la instrucción del profesional.
Devuelve EXACTAMENTE este objeto JSON (sin texto adicional):
{
  "sections": {
    "motivoConsulta": "",
    "notaClinica": "",
    "examenFisico": "",
    "valoracionClinica": "",
    "planIndicaciones": ""
  },
  "unclassifiedContent": null
}
Reglas estrictas:
1. Refleja SOLO los puntos que la instrucción pide corregir o ampliar; deja como "" las secciones que no aplican.
2. No inventes información clínica, diagnósticos ni prescripciones.
3. El texto de la adenda debe ser coherente con el documento original.

Documento original (confirmado):
"""
${originalDoc}
"""

Instrucción del profesional:
"${instruction}"`;

  const raw = await callOpenRouter(buildMessages(prompt));
  const parsed = parseAIResponse(structuredNoteResponseSchema, raw);

  return {
    sections: parsed.sections,
    unclassifiedContent: parsed.unclassifiedContent ?? null,
  };
}

// Instancia unificada (inyección simple en actions/tests).
export const aiService: AIService = {
  structureClinicalText,
  generateEpicrisisDraft,
  generateAddendumDraft,
};
