// Parser puro del borrador de pre-reserva de cita desde voz/texto (T070).
// Determinista (regex), sin DOM: solo PRELLENA la card/modal de pre-reserva;
// nada se guarda hasta la confirmación explícita del humano (P4/HITL).
// "Costo" no existe en el modelo (Cita no tiene ese campo); "Teléfono" se
// muestra desde SyntheticPatient.phone al resolver el paciente.

export type AppointmentDraft = {
  raw: string;
  patientName?: string;
  medicoName?: string;
  dateISO?: string;
  time?: string;
};

const AGENDAR_RE =
  /\bagendar\b|\bagenda\s+(?:una\s+|la\s+)?cita\b|\bnueva cita\b|\bcrear cita\b|\bnuevo turno\b|\bcrear turno\b/;

const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const MONTHS: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

const WEEKDAYS: Record<string, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  domingo: 0,
};

const toISODate = (d: Date) => {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

const addDays = (d: Date, n: number) => {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  c.setDate(c.getDate() + n);
  return c;
};

function extractTime(t: string): string | undefined {
  const m =
    t.match(
      /\ba\s+las?\s+(\d{1,2})(?:[:.](\d{2}))?\s*(?:y\s+(media|cuarto))?\s*(?:de\s+la\s+(manana|tarde)|a\.?m\.?|p\.?m\.?)?/,
    ) ?? t.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m) return undefined;
  let h = Number(m[1]);
  let min = 0;
  if (m[2]) min = Number(m[2]);
  else if (m[3] === "media") min = 30;
  else if (m[3] === "cuarto") min = 15;
  const meridian = m[4] ?? "";
  if ((meridian === "tarde" || meridian.startsWith("p")) && h >= 1 && h <= 11) {
    h += 12;
  }
  if (meridian === "manana" && h === 12) h = 0;
  if (h < 0 || h > 23 || min < 0 || min > 59) return undefined;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function extractDate(t: string, now: Date): string | undefined {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (/\bpasado\s+manana\b/.test(t)) return toISODate(addDays(base, 2));
  if (/\bmanana\b/.test(t)) return toISODate(addDays(base, 1));
  if (/\bhoy\b/.test(t)) return toISODate(base);
  const wd = t.match(
    /\b(?:el\s+|este\s+|proximo\s+)?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/,
  );
  if (wd) {
    const diff = (WEEKDAYS[wd[1]] - base.getDay() + 7) % 7;
    return toISODate(addDays(base, diff));
  }
  const md = t.match(
    /\b(?:el\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/,
  );
  if (md) {
    const day = Number(md[1]);
    if (day >= 1 && day <= 31) {
      return toISODate(new Date(base.getFullYear(), MONTHS[md[2]], day));
    }
  }
  return undefined;
}

// Segunda palabra del nombre: solo si no es fecha/hora/preposición ("Pérez
// hoy" → "Pérez"; "Juan Pérez" se conserva completo).
const MEDICO_RE =
  /\b(?:con|para)\s+(?:el\s+|la\s+)?(?:dr\.?|dra\.?|doctor(?:a)?)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]+)(?:\s+(?!hoy\b|ma[ñn]ana\b|pasado\b|el\b|la\b|los\b|las\b|a\b|con\b|de\b|del\b|por\b|para\b|paciente\b|\d)([A-Za-zÁÉÍÓÚÑáéíóúñ]+))?/i;

const PATIENT_RE =
  /\b(?:cita\s+(?:de|para)|para)\s+(?:el\s+|la\s+)?(?:paciente\s+)?(.+?)(?=\s+(?:a\s+las?\b|hoy\b|ma[ñn]ana\b|pasado\b|el\s+(?:lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)\b|el\s+\d{1,2}\b|proximo\b|con\s+(?:el|la)\b|\d{1,2}\s+de\s+|\d{1,2}[:.]\d{2}|de\s+la\s+(?:ma[ñn]ana|tarde)\b)|[,;.!?]|$)/i;

const DOCTOR_PREFIX_RE = /^(?:dr|dra|doctor|doctora)\b/i;

function cleanCapturedName(capture: string): string | undefined {
  const cleaned = capture
    .replace(/\s+por\s+favor$/i, "")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(" ");
  if (!cleaned || DOCTOR_PREFIX_RE.test(cleaned)) return undefined;
  return cleaned;
}

// Detecta intención de agendar Y extrae lo que la voz/texto traiga. Devuelve
// null sin intención o sin ningún campo (el orbe cae al ?new=1 genérico).
export function parseAppointmentDraft(
  rawText: string,
  now: Date = new Date(),
): AppointmentDraft | null {
  const original = rawText.trim();
  const t = stripAccents(original);
  if (!t || !AGENDAR_RE.test(t)) return null;

  const time = extractTime(t);
  const dateISO = extractDate(t, now);

  let medicoName: string | undefined;
  const medMatch = original.match(MEDICO_RE);
  if (medMatch?.[1]) {
    medicoName = cleanCapturedName(
      [medMatch[1], medMatch[2]].filter(Boolean).join(" "),
    );
  }

  let patientName: string | undefined;
  const patMatch = original.match(PATIENT_RE);
  if (patMatch?.[1]) patientName = cleanCapturedName(patMatch[1]);

  if (!time && !dateISO && !patientName && !medicoName) return null;

  return {
    raw: original,
    ...(patientName ? { patientName } : {}),
    ...(medicoName ? { medicoName } : {}),
    ...(dateISO ? { dateISO } : {}),
    ...(time ? { time } : {}),
  };
}

export function describeDraft(d: AppointmentDraft): string {
  const parts = [d.patientName, d.medicoName, d.dateISO, d.time].filter(
    Boolean,
  ) as string[];
  return `Pre-reserva: ${parts.join(" · ")}`;
}

export function buildDraftPath(d: AppointmentDraft): string {
  return `/clinical/agenda?new=1&draft=${encodeURIComponent(JSON.stringify(d))}`;
}

export function normalizeName(s: string): string {
  return stripAccents(s).replace(/\s+/g, " ").trim();
}

type Named = {
  id?: string;
  fullName?: string | null;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  syntheticId?: string;
};

function candidateNames(item: Named): string[] {
  const out: string[] = [];
  if (item.fullName) out.push(item.fullName);
  if (item.firstName && item.lastName) {
    out.push(`${item.firstName} ${item.lastName}`);
  }
  if (item.email) out.push(item.email);
  if (item.syntheticId) out.push(item.syntheticId);
  return out.map(normalizeName).filter(Boolean);
}

// Pre-fill solo si el nombre resuelve a UNA entidad; ambigüedad → null y la
// secretaria selecciona a mano (seguridad clínica: nunca adivinar paciente).
export function matchByName<T extends Named>(items: T[], name: string): T | null {
  const target = normalizeName(name);
  if (!target) return null;
  const hits = items.filter((it) =>
    candidateNames(it).some(
      (c) => c === target || c.includes(target) || target.includes(c),
    ),
  );
  return hits.length === 1 ? hits[0] : null;
}
