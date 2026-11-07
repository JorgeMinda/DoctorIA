// Lógica pura del asistente de voz flotante (botón micrófono global).
// Adaptada del asistente de referencia (sin copiloto): router de intenciones
// por palabras clave/regex, dictado en input enfocado y fallback con TTS.
// Sin dependencias de DOM ni React: testeada en tests/unit/floatingVoice.test.ts.

export type FloatingVoiceIntent =
  | { type: "NAVIGATE"; path: string; message: string }
  | { type: "NONE" };

const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Convierte frases de puntuación habladas en símbolos.
// Solo frases inequívocas: nunca toca términos clínicos ("coma" médica, "punto" de inyección).
export function formatDictation(raw: string): string {
  return raw
    .trim()
    .replace(/\s*\bpunto\s+y\s+coma\b/gi, ";")
    .replace(/\s*\bsigno\s+de\s+interrogaci[oó]n\b/gi, "?")
    .replace(/\s*\bsigno\s+de\s+exclamaci[oó]n\b/gi, "!")
    .replace(/\s*\babrir\s+par[eé]ntesis\b/gi, "(")
    .replace(/\s*\bcerrar\s+par[eé]ntesis\b/gi, ")")
    .replace(/\s*\bnueva\s+l[ií]nea\b\s*/gi, "\n")
    .replace(/\s*\bsalto\s+de\s+l[ií]nea\b\s*/gi, "\n")
    .replace(/\s*\bdos\s+puntos\b/gi, ":");
}

// Extrae el nombre del paciente tras un comando ("buscar/busca paciente Ana
// Paredes", "abre/abrir ficha de Ana", "ver la historia del paciente Juan").
// Exige verbo de comando (infinitivo o imperativo) para no disparar
// navegación con texto clínico dictado.
// Se ejecuta sobre el texto ORIGINAL para conservar mayúsculas y acentos.
function extractPatientQuery(original: string): string | null {
  const patterns = [
    /(?:busca|buscar|abre|abrir|ver|mostrar|muestra|consultar|consulta)\s+(?:el\s+|la\s+|a\s+)?paciente\s+(.+)/i,
    /(?:busca|buscar|abre|abrir|ver)\s+(?:la\s+)?ficha\s+(?:de|del)\s+(?:el\s+|la\s+)?(.+)/i,
    /(?:abre|abrir|ver)\s+la\s+historia\s+(?:de|del)\s+(?:el\s+|la\s+)?(.+)/i,
  ];
  for (const p of patterns) {
    const m = original.match(p);
    if (!m?.[1]) continue;
    const name = m[1]
      .trim()
      .replace(/^(?:el\s+|la\s+)?paciente\s+/i, "")
      .replace(/\s+(?:por\s+favor|gracias)$/i, "")
      .trim();
    if (name) return name;
  }
  return null;
}

// Router de intenciones (determinista, sin IA). Orden del asistente de
// referencia: agendar → citas/turnos (con filtro) → buscar paciente (con
// filtro) → navegación general → NONE (el componente dicta si hay input
// enfocado, o repite lo escuchado por TTS).
export function parseFloatingVoiceCommand(transcript: string): FloatingVoiceIntent {
  const original = transcript.trim();
  const t = stripAccents(original);
  if (!t) return { type: "NONE" };

  // 1) Agendar turno/cita → agenda con modal de nueva cita abierto
  if (
    /\bagendar\b|\bnueva cita\b|\bcrear cita\b|\bnuevo turno\b|\bcrear turno\b/.test(t)
  ) {
    return {
      type: "NAVIGATE",
      path: "/clinical/agenda?new=1",
      message: "Abriendo nueva cita",
    };
  }

  // 2) Buscar citas/turnos → agenda, con filtro de estado si se pide
  if (/\bcitas?\b|\bturnos?\b|\bagenda\b/.test(t)) {
    if (/\bpendientes?\b|\bprogramadas?\b|\bagendadas?\b/.test(t)) {
      return {
        type: "NAVIGATE",
        path: "/clinical/agenda?status=SCHEDULED",
        message: "Abriendo citas pendientes",
      };
    }
    if (/\bcompletadas?\b|\bfinalizadas?\b|\bhistorial\b/.test(t)) {
      return {
        type: "NAVIGATE",
        path: "/clinical/agenda?status=COMPLETED",
        message: "Abriendo historial de citas",
      };
    }
    return { type: "NAVIGATE", path: "/clinical/agenda", message: "Abriendo agenda" };
  }

  // 3) Buscar paciente con nombre → padrón filtrado por ?q=
  const patientName = extractPatientQuery(original);
  if (patientName) {
    return {
      type: "NAVIGATE",
      path: `/clinical/patients?q=${encodeURIComponent(patientName)}`,
      message: `Buscando ${patientName}`,
    };
  }

  // 4) Navegación general
  const navRules: Array<[RegExp, string, string]> = [
    [/\badmin\b|\badministracion\b/, "/clinical/admin", "Abriendo administración"],
    [/\bauditoria\b/, "/clinical/audit", "Abriendo auditoría"],
    [
      /(?:abre|abrir|ir a|consultar|consulta|mostrar|muestra)\s+(?:el\s+|la\s+)?(?:asistente|voz)\b|\basistente de voz\b/,
      "/clinical/voice",
      "Abriendo asistente de voz",
    ],
    [/\bportal\b|\bmi salud\b/, "/patient/dashboard", "Abriendo mi portal"],
    [
      /(?:busca|buscar|abre|abrir|ver|ir a|mostrar|muestra)\s+(?:los\s+|las\s+)?pacientes\b|\bpadron\b|\blista de pacientes\b/,
      "/clinical/patients",
      "Abriendo pacientes",
    ],
  ];
  for (const [re, path, message] of navRules) {
    if (re.test(t)) return { type: "NAVIGATE", path, message };
  }

  return { type: "NONE" };
}

// Dictado en un input/textarea controlado por React: usa el setter nativo
// del prototipo + dispatch de evento 'input' para que React actualice el estado.
export function appendToFocusedElement(text: string): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement as HTMLElement | null;
  if (!active) return false;

  const isTextArea = active.tagName === "TEXTAREA";
  const isTextInput =
    active.tagName === "INPUT" &&
    (active as HTMLInputElement).type === "text";
  if (!isTextArea && !isTextInput) return false;

  const proto = isTextArea
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  const el = active as HTMLTextAreaElement | HTMLInputElement;
  const current = el.value ?? "";
  const next = current.trim() ? `${current.trim()} ${text}` : text;
  setter?.call(el, next);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}
