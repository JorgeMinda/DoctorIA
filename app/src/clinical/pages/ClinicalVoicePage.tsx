import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useQuery } from "wasp/client/operations";
import {
  createNoteFromVoice,
  getPatients,
  getVoiceAssistantResponse,
} from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import {
  Mic,
  Square,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Minus,
  ShieldAlert,
  FilePlus2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "../../client/components/ui/button";
import { Input } from "../../client/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../client/components/ui/card";
import { Switch } from "../../client/components/ui/switch";
import { VoiceOrb, type VoiceAssistantState } from "../components/VoiceOrb";
import { useToast } from "../../client/hooks/use-toast";
import {
  parseVoiceCommand,
  type VoiceAssistantResponse,
} from "../services/voiceAssistant";
import { ttsService } from "../services/tts.service";

// Consulta de ejemplo (modo demo / placeholder). Los datos de la respuesta son SINTÉTICOS.
const DEMO_QUERY = "DoctorIA, dame el resumen de María González antes de mi cita.";

// Respuesta demo embebida (misma forma que la query, pero sin red) para probar los estados.
const DEMO_RESPONSE: VoiceAssistantResponse = {
  query: DEMO_QUERY,
  actionType: "VOICE_RETRIEVED",
  patient: {
    id: "demo-patient",
    firstName: "María",
    lastName: "González",
    syntheticId: "PAC-DEMO",
    age: 54,
    sex: "F",
    medicalHistory: "Hipertensión arterial controlada. Hipotiroidismo en seguimiento.",
    allergies: null,
  },  summary: [
    "María González, 54 años (F).",
    "Presión estable en 128/82 mmHg.",
    "TSH en descenso sostenido durante 4 controles: 3.9 → 3.2 → 2.6 → 2.1.",
    "Última visita hace 12 días.",
  ],
  vitals: [
    { label: "Presión arterial", value: "128/82", trend: "stable", unit: "mmHg" },
    { label: "TSH", value: "2.1", trend: "down", unit: "µUI/mL" },
  ],
  evolutionSeries: [
    { label: "Control 1", value: "3.9" },
    { label: "Control 2", value: "3.2" },
    { label: "Control 3", value: "2.6" },
    { label: "Control 4", value: "2.1" },
  ],
  lastVisitDaysAgo: 12,
  actionLinks: { openPatient: true },
  requiresValidation: true,
  source: "DEMO_SYNTHETIC",
};

const STATUS_HINT: Record<VoiceAssistantState, string> = {
  IDLE: "Toca el orbe y pregunta por un paciente asignado.",
  LISTENING: "Escuchando…",
  PROCESSING: "Procesando consulta…",
  RESPONDING: "Respuesta lista.",
};

type VoiceNoteCreatedResponse = {
  actionType: "NOTE_CREATED";
  noteId: string;
  patientId: string;
  patientName: string;
  syntheticId: string;
};

export function ClinicalVoicePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: user } = useAuth();
  const [phase, setPhase] = useState<VoiceAssistantState>("IDLE");
  const [queryInput, setQueryInput] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState<
    VoiceAssistantResponse | VoiceNoteCreatedResponse | null
  >(null);
  const [createdNote, setCreatedNote] = useState<VoiceNoteCreatedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSparkline, setShowSparkline] = useState(false);
  const [speechOn, setSpeechOn] = useState(false);

  const timersRef = useRef<number[]>([]);
  const wordIndexRef = useRef(0);
  const recognitionRef = useRef<any>(null);
  const speechFinalRef = useRef("");
  const speechCurrentRef = useRef("");
  const sessionFinalDeliveredRef = useRef(false);

  const { data: patientsData } = useQuery(getPatients, { pageSize: 50 });
  const assignedPatients: {
    id: string;
    firstName: string;
    lastName: string;
    syntheticId: string;
  }[] = patientsData?.patients ?? [];

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);
  useEffect(
    () => () => {
      ttsService.stop();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    },
    [],
  );

  // Al crear una nota por voz, se muestra un aviso y se redirige al editor
  // del borrador (DRAFT_MANUAL) para la revisión humana (Constitución P4).
  useEffect(() => {
    if (!createdNote) return;
    const t = window.setTimeout(() => {
      navigate(
        routes.ClinicalNoteRoute.build({ params: { noteId: createdNote.noteId } }),
      );
    }, 1500);
    return () => window.clearTimeout(t);
  }, [createdNote, navigate]);

  useEffect(() => {
    if (response?.actionType === "NOTE_CREATED") {
      toast({
        title: "Borrador creado por voz",
        description: `Se guardó una nota para ${response.patientName} (${response.syntheticId}). Abriendo el editor para revisión…`,
      });
      if (isVoiceEnabled) {
        ttsService.speak(`Borrador de nota creado para ${response.patientName}. Abriendo el editor.`);
      }
      setCreatedNote(response);
    }
  }, [response, toast, isVoiceEnabled]);

  if (!user?.isMedico || user.isAdmin) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="border-outline-variant">
          <CardContent className="flex items-start gap-3 p-6 text-sm">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            Solo profesionales médicos habilitados pueden acceder a este módulo.
          </CardContent>
        </Card>
      </div>
    );
  }

  const effectiveQuery = demoMode ? DEMO_QUERY.trim() : queryInput.trim();

  const beginListening = (text: string) => {
    clearTimers();
    setError(null);
    setResponse(null);
    setCreatedNote(null);
    setTranscript("");
    setShowSparkline(false);
    setPhase("LISTENING");

    const words = text.split(/\s+/);
    wordIndexRef.current = 0;
    const STEP_MS = 90;

    // Transcripción simulada progresiva.
    const tick = () => {
      const i = wordIndexRef.current;
      if (i >= words.length) {
        setTranscript(text);
        timersRef.current.push(
          window.setTimeout(() => beginProcessing(text), 300),
        );
        return;
      }
      wordIndexRef.current += 1;
      setTranscript(words.slice(0, i + 1).join(" "));
      timersRef.current.push(window.setTimeout(tick, STEP_MS));
    };
    tick();
  };

  const beginProcessing = async (text: string) => {
    setPhase("PROCESSING");

    if (demoMode) {
      // Modo demo: respuesta embebida (sin red) para probar los estados.
      timersRef.current.push(
        window.setTimeout(() => {
          setResponse({ ...DEMO_RESPONSE, query: text });
          if (isVoiceEnabled) {
            ttsService.speak("Resumen demo de María González listo.");
          }
          setPhase("RESPONDING");
        }, 700),
      );
      return;
    }

    setTranscript(text);
    try {
      // Se parsea en el cliente (función pura) para enrutar la acción servidor
      // correcta: crear nota por voz (CREATE_NOTE) o consulta/resumen (RETRIEVE).
      const parsed = parseVoiceCommand(text);
      if (parsed.intent === "CREATE_NOTE") {
        const res = await createNoteFromVoice({ query: text });
        setCreatedNote(res as VoiceNoteCreatedResponse);
        setResponse(res);
      } else {
        const res = await getVoiceAssistantResponse({ query: text });
        if (!res) {
          throw new Error("Sin respuesta del asistente");
        }
        setResponse(res);
        if (isVoiceEnabled) {
          if (res.patient) {
            ttsService.speak(
              `Resumen clínico de ${res.patient.firstName} ${res.patient.lastName} listo.`,
            );
          } else {
            ttsService.speak("No encontré ningún paciente con ese nombre.");
          }
        }
      }
      setPhase("RESPONDING");
    } catch (err: any) {
      const msg = err?.message ?? "No se pudo completar la consulta";
      setError(msg);
      if (isVoiceEnabled) {
        ttsService.speak(
          msg.length < 80 ? msg : "No se pudo completar la consulta.",
        );
      }
      setPhase("IDLE");
    }
  };

  const stopSpeech = () => {
    setSpeechOn(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
  };

  // Detiene la escucha y consulta de inmediato con el texto capturado.
  const submitSpeech = () => {
    setSpeechOn(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      recognitionRef.current = null;
    }
    const text = speechCurrentRef.current.trim();
    if (!text) {
      setError("No se captó tu voz. Habla de nuevo o escribe la consulta.");
      setPhase("IDLE");
      return;
    }
    setQueryInput(text);
    void beginProcessing(text);
  };

  // Reconocimiento de voz real (Web Speech API). Devuelve true si ya disparó
  // una acción (voz en marcha o demo simulada), false si no soporta voz y hay
  // que caer a la consulta escrita.
  const startSpeech = (): boolean => {
    if (demoMode) {
      if (!effectiveQuery) return false;
      beginListening(DEMO_QUERY);
      return true;
    }

    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return false;

    clearTimers();
    setError(null);
    setResponse(null);
    setCreatedNote(null);
    setTranscript("");
    setShowSparkline(false);
    setPhase("LISTENING");
    speechFinalRef.current = "";
    speechCurrentRef.current = "";
    sessionFinalDeliveredRef.current = false;
    setSpeechOn(true);

    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "es-ES";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0].transcript;
        if (r.isFinal) final += `${t} `;
        else interim += `${t} `;
      }
      // Se recalcula el texto completo en cada evento (no se acumula),
      // para que el provisional (interim) no se duplique.
      speechFinalRef.current = final.trim();
      const full = `${final}${interim}`.trim();
      if (full) {
        speechCurrentRef.current = full;
        setTranscript(full);
      }
    };

    rec.onerror = (e: any) => {
      setSpeechOn(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
      const errorMsg =
        e?.error === "not-allowed" || e?.error === "service-not-allowed"
          ? "Micrófono no permitido. Activa el permiso de voz o escribe la consulta."
          : "No se pudo captar tu voz. Intenta de nuevo o escribe la consulta.";
      setError(errorMsg);
      setPhase("IDLE");
    };

    rec.onend = () => {
      setSpeechOn(false);
      recognitionRef.current = null;
      // Se envía al terminar la escucha, con la oración completa.
      if (sessionFinalDeliveredRef.current) return;
      const text =
        speechFinalRef.current.trim() || speechCurrentRef.current.trim();
      if (!text) {
        setError("No se captó tu voz. Escribe la consulta o pulsa un paciente asignado.");
        setPhase("IDLE");
        return;
      }
      speechCurrentRef.current = text;
      sessionFinalDeliveredRef.current = true;
      submitSpeech();
    };

    rec.start();
    return true;
  };

  const handleOrbActivate = () => {
    if (phase === "LISTENING") {
      submitSpeech();
      return;
    }
    if (phase !== "IDLE" && phase !== "RESPONDING") return;
    if (startSpeech()) return;
    if (!effectiveQuery) {
      setError("Escribe una consulta o pulsa un paciente asignado.");
      return;
    }
    beginListening(effectiveQuery);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (phase === "LISTENING") {
      submitSpeech();
      return;
    }
    if (phase !== "IDLE") return;
    if (!effectiveQuery) {
      setError("Escribe una consulta o pulsa un paciente asignado.");
      return;
    }
    beginListening(effectiveQuery);
  };

  const handleReset = () => {
    ttsService.stop();
    stopSpeech();
    clearTimers();
    setPhase("IDLE");
    setTranscript("");
    setResponse(null);
    setCreatedNote(null);
    setError(null);
    setShowSparkline(false);
  };

  const askForPatient = (p: { firstName: string; lastName: string }) => {
    const q = `DoctorIA, dame el resumen de ${p.firstName} ${p.lastName}`;
    setQueryInput(q);
    beginListening(q);
  };

  const vitals =
    response?.actionType === "VOICE_RETRIEVED" ? response.vitals : [];

  const getTrendIcon = (trend: "up" | "down" | "stable") => {
    if (trend === "down") return TrendingDown;
    if (trend === "up") return TrendingUp;
    return Minus;
  };

  return (
    <div className="mt-6 px-6 pb-16">
      <div className="mx-auto max-w-3xl">
        {/* Encabezado */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mono-label mb-1 text-[11px] uppercase tracking-widest text-primary">
              Clínica · Voz
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Asistente de voz
            </h1>
            <p className="text-sm text-muted-foreground">
              Consulta clínica asistida por IA sobre tus pacientes asignados.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle de Respuesta por Voz (TTS) */}
            <Button
              variant={isVoiceEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => {
                const next = !isVoiceEnabled;
                setIsVoiceEnabled(next);
                if (!next) {
                  ttsService.stop();
                } else {
                  ttsService.speak("Respuesta por voz activada.");
                }
              }}
              className={`rounded-full h-8 gap-1.5 px-3 text-xs transition-colors ${
                isVoiceEnabled
                  ? "bg-primary text-primary-foreground shadow-[0_0_12px_rgba(0,218,243,0.3)]"
                  : "border-outline-variant bg-surface text-muted-foreground hover:text-foreground"
              }`}
              title={
                isVoiceEnabled
                  ? "Desactivar respuesta por voz"
                  : "Activar respuesta por voz (TTS)"
              }
            >
              {isVoiceEnabled ? (
                <>
                  <Volume2 className="size-3.5" />
                  <span>Voz activa</span>
                </>
              ) : (
                <>
                  <VolumeX className="size-3.5" />
                  <span>Voz silenciada</span>
                </>
              )}
            </Button>

            {/* Selector Modo demo/real */}
            <div className="flex items-center gap-2 rounded-full border border-outline-variant bg-surface px-3 py-1.5">
              <Sparkles className="size-4 text-primary" />
              <label htmlFor="demo-mode" className="text-sm font-medium">
                {demoMode ? "Modo demo" : "Modo real"}
              </label>
              <Switch
                id="demo-mode"
                checked={demoMode}
                onCheckedChange={(v) => {
                  setDemoMode(v);
                  handleReset();
                }}
              />
            </div>
          </div>
        </div>

        {/* Orbe + estado */}
        <div className="relative flex flex-col items-center rounded-2xl border border-outline-variant/60 bg-surface/40 py-10 backdrop-blur-sm">
          <VoiceOrb
            state={phase}
            onActivate={handleOrbActivate}
            disabled={phase === "PROCESSING"}
          />

          <div
            role="status"
            aria-live="polite"
            className="mt-6 flex min-h-6 items-center gap-2 text-sm text-muted-foreground"
          >
            <span
              className={
                phase === "LISTENING"
                  ? "text-cyan-400"
                  : phase === "PROCESSING"
                    ? "text-violet-400"
                    : phase === "RESPONDING"
                      ? "text-emerald-400"
                      : "text-muted-foreground"
              }
            >
              {STATUS_HINT[phase]}
            </span>
            {phase === "PROCESSING" && <span className="animate-pulse">· consultando…</span>}
            {speechOn && (
              <>
                <span className="animate-pulse text-emerald-400">· habla ahora…</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={submitSpeech}
                  disabled={!transcript}
                  className="gap-1"
                >
                  <Mic className="size-3.5" />
                  Consultar ya
                </Button>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  Cancelar
                </Button>
              </>
            )}
          </div>

          {/* Transcripción */}
          <div className="mt-4 w-full max-w-xl px-6">
            {transcript ? (
              <p className="text-center text-base italic text-foreground/90">
                “{transcript}”
              </p>
            ) : (
              <p className="text-center text-sm text-muted-foreground/70">
                {demoMode
                  ? `Ej.: “${DEMO_QUERY}”`
                  : `Ej.: “DoctorIA, dame el resumen de ${
                      assignedPatients[0]
                        ? `${assignedPatients[0].firstName} ${assignedPatients[0].lastName}`
                        : "María Torres"
                    }”`}
              </p>
            )}
          </div>

          {/* Entrada de consulta */}
          <form
            onSubmit={handleSubmit}
            className="mt-5 flex w-full max-w-xl items-center gap-2 px-6"
          >
            <Input
              aria-label="Consulta al asistente"
              placeholder="Escribe o di: DoctorIA, dame el resumen de… / anota en la historia de PAC-001 que…"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              disabled={phase === "PROCESSING"}
            />
            <Button
              type="button"
              size="icon"
              aria-label={phase === "LISTENING" ? "Detener y consultar" : "Hablar"}
              disabled={phase === "PROCESSING"}
              onClick={handleOrbActivate}
              variant={phase === "LISTENING" ? "destructive" : "default"}
              className={phase === "LISTENING" ? "animate-pulse ring-2 ring-destructive/50" : ""}
            >
              {phase === "LISTENING" ? (
                <Square className="size-4" />
              ) : (
                <Mic className="size-4" />
              )}
            </Button>
          </form>

          {phase === "IDLE" && assignedPatients.length > 0 && (
            <div className="mt-4 w-full max-w-xl px-6">
              <p className="mb-2 text-xs text-muted-foreground">
                Pacientes asignados — pulsa para consultar:
              </p>
              <div className="flex flex-wrap gap-2">
                {assignedPatients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => askForPatient(p)}
                    className="rounded-full border border-outline-variant px-3 py-1 text-xs transition-colors hover:bg-accent/40"
                  >
                    {p.firstName} {p.lastName}{" "}
                    <span className="text-muted-foreground">({p.syntheticId})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 w-full max-w-xl px-6">
              <Card className="border-destructive/50">
                <CardContent className="p-3 text-sm text-destructive">
                  {error}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Respuesta */}
        {response?.actionType === "NOTE_CREATED" && phase === "RESPONDING" && (
          <div className="mt-6">
            <Card className="border-emerald-600/40">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <FilePlus2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                  <div className="text-sm">
                    <p className="font-semibold text-foreground">Borrador creado por voz</p>
                    <p className="mt-1 text-muted-foreground">
                      Se registró la nota para <span className="font-medium">{response.patientName}</span>{" "}
                      ({response.syntheticId}) como borrador manual pendiente de tu revisión.
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Redirigiendo al editor para confirmar o editar el contenido… (1.5 s)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {response?.actionType === "VOICE_RETRIEVED" && phase === "RESPONDING" && (
          <div className="mt-6 space-y-4">
            {/* Aviso de validación clínica */}
            <div
              role="note"
              className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4"
            >
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
              <div className="text-sm">
                {demoMode ? (
                  <>
                    <p className="font-semibold">Respuesta DEMO · ficticia fija de ejemplo</p>
                    <p className="mt-0.5 text-muted-foreground">
                      Este bloque es una demostración embebida y no corresponde a datos reales.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold">Modo real · paciente asignado</p>
                    <p className="mt-0.5 text-muted-foreground">
                      Los signos mostrados son ilustrativos (datos sintéticos). Revíselos contra la
                      historia clínica antes de tomar decisiones.
                    </p>
                  </>
                )}
              </div>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Resumen clínico
                  </CardTitle>
                  {response.patient && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {response.patient.firstName} {response.patient.lastName} (
                      {response.patient.syntheticId}) · {response.patient.age} años
                    </p>
                  )}
                </div>
                {demoMode && (
                  <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                    DEMO
                  </span>
                )}
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Resumen en frases */}
                <ul className="space-y-2">
                  {response.summary.map((line, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-primary mt-1.5 block size-1 shrink-0 rounded-full bg-current" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                {/* Signos vitales */}
                {response.vitals.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {response.vitals.map((v) => {
                      const VitalTrendIcon = getTrendIcon(v.trend);
                      const trendColor =
                        v.trend === "down"
                          ? "text-destructive"
                          : v.trend === "up"
                            ? "text-emerald-500"
                            : "text-muted-foreground";
                      return (
                        <div
                          key={v.label}
                          className="rounded-xl border border-outline-variant bg-surface/60 p-4"
                        >
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {v.label}
                          </p>
                          <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-xl font-semibold">{v.value}</span>
                            <span className="text-xs text-muted-foreground">{v.unit}</span>
                            <VitalTrendIcon
                              className={`ml-auto size-4 ${trendColor}`}
                              aria-label={
                                v.trend === "down"
                                  ? "en descenso"
                                  : v.trend === "up"
                                    ? "en ascenso"
                                    : "estable"
                              }
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Evolución */}
                {response.evolutionSeries.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Evolución (controles)</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSparkline((s) => !s)}
                        aria-expanded={showSparkline}
                      >
                        {showSparkline ? "Ocultar gráfico" : "Ver gráfico de evolución"}
                      </Button>
                    </div>
                    {showSparkline ? (
                      <div className="rounded-xl border border-outline-variant bg-surface/60 p-4">
                        <SparklineSeries
                          values={response.evolutionSeries.map((p) => parseFloat(p.value))}
                          labels={response.evolutionSeries.map((p) => p.label)}
                        />
                        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                          {response.evolutionSeries.map((p) => (
                            <div key={p.label}>
                              <p className="text-[10px] text-muted-foreground">{p.label}</p>
                              <p className="text-sm font-semibold">{p.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {response.evolutionSeries.map((p) => (
                          <span
                            key={p.label}
                            className="rounded-full border border-outline-variant px-3 py-1 text-xs"
                          >
                            {p.label}: <span className="font-semibold">{p.value}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Acciones rápidas */}
                {response.actionLinks.openPatient && response.patient && (
                  <div className="flex flex-wrap gap-2 border-t pt-4">
                    {response.patient.id !== "demo-patient" ? (
                      <WaspRouterLink
                        to={routes.ClinicalPatientDetailRoute.to}
                        params={{ patientId: response.patient.id }}
                      >
                        <Button variant="outline" size="sm">
                          Ver historia completa
                        </Button>
                      </WaspRouterLink>
                    ) : (
                      <>
                        <WaspRouterLink to={routes.ClinicalPatientsRoute.to}>
                          <Button variant="outline" size="sm">
                            Ver pacientes asignados
                          </Button>
                        </WaspRouterLink>
                        <span className="flex items-center text-xs text-muted-foreground">
                          (Modo demo — sin paciente real seleccionado)
                        </span>
                      </>
                    )}
                    <Button variant="ghost" size="sm" onClick={handleReset}>
                      Nueva consulta
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {phase === "RESPONDING" && !response && !error && (
          <div className="mt-6 flex justify-center">
            <Button variant="outline" onClick={handleReset}>
              Nueva consulta
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Mini sparkline SVG (sin dependencias externas).
function SparklineSeries({
  values,
  labels,
}: {
  values: number[];
  labels: string[];
}) {
  const W = 320;
  const H = 96;
  const PAD = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values.map((v, i) => {
    const x = PAD + (i * (W - PAD * 2)) / (values.length - 1 || 1);
    const y = H - PAD - ((v - min) / span) * (H - PAD * 2);
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${H - PAD} L ${points[0].x} ${H - PAD} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-24 w-full"
      role="img"
      aria-label={`Gráfico de evolución: ${labels.join(", ")}`}
    >
      <defs>
        <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkline-fill)" />
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary"
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="3"
          fill="currentColor"
          className="text-primary"
        />
      ))}
    </svg>
  );
}
