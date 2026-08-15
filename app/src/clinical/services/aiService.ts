// AI service — provider-agnostic typed contract (research R-03, clinical-operations.md §6).
// Implemented via OpenRouter (OpenAI-compatible) using a free model with structured JSON output (PD-01).
// NOTE: OpenRouter removed its free DeepSeek tier; we use openai/gpt-oss-20b:free (free, capable, OpenAI-compatible).
// The AI is EXCLUSIVELY assistive: it organizes text, never decides (Constitution P4).

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
const OPENROUTER_MODEL = "openai/gpt-oss-20b:free";

// Maps empty/null/"null" strings to a real TypeScript null (RNF-004: original preserved as-is).
function cleanResponseString(val: any): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (s === "" || s.toLowerCase() === "null" || s.toLowerCase() === "n/a") return null;
  return s;
}

// Llama a OpenRouter (compatible con OpenAI) y devuelve el JSON estructurado del modelo.
// Reintenta ante 429/5xx con backoff respetando Retry-After (resiliencia en producción).
const AI_MAX_RETRIES = 2;

async function callOpenRouterOnce(prompt: string): Promise<any> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY no está configurada.");
  }

  const url = "https://openrouter.ai/api/v1/chat/completions";

  const body = {
    model: OPENROUTER_MODEL,
    messages: [
      {
        role: "system",
        content:
          "Eres un asistente clínico de alta precisión que estructura registros médicos en JSON. " +
          "Nunca inventes información clínica. Responde SOLO con un objeto JSON válido, sin texto adicional.",
      },
      { role: "user", content: prompt },
    ],
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
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      const retryable = response.status === 429 || response.status >= 500;
      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
      const err: any = new Error(
        `La API de OpenRouter retornó un código de error ${response.status}: ${errText}`,
      );
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
      throw new Error(`Timeout al llamar al asistente de IA (${AI_TIMEOUT_MS / 1000}s superados).`);
    }
    throw error;
  }
}

async function callOpenRouter(prompt: string): Promise<any> {
  let lastError: any;
  for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt++) {
    try {
      return await callOpenRouterOnce(prompt);
    } catch (error: any) {
      lastError = error;
      if (error?.retryable && attempt < AI_MAX_RETRIES) {
        const base = error.retryAfterMs ?? 1000 * (attempt + 1);
        const wait = Math.min(base, 15_000);
        await new Promise((resolve) => setTimeout(resolve, wait));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

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

  const raw = await callOpenRouter(prompt);
  const rawSections = raw.sections ?? {};

  const sections = {
    motivoConsulta: cleanResponseString(rawSections.motivoConsulta),
    notaClinica: cleanResponseString(rawSections.notaClinica),
    examenFisico: cleanResponseString(rawSections.examenFisico),
    valoracionClinica: cleanResponseString(rawSections.valoracionClinica),
    planIndicaciones: cleanResponseString(rawSections.planIndicaciones),
  };
  const unclassifiedContent = cleanResponseString(raw.unclassifiedContent);

  // RNF-004: la IA puede descartar texto sin señal clínica; si no clasificó NADA,
  // preservamos el texto original íntegro en notaClinica (nunca se pierde contenido).
  const nothingClassified =
    Object.values(sections).every((v) => v === null) && unclassifiedContent === null;
  if (nothingClassified) {
    sections.notaClinica = input.text;
  }

  return {
    sections,
    unclassifiedContent,
    originalTextPreserved: true,
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0.8,
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

  const raw = await callOpenRouter(prompt);

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
