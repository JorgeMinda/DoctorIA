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
    /(?:resumen|ficha|historia|síntesis|evolución)\s+(?:clínica|clinica)?\s*(?:de|del|del paciente|el paciente|sobre)\s+([A-ZÁÉÍÓÚÜÑa-záéíóúüñ]+(?:\s+[A-ZÁÉÍÓÚÜÑa-záéíóúüñ]+)*)/i,
  );
  // Patrón sin verbo: "María González" al inicio o "paciente María González".
  const altMatch = normalized.match(
    /(?:paciente|doctora|doctor)\s+([A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+(?:\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+)?)/,
  );

  const name = nameMatch?.[1] ?? altMatch?.[1] ?? null;
  return { name: name ? name.trim() : null, tokens };
}

export function resolvePatientByName(
  patients: VoicePatientMatch[],
  name: string | null,
): VoicePatientMatch | null {
  if (!name) return null;
  const normalized = name.toLowerCase().normalize("NFC");
  const parts = normalized.split(/\s+/).filter(Boolean);

  // Busca coincidencia por syntheticId exacto.
  if (/^pac-\d+$/.test(normalized)) {
    const byId = patients.find((p) => p.syntheticId.toLowerCase() === normalized);
    if (byId) return byId;
  }

  // Preferencia por coincidencia de apellido + nombre (mayor confianza).
  const byFull = patients.find((p) => {
    const full = `${p.firstName} ${p.lastName}`.toLowerCase();
    return parts.every((part) => full.includes(part));
  });
  if (byFull) return byFull;

  // Fallback: coincidencia parcial de cualquiera de los tokens.
  return patients.find((p) => {
    const haystack = `${p.firstName} ${p.lastName}`.toLowerCase();
    return parts.some((part) => part.length >= 3 && haystack.includes(part));
  }) ?? null;
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
