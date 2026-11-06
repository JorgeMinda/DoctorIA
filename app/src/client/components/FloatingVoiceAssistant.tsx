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

  const handleFinal = useCallback(
    (text: string) => {
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

      const intent = parseFloatingVoiceCommand(text);
      if (intent.type === "NAVIGATE") {
        setPanel({ status: "Listo", transcript: intent.message });
        speak(intent.message, { lang: "es-ES", rate: 1.05 });
        navigate(intent.path);
        scheduleHide();
        return;
      }

      setPanel({ status: "Escuchado", transcript: text });
      scheduleHide();
    },
    [navigate, scheduleHide],
  );

  const toggleListening = useCallback(() => {
    if (listening) {
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
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      const shown = (final + interim).trim();
      setPanel({ status: "Escuchando...", transcript: shown });
      if (final.trim()) handleFinal(final.trim());
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
  }, [listening, stopListening, handleFinal, scheduleHide]);

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
            <span className="mono-label text-[11px] uppercase tracking-widest text-primary">
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
        className={
          listening
            ? "size-14 rounded-full bg-destructive text-destructive-foreground shadow-lg animate-pulse"
            : "size-14 rounded-full bg-primary text-primary-foreground shadow-[0_0_20px_rgba(0,218,243,0.35)] hover:bg-primary/90"
        }
      >
        {listening ? (
          <Square className="size-5" fill="currentColor" />
        ) : (
          <Mic className="size-5" />
        )}
      </Button>
    </div>
  );
}
