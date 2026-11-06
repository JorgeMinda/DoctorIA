// Lógica pura del asistente de voz flotante (botón micrófono global).
// Sin dependencias de DOM ni React: formatDictation y parseFloatingVoiceCommand
// son funciones testeadas en tests/unit/floatingVoice.test.ts.

export type FloatingVoiceIntent =
  | { type: "DICTATION"; text: string }
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

// Router de intenciones por palabras clave (sin IA, determinista).
// Orden: administración → auditoría → asistente → agenda → pacientes → portal.
export function parseFloatingVoiceCommand(transcript: string): FloatingVoiceIntent {
  const t = stripAccents(transcript).trim();
  if (!t) return { type: "NONE" };

  const rules: Array<[RegExp, string, string]> = [
    [/\badmin\b|\badministracion\b/, "/clinical/admin", "Abriendo administración"],
    [/\bauditoria\b/, "/clinical/audit", "Abriendo auditoría"],
    [
      /\basistente\b|\bvoz\b|\bconsultar voz\b/,
      "/clinical/voice",
      "Abriendo asistente de voz",
    ],
    [
      /\bcitas?\b|\bagenda\b|\bturnos?\b/,
      "/clinical/agenda",
      "Abriendo agenda",
    ],
    [
      /\bpacientes?\b|\bhistoria\b|\bficha\b|\bpadron\b/,
      "/clinical/patients",
      "Abriendo pacientes",
    ],
    [/\bportal\b|\bmi salud\b/, "/patient/dashboard", "Abriendo mi portal"],
  ];

  for (const [re, path, message] of rules) {
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
