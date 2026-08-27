/**
 * Servicio de Text-To-Speech (TTS) nativo del navegador.
 * Utiliza window.speechSynthesis (Web Speech API).
 *
 * Características:
 * - 100% nativo (sin llamadas de red ni dependencias externas).
 * - Cancela lecturas previas para evitar solapamiento.
 * - Selección de voz en español si está disponible.
 * - Falla silenciosa si el navegador no soporta SpeechSynthesis.
 */

export interface SpeakOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export function isTTSSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Detiene cualquier reproducción de voz en curso.
 */
export function stopSpeaking(): void {
  if (isTTSSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

/**
 * Reproduce un texto breve mediante voz nativa del navegador.
 */
export function speak(text: string, options: SpeakOptions = {}): void {
  if (!isTTSSupported() || !text?.trim()) return;

  const {
    lang = "es-ES",
    rate = 1.05,
    pitch = 1.0,
    volume = 1.0,
  } = options;

  try {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    const voices = window.speechSynthesis.getVoices();
    const spanishVoice = voices.find(
      (v) => v.lang.startsWith("es") || v.lang.includes("Spanish")
    );
    if (spanishVoice) {
      utterance.voice = spanishVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch {
    // Falla silenciosa si el navegador bloquea la síntesis
  }
}

export const ttsService = {
  speak,
  stop: stopSpeaking,
  isSupported: isTTSSupported,
};
