import { useEffect, useRef, useState } from "react";
import { AudioLines, Mic, ShieldCheck, Square } from "lucide-react";
import { cn } from "../../client/utils";

// Estados del orbe ambient de DoctorIA (demo interactivo, sin backend de voz).
export type AmbientState = "IDLE" | "LISTENING" | "PROCESSING" | "RESPONDING";

interface VoiceOrbHeroProps {
  state: AmbientState;
  onActivate: () => void;
  disabled?: boolean;
  className?: string;
}

// Glow ambiental por estado (usa tokens del design system).
const STATE_GLOW: Record<AmbientState, string> = {
  IDLE: "radial-gradient(circle, hsl(var(--primary) / 0.18) 0%, hsl(var(--secondary) / 0.08) 45%, transparent 70%)",
  LISTENING: "radial-gradient(circle, hsl(var(--primary) / 0.38) 0%, hsl(var(--secondary) / 0.16) 45%, transparent 70%)",
  PROCESSING: "radial-gradient(circle, hsl(var(--secondary) / 0.42) 0%, hsl(var(--secondary) / 0.2) 45%, transparent 70%)",
  RESPONDING: "radial-gradient(circle, hsl(var(--success) / 0.38) 0%, hsl(var(--primary) / 0.16) 45%, transparent 70%)",
};

// Anillo conic por estado (usa tokens del design system).
const STATE_RING: Record<AmbientState, string> = {
  IDLE: "conic-gradient(from 0deg, hsl(var(--primary)), hsl(var(--secondary)), hsl(var(--success)), hsl(var(--primary)))",
  LISTENING: "conic-gradient(from 0deg, hsl(var(--primary)), hsl(var(--secondary)), hsl(var(--primary)), hsl(var(--primary)))",
  PROCESSING: "conic-gradient(from 0deg, hsl(var(--secondary)), hsl(var(--primary)), hsl(var(--secondary)), hsl(var(--secondary)))",
  RESPONDING: "conic-gradient(from 0deg, hsl(var(--success)), hsl(var(--primary)), hsl(var(--success) / 0.6), hsl(var(--success)), hsl(var(--success)))",
};

const STATE_RING_DURATION: Record<AmbientState, string> = {
  IDLE: "18s",
  LISTENING: "3.2s",
  PROCESSING: "1.1s",
  RESPONDING: "9s",
};

const STATE_LABEL: Record<AmbientState, string> = {
  IDLE: "LISTO",
  LISTENING: "ESCUCHANDO",
  PROCESSING: "PROCESANDO",
  RESPONDING: "RESPONDIENDO",
};

const WAVE_BARS = 28;

export function VoiceOrbHero({ state, onActivate, disabled, className }: VoiceOrbHeroProps) {
  const isBusy = state === "PROCESSING";
  const waveColor =
    state === "LISTENING"
      ? "hsl(var(--primary))"
      : state === "PROCESSING"
        ? "hsl(var(--secondary))"
        : state === "RESPONDING"
          ? "hsl(var(--success))"
          : "hsl(var(--primary) / 0.35)";

  return (
    <div
      className={cn("relative flex flex-col items-center", className)}
      role="region"
      aria-label={`Asistente de voz — ${STATE_LABEL[state]}`}
    >
      {/* Glow ambiental grande de fondo */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute -inset-16 rounded-full blur-3xl transition-opacity duration-700 motion-reduce:transition-none",
          state === "IDLE" ? "opacity-60" : "opacity-100",
        )}
        style={{ background: STATE_GLOW[state] }}
      />
      <div
        aria-hidden="true"
        className="ambient-orb-halo absolute -inset-8 rounded-full"
        style={{ background: STATE_GLOW[state] }}
      />

      <button
        type="button"
        onClick={onActivate}
        disabled={disabled}
        aria-label={
          state === "IDLE"
            ? "Activar asistente de voz de DoctorIA"
            : isBusy
              ? "Procesando consulta"
              : "Estado del asistente de voz"
        }
        className={cn(
          "group relative flex size-52 items-center justify-center rounded-full outline-none sm:size-60 md:size-68",
          "focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          !isBusy && !disabled && "cursor-pointer",
        )}
      >
        {/* Anillo conic giratorio */}
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 rounded-full transition-transform duration-700",
            state === "PROCESSING" ? "voice-orb-ring-fast" : "voice-orb-ring",
          )}
          style={{
            background: STATE_RING[state],
            animationDuration: STATE_RING_DURATION[state],
            animationIterationCount: "infinite",
            filter: "blur(0.5px)",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-[3px] rounded-full border border-white/10"
        />
        <div
          aria-hidden="true"
          className="absolute inset-[10px] rounded-full border border-primary/15"
        />

        {/* Núcleo oscuro */}
        <div
          className={cn(
            "absolute inset-[14px] flex items-center justify-center rounded-full transition-all duration-500",
            "bg-[#050B14]",
            state !== "IDLE" && "voice-orb-breathe",
          )}
          style={{
            boxShadow: `inset 0 0 50px rgba(0,0,0,0.85), inset 0 0 16px ${
              state === "IDLE"
                ? "hsl(var(--primary) / 0.15)"
                : state === "PROCESSING"
                  ? "hsl(var(--secondary) / 0.4)"
                  : state === "RESPONDING"
                    ? "hsl(var(--success) / 0.4)"
                    : "hsl(var(--primary) / 0.4)"
            }`,
          }}
        >
          {/* Punto central */}
          <span
            aria-hidden="true"
            className="block size-3.5 rounded-full transition-colors duration-500"
            style={{
              background:
                state === "IDLE"
                  ? "hsl(var(--primary))"
                  : state === "LISTENING"
                    ? "hsl(var(--primary))"
                    : state === "PROCESSING"
                      ? "hsl(var(--secondary))"
                      : "hsl(var(--success))",
              boxShadow:
                state === "IDLE"
                  ? "0 0 16px hsl(var(--primary) / 0.9)"
                  : state === "PROCESSING"
                    ? "0 0 24px hsl(var(--secondary) / 0.9)"
                    : "0 0 24px hsl(var(--success) / 0.9)",
            }}
          />
        </div>

        {/* Overlay de acción */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute -bottom-1 right-1 flex size-12 items-center justify-center rounded-full transition-all duration-300",
            "bg-background/90 shadow-lg ring-1 ring-border backdrop-blur",
            state === "IDLE" && "group-hover:bg-primary group-hover:text-primary-foreground",
            state === "IDLE" && "text-primary",
            isBusy && "animate-pulse",
          )}
        >
          {state === "IDLE" || state === "RESPONDING" ? (
            <Mic className="size-5" />
          ) : (
            <Square className="size-4" />
          )}
        </span>
      </button>

      {/* Etiqueta de estado */}
      <div className="mt-6 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              "ambient-pulse-dot size-2 rounded-full",
              state === "RESPONDING" && "bg-success",
              state === "PROCESSING" && "bg-secondary",
              state !== "RESPONDING" && state !== "PROCESSING" && "bg-primary",
            )}
          />
          <span className="text-foreground text-xs font-semibold tracking-[0.25em]">
            {STATE_LABEL[state]}
          </span>
        </div>

        {/* Waveform */}
        <div
          aria-hidden="true"
          className="flex h-10 items-center gap-[3px]"
          style={{ filter: `drop-shadow(0 0 6px ${waveColor})` }}
        >
          {Array.from({ length: WAVE_BARS }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "w-[3px] rounded-full",
                state === "IDLE" && "opacity-40",
              )}
              style={{
                height: "100%",
                backgroundColor: waveColor,
                transformOrigin: "center",
                animation:
                  state === "LISTENING" || state === "PROCESSING" || state === "RESPONDING"
                    ? `voice-wave-bar ${1.4 + (i % 7) * 0.18}s ease-in-out ${i * 0.06}s infinite`
                    : undefined,
                animationDelay: state === "RESPONDING" ? `${i * 0.12}s` : undefined,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Controlador de demo: recorre los estados al activar.
const DEMO_STEPS: AmbientState[] = ["LISTENING", "PROCESSING", "RESPONDING", "IDLE"];

export function useAmbientDemo() {
  const [state, setState] = useState<AmbientState>("IDLE");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => timersRef.current.forEach((t) => clearTimeout(t));
  }, []);

  const activate = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];

    const delays = [0, 2400, 2400 + 1800, 2400 + 1800 + 3600];
    DEMO_STEPS.forEach((step, idx) => {
      timersRef.current.push(
        setTimeout(() => setState(step), delays[idx] + 100),
      );
    });
  };

  return { state, activate };
}

// Mensajes de DoctorIA según estado (para el hero).
export const AMBIENT_MESSAGE: Record<AmbientState, string> = {
  IDLE: "Estoy listo para ayudarte con la información clínica.",
  LISTENING: "Escuchando… cuéntame sobre tu paciente.",
  PROCESSING: "Consultando la información clínica.",
  RESPONDING: "Aquí tienes el resumen clínico.",
};

// Icono pequeño para el badge de estado.
export function AmbientBadgeIcon({ state }: { state: AmbientState }) {
  if (state === "RESPONDING") return <AudioLines className="size-3.5" />;
  if (state === "PROCESSING") return <ShieldCheck className="size-3.5" />;
  return <Mic className="size-3.5" />;
}
