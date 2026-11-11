import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "wasp/client/auth";
import { routes } from "wasp/client/router";
import {
  createNoteFromVoice,
  getVoiceAssistantResponse,
} from "wasp/client/operations";
import { Mic, Square, X } from "lucide-react";
import { Button } from "./ui/button";
import { speak } from "../../clinical/services/tts.service";
import type { VoiceAssistantResponse } from "../../clinical/services/voiceAssistant";
import {
  appendToFocusedElement,
  formatDictation,
  parseFloatingVoiceCommand,
  wantsCreateNote,
  wantsPatientSummary,
} from "../voice/floatingVoice";
import {
  buildDraftPath,
  describeDraft,
  parseAppointmentDraft,
} from "../voice/appointmentDraft";

type PanelState = { status: string; transcript: string } | null;

const HIDE_AFTER_MS = 6000;
const TTS_OPTIONS = { lang: "es-ES", rate: 1.05 } as const;

export function FloatingVoiceAssistant() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: user } = useAuth();
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [panel, setPanel] = useState<PanelState>(null);
  const [summary, setSummary] = useState<VoiceAssistantResponse | null>(null);
  const recRef = useRef<any>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMedico = Boolean(user?.isMedico) && !user?.isAdmin;

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

  // Comandos profundos (solo médico, mismo servidor que la página /clinical/voice):
  // resumen de paciente o creación de borrador de nota por voz (P4: revisión humana).
  const runDeepCommand = useCallback(
    async (text: string, isNote: boolean) => {
      setSummary(null);
      setPanel({
        status: isNote ? "Creando borrador…" : "Procesando consulta…",
        transcript: text,
      });
      try {
        if (isNote) {
          const res: any = await createNoteFromVoice({ query: text });
          if (res?.actionType !== "NOTE_CREATED") {
            throw new Error("No se pudo crear el borrador de nota.");
          }
          setPanel({
            status: "Nota creada",
            transcript: `Se guardó una nota para ${res.patientName} (${res.syntheticId}). Abriendo el editor para revisión…`,
          });
          speak(
            `Borrador de nota creado para ${res.patientName}. Abriendo el editor.`,
            TTS_OPTIONS,
          );
          navigate(routes.ClinicalNoteRoute.build({ params: { noteId: res.noteId } }));
          scheduleHide();
          return;
        }

        const res: VoiceAssistantResponse | null = await getVoiceAssistantResponse({
          query: text,
        });
        if (!res) throw new Error("Sin respuesta del asistente");
        setSummary(res);
        if (res.patient) {
          setPanel({
            status: "Resumen listo",
            transcript: `${res.patient.firstName} ${res.patient.lastName} (${res.patient.syntheticId})`,
          });
          speak(
            `Resumen clínico de ${res.patient.firstName} ${res.patient.lastName} listo.`,
            TTS_OPTIONS,
          );
        } else {
          const msg =
            res.summary[0] ?? "No encontré ningún paciente con ese nombre.";
          setPanel({ status: "No encontrado", transcript: msg });
          speak(msg, TTS_OPTIONS);
          scheduleHide();
        }
      } catch (err: any) {
        const msg = err?.message || "No se pudo completar la consulta";
        setSummary(null);
        setPanel({ status: "Error", transcript: msg });
        speak(msg.length < 90 ? msg : "No se pudo completar la consulta.", TTS_OPTIONS);
        scheduleHide();
      }
    },
    [navigate, scheduleHide],
  );

  // Router del asistente de referencia: intención → dictado en input enfocado
  // → fallback que repite lo escuchado por TTS.
  const handleVoiceIntent = useCallback(
    (text: string) => {
      if (!text) {
        setPanel(null);
        setSummary(null);
        return;
      }

      // Pre-reserva de cita (T070): si la voz trae datos, abre la card de
      // pre-reserva prefilled en la agenda; nada se guarda sin "Aceptar".
      const draft = parseAppointmentDraft(text);
      if (draft) {
        setSummary(null);
        setPanel({
          status: "Pre-reserva",
          transcript: `${describeDraft(draft)}. Verifica los datos antes de confirmar.`,
        });
        speak(
          "Pre-reserva de cita detectada. Verifica los datos antes de confirmar.",
          TTS_OPTIONS,
        );
        navigate(buildDraftPath(draft));
        scheduleHide();
        return;
      }

      const intent = parseFloatingVoiceCommand(text);
      if (intent.type === "NAVIGATE") {
        setPanel({ status: "Listo", transcript: intent.message });
        setSummary(null);
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

      // Comandos profundos: tienen prioridad sobre el dictado por ser explícitos.
      const create = wantsCreateNote(text);
      const query = wantsPatientSummary(text);
      if (create || query) {
        if (isMedico) {
          void runDeepCommand(text, create);
          return;
        }
        if (!typing) {
          setSummary(null);
          setPanel({
            status: "No disponible",
            transcript: "Consulta reservada al médico asignado.",
          });
          speak("Esta consulta está disponible solo para el médico asignado.", TTS_OPTIONS);
          scheduleHide();
          return;
        }
      }

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
    [navigate, scheduleHide, isMedico, runDeepCommand],
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
    setSummary(null);
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
    // z-[100] por encima de los overlays de Radix Dialog (z-50): si no, con un
    // modal abierto el overlay tapa el botón y el micrófono queda "congelado".
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col items-end gap-3">
      {panel && (
        <div
          role="status"
          aria-live="polite"
          className={`${
            summary ? "w-80" : "w-64"
          } rounded-xl border border-outline-variant bg-background/95 p-3 shadow-lg backdrop-blur`}
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
              onClick={() => {
                setPanel(null);
                setSummary(null);
              }}
            >
              <X className="size-3.5" />
            </button>
          </div>
          <p className="text-sm text-foreground">
            {panel.transcript || (
              <span className="text-muted-foreground">Habla ahora...</span>
            )}
          </p>
          {summary && (
            <div className="mt-2 space-y-2 border-t border-outline-variant/60 pt-2">
              <ul className="space-y-1">
                {summary.summary.slice(0, 4).map((line) => (
                  <li key={line} className="flex gap-1.5 text-xs text-foreground/90">
                    <span className="mt-1.5 block size-1 shrink-0 rounded-full bg-primary" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] leading-snug text-muted-foreground">
                Signos ilustrativos (datos sintéticos). Revíselos contra la historia
                antes de decidir.
              </p>
              {summary.patient && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-full text-xs"
                  onClick={() => {
                    const patientId = summary.patient?.id;
                    setPanel(null);
                    setSummary(null);
                    if (patientId) {
                      navigate(
                        routes.ClinicalPatientDetailRoute.build({
                          params: { patientId },
                        }),
                      );
                    }
                  }}
                >
                  Ver ficha completa
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <Button
        type="button"
        size="icon"
        aria-label={
          listening ? "Detener escucha del asistente de voz" : "Activar asistente de voz"
        }
        onClick={toggleListening}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.preventDefault()}
        className="group relative size-14 rounded-full border-0 bg-transparent p-0 shadow-none hover:bg-transparent active:scale-100"
      >
        {/* Glow ambiental (diseño VoiceOrb) — solo visual: no intercepta clics */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-14 rounded-full blur-3xl transition-opacity duration-700 motion-reduce:transition-none opacity-70"
          style={{
            background:
              "radial-gradient(circle, rgba(224, 72, 121, 0.16) 0%, rgba(126, 13, 66, 0.08) 45%, transparent 70%)",
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
              ? "conic-gradient(from 0deg, #f0a3bb, #e04879, #c22d5c, #f0a3bb, #f0a3bb)"
              : "conic-gradient(from 0deg, #e04879, #8e183e, #7e0d42, #c22d5c, #e04879)",
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
              ? "inset 0 0 20px rgba(0,0,0,0.85), inset 0 0 8px rgba(224,72,121,0.4)"
              : "inset 0 0 20px rgba(0,0,0,0.85), inset 0 0 8px rgba(224,72,121,0.15)",
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
            <Mic className="size-5 text-wine-400 transition-colors group-hover:text-wine-300" />
          )}
        </span>
      </Button>
    </div>
  );
}
