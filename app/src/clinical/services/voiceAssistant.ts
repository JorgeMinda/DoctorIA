// Servicio de asistente de voz — mock determinista (PD-01/PD-03 pendientes).
// Genera un resumen clínico SINTÉTICO a partir de la consulta del médico.
// Solo responde por pacientes autorizados y NUNCA presenta la salida como diagnóstico definitivo.
//
// Arquitectura:
//   - parseVoiceQuery: detecta el paciente citado en la consulta.
//   - resolvePatientByName: busca el paciente entre los autorizados (firstName/lastName/syntheticId).
//   - buildVoiceSummary: arma el resumen clínico estructurado (mock determinista por paciente).
//   - buildVoiceError: respuesta de "no encontrado / no autorizado".

export type VoiceQueryParseResult = {
  name: string | null;
  tokens: string[];
};

export type VoiceCommandIntent = "RETRIEVE" | "CREATE_NOTE";

// Comando de voz parseado: intención detectada + datos extraídos.
// - patientQuery: nombre o syntheticId del paciente citado.
// - clinicalText:  dictado clínico para `originalText` cuando intent === 'CREATE_NOTE'.
export type VoiceCommand = {
  intent: VoiceCommandIntent;
  patientQuery: string;
  clinicalText?: string;
};

export type VoicePatientMatch = {
  id: string;
  firstName: string;
  lastName: string;
  syntheticId: string;
  birthDate: Date;
  sex: string;
  medicalHistory: string | null;
  allergies: string | null;
};

export type VoiceVital = {
  label: string;
  value: string;
  trend: "up" | "down" | "stable";
  unit: string;
};

export type VoiceSeriesPoint = {
  label: string;
  value: string;
};

export type VoiceAssistantResponse = {
  actionType: "VOICE_RETRIEVED";
  query: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    syntheticId: string;
    age: number;
    sex: string;
    medicalHistory: string | null;
    allergies: string | null;
  } | null;
  summary: string[];
  vitals: VoiceVital[];
  evolutionSeries: VoiceSeriesPoint[];
  lastVisitDaysAgo: number | null;
  actionLinks: {
    openPatient: boolean;
  };
  requiresValidation: true;
  source: "DEMO_SYNTHETIC";
}

export function parseVoiceQuery(query: string): VoiceQueryParseResult {
  // Normaliza la consulta y extrae el nombre citado después de "de/del paciente <Nombre>".
  const normalized = query.trim().replace(/[.,;!?]+$/g, "");
  const tokens = normalized.split(/\s+/);

  // Patrones: "resumen de María", "el resumen de María González", "paciente María González",
  // "resumen del paciente María", "ficha de María", "historia de María".
  const nameMatch = normalized.match(
    /(?:resumen|ficha|historia|síntesis|sintesis|evolución|evolucion|información|informacion|datos|detalles|situación|situacion|consulta|estado)\s+(?:clínica|clinica)?\s*(?:del paciente|el paciente|de|del|sobre)\s+([A-ZÁÉÍÓÚÜÑa-záéíóúüñ0-9\-]+(?:\s+[A-ZÁÉÍÓÚÜÑa-záéíóúüñ0-9\-]+)*)/i,
  );
  // Patrón sin verbo: "María González" al inicio o "paciente María González".
  const altMatch = normalized.match(
    /(?:paciente|doctora|doctor)\s+([A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+(?:\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+)?)/,
  );

  const name = nameMatch?.[1] ?? altMatch?.[1] ?? null;
  return { name: name ? name.trim() : null, tokens };
}

const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Frases que disparan el modo CREATE_NOTE (detección de intención).
const CREATE_NOTE_PHRASES: readonly string[] = [
  "anota en la historia",
  "anota en el historial",
  "anotar en la historia",
  "anotar en el historial",
  "anota en",
  "anotar en",
  "anota a",
  "anotar a",
  "agrega una nota",
  "agrega la nota",
  "agregar una nota",
  "agregarle una nota",
  "agrega nota",
  "agregar nota",
  "crea una nota",
  "crear una nota",
  "crea nota",
  "crear nota",
  "nueva nota",
  "abrir nota",
  "abre nota",
  "abre la nota",
  "abrir la nota",
  "nota para",
  "nota de",
  "dictar nota",
  "dicta nota",
  "registra que",
  "registrar que",
  "anota que",
  "apunta que",
  "déjame una nota",
  "dejame una nota",
];

// Marcadores tras los que aparece el paciente (nombre o ID).
const PATIENT_MARKER_RE =
  /(?:en el historial de|en la historia de|a la historia de|de la historia de|al paciente|del paciente|el paciente|la paciente|paciente|registra que|anota que|apunta que|sobre|para|con|de|a|en)\s+/i;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Detecta la intención del comando de voz:
//   - CREATE_NOTE: el médico pide crear o abrir un borrador de nota por voz.
//   - RETRIEVE:    comportamiento de consulta (resumen de paciente).
export function parseVoiceCommand(query: string): VoiceCommand {
  const normalized = query.trim().replace(/[.,;!?]+$/g, "");
  const lower = normalized.toLowerCase();
  
  // Buscar si coincide con alguna frase de creación de nota
  const matchedPhrase = CREATE_NOTE_PHRASES.find((phrase) =>
    lower.includes(phrase),
  );

  if (!matchedPhrase) {
    return {
      intent: "RETRIEVE",
      patientQuery: parseVoiceQuery(normalized).name ?? "",
    };
  }

  // 1) Preferencia por syntheticId si existe en el texto (ej. PAC-001).
  const idMatch = normalized.match(/\b(PAC-\d{1,4})\b/i);
  if (idMatch && idMatch.index != null) {
    return {
      intent: "CREATE_NOTE",
      patientQuery: idMatch[1].toUpperCase(),
      clinicalText: clinicalTextAfter(normalized, idMatch.index, idMatch[0].length),
    };
  }

  // 2) Extraer el texto tras la frase de activación (ej. tras "anota en", "crear nota para", etc.)
  const phraseIndex = lower.indexOf(matchedPhrase);
  let afterPhrase = normalized.slice(phraseIndex + matchedPhrase.length).trim();

  // Limpiar marcadores iniciales ("el paciente", "de", "a", etc.)
  afterPhrase = afterPhrase
    .replace(/^(?:el paciente|la paciente|al paciente|del paciente|paciente|en la historia de|en el historial de|de|a|para|en)\s+/i, "")
    .trim();

  // Si hay conectores clínicos que separan el nombre del dictado ("que presenta...", "con dolor...", "donde...")
  const connectorMatch = afterPhrase.match(/\s+(?:que|con|donde|y\s+dice|refiere|presenta|quien|indicando)\s+/i);

  if (connectorMatch && connectorMatch.index != null) {
    const patientQuery = afterPhrase.slice(0, connectorMatch.index).trim();
    const clinicalText = afterPhrase.slice(connectorMatch.index + connectorMatch[0].length).trim();
    return {
      intent: "CREATE_NOTE",
      patientQuery,
      clinicalText: clinicalText || undefined,
    };
  }

  // Si no hay conector, verificar si son 1 a 3 palabras (nombre del paciente)
  const words = afterPhrase.split(/\s+/).filter(Boolean);
  if (words.length > 0 && words.length <= 4) {
    return {
      intent: "CREATE_NOTE",
      patientQuery: afterPhrase.trim(),
      clinicalText: undefined,
    };
  } else if (words.length > 4) {
    // Si hay muchas palabras, tomar las primeras 2 como nombre y el resto como dictado clínico
    const patientQuery = words.slice(0, 2).join(" ");
    const clinicalText = words.slice(2).join(" ");
    return {
      intent: "CREATE_NOTE",
      patientQuery,
      clinicalText: clinicalText || undefined,
    };
  }

  return { intent: "CREATE_NOTE", patientQuery: afterPhrase, clinicalText: undefined };
}

// Extrae el dictado clínico: resto del texto tras la mención del paciente,
// eliminando conectores iniciales ("que", "presenta", etc.).
function clinicalTextAfter(
  text: string,
  start: number,
  length: number,
): string | undefined {
  const after = text.slice(start + length).trim();
  const cleaned = after
    .replace(
      /^(?:que|con|donde|por|sobre|y|le|la|el|se|al paciente|del paciente|paciente)\b\s*/i,
      "",
    )
    .trim()
    .replace(/^[^A-ZÁÉÍÓÚÜÑa-záéíóúüñ0-9]+/, "");
  return cleaned.length > 0 ? cleaned : undefined;
}

// Devuelve TODAS las coincidencias entre los pacientes autorizados, para poder
// detectar ambigüedad (ej. dos "María"). Orden de confianza:
//   1. syntheticId exacto.
//   2. nombre + apellido completo.
//   3. coincidencia parcial (token >= 3 chars en nombre/apellido/PAC).
export function resolvePatientMatches(
  patients: VoicePatientMatch[],
  query: string | null,
): VoicePatientMatch[] {
  if (!query) return [];
  const normalized = stripAccents(query).toLowerCase().normalize("NFC").trim();
  const parts = normalized.split(/\s+/).filter(Boolean);

  if (/^pac-\d+$/i.test(normalized)) {
    const byId = patients.filter(
      (p) => stripAccents(p.syntheticId).toLowerCase() === normalized,
    );
    if (byId.length > 0) return byId;
  }

  const byFull = patients.filter((p) => {
    const full = stripAccents(`${p.firstName} ${p.lastName}`).toLowerCase();
    return parts.every((part) => full.includes(part));
  });
  if (byFull.length > 0) return byFull;

  return patients.filter((p) => {
    const haystack = stripAccents(
      `${p.firstName} ${p.lastName} ${p.syntheticId}`,
    ).toLowerCase();
    return parts.some((part) => part.length >= 3 && haystack.includes(part));
  });
}

export function resolvePatientByName(
  patients: VoicePatientMatch[],
  name: string | null,
): VoicePatientMatch | null {
  return resolvePatientMatches(patients, name)[0] ?? null;
}

// Hash determinista para valores sintéticos estables por paciente (sin PII).
function seededNumber(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function range(hash: number, min: number, max: number): number {
  return min + (hash % (max - min + 1));
}

export function buildVoiceSummary(
  query: string,
  patient: VoicePatientMatch,
): VoiceAssistantResponse {
  const seed = patient.id + patient.syntheticId + patient.firstName;
  const hash = seededNumber(seed);

  // Edad calculada desde birthDate.
  const age = calculateAge(patient.birthDate);

  // Valores sintéticos estables por paciente.
  const systolic = range(hash, 118, 134);
  const diastolic = range(hash % 97 + 1, 76, 86);
  const tsh = (2.2 + (hash % 100) / 100).toFixed(1); // TSH en descenso sostenido
  const daysAgo = range(hash % 53 + 7, 7, 30);

  // Serie de evolución (4 controles) determinista: presión estable + TSH en descenso.
  const tshBase = 3.1 + (hash % 100) / 100;
  const evolutionSeries = [0, 1, 2, 3].map((i) => ({
    label: `Control ${i + 1}`,
    value: (tshBase - i * 0.4).toFixed(1),
  }));

  const summary = [
    `${patient.firstName} ${patient.lastName}, ${age} años (${patient.sex}).`,
    `Presión estable en ${systolic}/${diastolic} mmHg.`,
    `TSH en descenso sostenido durante ${evolutionSeries.length} controles: ${evolutionSeries
      .map((p) => p.value)
      .join(" → ")}.`,
    `Última visita hace ${daysAgo} días.`,
  ];

  const vitals: VoiceVital[] = [
    {
      label: "Presión arterial",
      value: `${systolic}/${diastolic}`,
      trend: "stable",
      unit: "mmHg",
    },
    {
      label: "TSH",
      value: tsh,
      trend: "down",
      unit: "µUI/mL",
    },
  ];

  return {
    query,
    actionType: "VOICE_RETRIEVED" as const,
    patient: {
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      syntheticId: patient.syntheticId,
      age,
      sex: patient.sex,
      medicalHistory: patient.medicalHistory,
      allergies: patient.allergies,
    },
    summary,
    vitals,
    evolutionSeries,
    lastVisitDaysAgo: daysAgo,
    actionLinks: { openPatient: true },
    requiresValidation: true,
    source: "DEMO_SYNTHETIC",
  };
}

export function buildVoiceError(query: string, reason: "NOT_FOUND" | "NO_ACCESS"): VoiceAssistantResponse {
  const message =
    reason === "NOT_FOUND"
      ? "No encontré un paciente con ese nombre en tus pacientes asignados."
      : "No tienes acceso autorizado a ese paciente.";

  return {
    query,
    actionType: "VOICE_RETRIEVED" as const,
    patient: null,
    summary: [message, "Verifica el nombre o revisa la lista de pacientes asignados."],
    vitals: [],
    evolutionSeries: [],
    lastVisitDaysAgo: null,
    actionLinks: { openPatient: false },
    requiresValidation: true,
    source: "DEMO_SYNTHETIC",
  };
}

function calculateAge(birthDate: Date): number {
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}
