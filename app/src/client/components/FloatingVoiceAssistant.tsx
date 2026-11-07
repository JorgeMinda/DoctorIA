import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Mic, Square, X } from "lucide-react";
import { Button } from "./ui/button";
import { speak } from "../../clinical/services/tts.service";
import {
  appendToFocusedElement,
  formatDictation,
  parseFloatingVoiceCommand,
} from "../voice/floatingVoice";

type PanelState = { status: string; transcript: string } | null;

const HIDE_AFTER_MS = 6000;
const TTS_OPTIONS = { lang: "es-ES", rate: 1.05 } as const;

export function FloatingVoiceAssistant() {
  const location = useLocation();
  const navigate = useNavigate();
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [panel, setPanel] = useState<PanelState>(null);
  const recRef = useRef<any>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible =
    location.pathname.startsWith("/clinical") ||
    location.pathname.startsWith("/patient");

  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(Boolean(SR));
  }, []);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setPanel(null), HIDE_AFTER_MS);
  }, []);

  const stopListening = useCallback(() => {
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        // ignore
      }
      recRef.current = null;
    }
    setListening(false);
  }, []);

  useEffect(() => {
    return () => {
      stopListening();
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [stopListening]);

  // Router del asistente de referencia: intención → dictado en input enfocado
  // → fallback que repite lo escuchado por TTS.
  const handleVoiceIntent = useCallback(
    (text: string) => {
      if (!text) {
        setPanel(null);
        return;
      }

      const intent = parseFloatingVoiceCommand(text);
      if (intent.type === "NAVIGATE") {
        setPanel({ status: "Listo", transcript: intent.message });
        speak(intent.message, TTS_OPTIONS);
        navigate(intent.path);
        scheduleHide();
        return;
      }

      const active = document.activeElement as HTMLElement | null;
      const typing =
        active &&
        (active.tagName === "TEXTAREA" ||
          (active.tagName === "INPUT" &&
            (active as HTMLInputElement).type === "text"));
      if (typing) {
        const formatted = formatDictation(text);
        if (appendToFocusedElement(formatted)) {
          setPanel({ status: "Dictado agregado", transcript: formatted });
          scheduleHide();
          return;
        }
      }

      // Fallback: repite lo escuchado (sin interpretar clínicamente — P4).
      setPanel({ status: "Escuchado", transcript: text });
      speak(text, TTS_OPTIONS);
      scheduleHide();
    },
    [navigate, scheduleHide],
  );

  const toggleListening = useCallback(() => {
    // Si el estado quedó "escuchando" sin reconocimiento vivo (onend perdido),
    // reiniciar en lugar de solo detener (evita botón muerto).
    if (listening && recRef.current) {
      stopListening();
      return;
    }

    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setPanel({
        status: "No disponible",
        transcript: "Tu navegador no soporta entrada de voz.",
      });
      scheduleHide();
      return;
    }

    stopListening();

    const rec = new SR();
    recRef.current = rec;
    rec.lang = "es-ES";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      // Liberar el micrófono de forma explícita: si onend no llega, el
      // estado queda "escuchando" y el siguiente clic solo detiene (botón muerto).
      try {
        const transcript = (e?.results?.[0]?.[0]?.transcript ?? "").trim();
        stopListening();
        if (transcript) {
          handleVoiceIntent(transcript);
        } else {
          setPanel({ status: "Escuchado", transcript: "" });
          scheduleHide();
        }
      } catch {
        stopListening();
        setPanel({ status: "Error", transcript: "No se pudo leer lo escuchado." });
        scheduleHide();
      }
    };

    rec.onerror = (e: any) => {
      setListening(false);
      recRef.current = null;
      const msg =
        e?.error === "not-allowed"
          ? "Permiso de micrófono denegado."
          : e?.error === "no-speech"
            ? "No se detectó voz. Intenta de nuevo."
            : "No se pudo escuchar. Intenta de nuevo.";
      setPanel({ status: "Error", transcript: msg });
      scheduleHide();
    };

    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };

    setListening(true);
    setPanel({ status: "Escuchando...", transcript: "" });
    try {
      rec.start();
    } catch {
      setListening(false);
      recRef.current = null;
      setPanel({ status: "Error", transcript: "No se pudo iniciar el micrófono." });
      scheduleHide();
    }
  }, [listening, stopListening, handleVoiceIntent, scheduleHide]);

  if (!visible || !supported) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {panel && (
        <div
          role="status"
          aria-live="polite"
          className="w-64 rounded-xl border border-outline-variant bg-background/95 p-3 shadow-lg backdrop-blur"
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="mono-label flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-primary">
              {listening && (
                <span
                  aria-hidden="true"
                  className="inline-block size-1.5 animate-pulse rounded-full bg-destructive"
                />
              )}
              {panel.status}
            </span>
            <button
              type="button"
              aria-label="Cerrar aviso de voz"
              className="text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setPanel(null)}
            >
              <X className="size-3.5" />
            </button>
          </div>
          <p className="text-sm text-foreground">
            {panel.transcript || (
              <span className="text-muted-foreground">Habla ahora...</span>
            )}
          </p>
        </div>
      )}

      <Button
        type="button"
        size="icon"
        aria-label={
          listening ? "Detener escucha del asistente de voz" : "Activar asistente de voz"
        }
        onClick={toggleListening}
        onMouseDown={(e) => e.preventDefault()}
        className="group relative size-14 rounded-full border-0 bg-transparent p-0 shadow-none hover:bg-transparent active:scale-100"
      >
        {/* Glow ambiental (diseño VoiceOrb) — solo visual: no intercepta clics */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-14 rounded-full blur-3xl transition-opacity duration-700 motion-reduce:transition-none opacity-70"
          style={{
            background:
              "radial-gradient(circle, rgba(56, 189, 248, 0.16) 0%, rgba(99, 102, 241, 0.08) 45%, transparent 70%)",
          }}
        />
        {/* Anillo conic */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 rounded-full transition-transform duration-700 ${
            listening ? "voice-orb-ring-fast" : "voice-orb-ring"
          }`}
          style={{
            background: listening
              ? "conic-gradient(from 0deg, #22d3ee, #0ea5e9, #38bdf8, #22d3ee, #22d3ee)"
              : "conic-gradient(from 0deg, #22d3ee, #3b82f6, #8b5cf6, #22c55e, #22d3ee)",
            animationDuration: listening ? "3.2s" : "18s",
            animationIterationCount: "infinite",
            filter: "blur(0.5px)",
          }}
        />
        {/* Anillo externo tenue */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[2px] rounded-full border border-white/10"
        />
        {/* Núcleo oscuro */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[5px] rounded-full bg-[#05070c] transition-all duration-500"
          style={{
            boxShadow: listening
              ? "inset 0 0 20px rgba(0,0,0,0.85), inset 0 0 8px rgba(34,211,238,0.4)"
              : "inset 0 0 20px rgba(0,0,0,0.85), inset 0 0 8px rgba(56,189,248,0.15)",
          }}
        />
        {/* Icono */}
        <span className="pointer-events-none relative flex items-center justify-center">
          {listening ? (
            <Square
              className="size-4 animate-pulse text-destructive"
              fill="currentColor"
            />
          ) : (
            <Mic className="size-5 text-cyan-400 transition-colors group-hover:text-cyan-300" />
          )}
        </span>
      </Button>
    </div>
  );
}
