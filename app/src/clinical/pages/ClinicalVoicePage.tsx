import { useCallback, useEffect, useRef, useState } from "react";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useQuery } from "wasp/client/operations";
import { getVoiceAssistantResponse } from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import { Mic, Sparkles, TrendingDown, TrendingUp, Minus, ShieldAlert } from "lucide-react";
import { Button } from "../../client/components/ui/button";
import { Input } from "../../client/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../client/components/ui/card";
import { Switch } from "../../client/components/ui/switch";
import { VoiceOrb, type VoiceAssistantState } from "../components/VoiceOrb";
import type { VoiceAssistantResponse } from "../services/voiceAssistant";

// Consulta de ejemplo (modo demo / placeholder). Los datos de la respuesta son SINTÉTICOS.
const DEMO_QUERY = "DoctorIA, dame el resumen de María Torres antes de mi cita.";

// Respuesta demo embebida (misma forma que la query, pero sin red) para probar los estados.
const DEMO_RESPONSE: VoiceAssistantResponse = {
  query: DEMO_QUERY,
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

export function ClinicalVoicePage() {
  const { data: user } = useAuth();
  const [phase, setPhase] = useState<VoiceAssistantState>("IDLE");
  const [queryInput, setQueryInput] = useState("");
  const [demoMode, setDemoMode] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState<VoiceAssistantResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSparkline, setShowSparkline] = useState(false);

  const timersRef = useRef<number[]>([]);
  const wordIndexRef = useRef(0);

  const { isFetching } = useQuery(
    getVoiceAssistantResponse,
    { query: transcript },
    { enabled: false, refetchOnWindowFocus: false },
  );

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  if (!user?.isMedico || user.isAdmin) {
    return (
      <div className="mt-10 px-6">
        <Card className="mb-4 lg:m-8">
          <CardContent className="p-6">
            Solo profesionales médicos habilitados pueden acceder a este módulo.
          </CardContent>
        </Card>
      </div>
    );
  }

  const effectiveQuery = (queryInput || DEMO_QUERY).trim();

  const beginListening = (text: string) => {
    clearTimers();
    setError(null);
    setResponse(null);
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
          setPhase("RESPONDING");
        }, 1600),
      );
      return;
    }

    setTranscript(text);
    try {
      const res = await getVoiceAssistantResponse({ query: text });
      if (res) {
        setResponse(res);
        setPhase("RESPONDING");
      } else {
        throw new Error("Sin respuesta del asistente");
      }
    } catch (err: any) {
      setError(err?.message ?? "No se pudo completar la consulta");
      setPhase("IDLE");
    }
  };

  const handleOrbActivate = () => {
    if (phase === "IDLE" || phase === "RESPONDING") {
      beginListening(effectiveQuery);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (phase === "IDLE") {
      beginListening(effectiveQuery);
    }
  };

  const handleReset = () => {
    clearTimers();
    setPhase("IDLE");
    setTranscript("");
    setResponse(null);
    setError(null);
    setShowSparkline(false);
  };

  const TrendIcon =
    response?.vitals.find((v) => v.trend === "down")
      ? TrendingDown
      : response?.vitals.find((v) => v.trend === "up")
        ? TrendingUp
        : Minus;

  return (
    <div className="mt-6 px-6 pb-16">
      <div className="mx-auto max-w-3xl">
        {/* Encabezado */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Asistente de voz</h1>
            <p className="text-sm text-muted-foreground">
              Consulta clínica asistida por IA sobre tus pacientes asignados.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border px-3 py-1.5">
            <Sparkles className="size-4 text-primary" />
            <label htmlFor="demo-mode" className="text-sm font-medium">
              Modo demo
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

        {/* Orbe + estado */}
        <div className="relative flex flex-col items-center rounded-2xl border border-border/60 bg-background/40 py-10 backdrop-blur-sm">
          <VoiceOrb
            state={phase}
            onActivate={handleOrbActivate}
            disabled={phase === "LISTENING" || phase === "PROCESSING"}
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
            {isFetching && <span className="animate-pulse">· consultando…</span>}
          </div>

          {/* Transcripción */}
          <div className="mt-4 w-full max-w-xl px-6">
            {transcript ? (
              <p className="text-center text-base italic text-foreground/90">
                “{transcript}”
              </p>
            ) : (
              <p className="text-center text-sm text-muted-foreground/70">
                Ej.: “{DEMO_QUERY}”
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
              placeholder="Escribe o di: DoctorIA, dame el resumen de…"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              disabled={phase === "LISTENING" || phase === "PROCESSING"}
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Enviar consulta"
              disabled={phase !== "IDLE"}
            >
              <Mic className="size-4" />
            </Button>
          </form>

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
        {response && phase === "RESPONDING" && (
          <div className="mt-6 space-y-4">
            {/* Aviso de validación clínica */}
            <div
              role="note"
              className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4"
            >
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
              <div className="text-sm">
                <p className="font-semibold">Respuesta generada por IA · Datos de demostración</p>
                <p className="mt-0.5 text-muted-foreground">
                  Este resumen es sintético y no constituye un diagnóstico. Revíselo contra la
                  historia clínica antes de tomar decisiones.
                </p>
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
                {response.patient && response.patient.id !== "demo-patient" && (
                  <WaspRouterLink
                    to={routes.ClinicalPatientDetailRoute.to}
                    params={{ patientId: response.patient.id }}
                  >
                    <Button variant="outline" size="sm">
                      Ver historia completa
                    </Button>
                  </WaspRouterLink>
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
                    {response.vitals.map((v) => (
                      <div
                        key={v.label}
                        className="rounded-xl border border-border/60 bg-muted/30 p-4"
                      >
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {v.label}
                        </p>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-xl font-semibold">{v.value}</span>
                          <span className="text-xs text-muted-foreground">{v.unit}</span>
                          <TrendIcon
                            className="text-muted-foreground ml-auto size-4"
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    ))}
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
                      <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
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
                            className="rounded-full border border-border/60 px-3 py-1 text-xs"
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
                      <WaspRouterLink to={routes.ClinicalPatientsRoute.to}>
                        <Button variant="outline" size="sm">
                          Ver pacientes asignados
                        </Button>
                      </WaspRouterLink>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSparkline((s) => !s)}
                    >
                      Ver gráfico de evolución
                    </Button>
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
