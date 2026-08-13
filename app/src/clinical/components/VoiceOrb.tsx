import { cn } from "../../client/utils";
import { Mic, Square } from "lucide-react";

export type VoiceAssistantState = "IDLE" | "LISTENING" | "PROCESSING" | "RESPONDING";

interface VoiceOrbProps {
  state: VoiceAssistantState;
  onActivate: () => void;
  disabled?: boolean;
  className?: string;
}

// Paleta de glow por estado (cian/azul/violeta/verde, estética "ambient assistant").
const STATE_GLOW: Record<VoiceAssistantState, string> = {
  IDLE: "radial-gradient(circle, rgba(56,189,248,0.16) 0%, rgba(99,102,241,0.08) 45%, transparent 70%)",
  LISTENING: "radial-gradient(circle, rgba(34,211,238,0.35) 0%, rgba(56,189,248,0.18) 45%, transparent 70%)",
  PROCESSING: "radial-gradient(circle, rgba(139,92,246,0.4) 0%, rgba(99,102,241,0.22) 45%, transparent 70%)",
  RESPONDING: "radial-gradient(circle, rgba(52,211,153,0.35) 0%, rgba(34,197,94,0.18) 45%, transparent 70%)",
};

// Anillo conic por estado.
const STATE_RING: Record<VoiceAssistantState, string> = {
  IDLE: "conic-gradient(from 0deg, #22d3ee, #3b82f6, #8b5cf6, #22c55e, #22d3ee)",
  LISTENING: "conic-gradient(from 0deg, #22d3ee, #0ea5e9, #38bdf8, #22d3ee, #22d3ee)",
  PROCESSING: "conic-gradient(from 0deg, #8b5cf6, #6366f1, #3b82f6, #8b5cf6, #8b5cf6)",
  RESPONDING: "conic-gradient(from 0deg, #34d399, #22c55e, #a7f3d0, #34d399, #34d399)",
};

const STATE_RING_DURATION: Record<VoiceAssistantState, string> = {
  IDLE: "18s",
  LISTENING: "3.2s",
  PROCESSING: "1.1s",
  RESPONDING: "9s",
};

const STATE_LABEL: Record<VoiceAssistantState, string> = {
  IDLE: "Inactivo",
  LISTENING: "Escuchando",
  PROCESSING: "Procesando",
  RESPONDING: "Respondiendo",
};

const WAVE_BARS = 28;

export function VoiceOrb({ state, onActivate, disabled, className }: VoiceOrbProps) {
  const isBusy = state === "PROCESSING";

  return (
    <div
      className={cn("relative flex flex-col items-center", className)}
      role="region"
      aria-label={`Asistente de voz — ${STATE_LABEL[state]}`}
    >
      <button
        type="button"
        onClick={onActivate}
        disabled={disabled}
        aria-label={
          state === "IDLE"
            ? "Activar asistente de voz"
            : isBusy
              ? "Procesando consulta"
              : "Estado del asistente de voz"
        }
        className={cn(
          "group relative flex size-56 items-center justify-center rounded-full outline-none sm:size-64 md:size-72",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          !isBusy && !disabled && "cursor-pointer",
        )}
      >
        {/* Glow ambiental */}
        <div
          aria-hidden="true"
          className={cn(
            "absolute -inset-14 rounded-full blur-3xl transition-opacity duration-700 motion-reduce:transition-none",
            state === "IDLE" ? "opacity-70" : "opacity-100",
          )}
          style={{ background: STATE_GLOW[state] }}
        />
        <div
          aria-hidden="true"
          className={cn(
            "absolute -inset-4 rounded-full transition-opacity duration-700 motion-reduce:transition-none",
            "voice-orb-glow",
          )}
          style={{
            background: STATE_GLOW[state],
            opacity: state === "IDLE" ? 0.4 : 0.9,
          }}
        />

        {/* Anillo conic */}
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

        {/* Anillo externo tenue */}
        <div
          aria-hidden="true"
          className="absolute inset-[3px] rounded-full border border-white/10"
        />

        {/* Núcleo oscuro */}
        <div
          className={cn(
            "absolute inset-[7px] flex items-center justify-center rounded-full transition-all duration-500",
            "bg-[#05070c]",
            state !== "IDLE" && "voice-orb-breathe",
          )}
          style={{
            boxShadow: `inset 0 0 40px rgba(0,0,0,0.85), inset 0 0 12px ${
              state === "IDLE"
                ? "rgba(56,189,248,0.15)"
                : state === "PROCESSING"
                  ? "rgba(139,92,246,0.4)"
                  : state === "RESPONDING"
                    ? "rgba(52,211,153,0.4)"
                    : "rgba(34,211,238,0.4)"
            }`,
          }}
        >
          {/* Punto central */}
          <span
            aria-hidden="true"
            className="block size-3 rounded-full transition-colors duration-500"
            style={{
              background:
                state === "IDLE"
                  ? "#22d3ee"
                  : state === "LISTENING"
                    ? "#67e8f9"
                    : state === "PROCESSING"
                      ? "#a78bfa"
                      : "#34d399",
              boxShadow:
                state === "IDLE"
                  ? "0 0 12px rgba(34,211,238,0.8)"
                  : state === "PROCESSING"
                    ? "0 0 20px rgba(167,139,250,0.9)"
                    : "0 0 20px rgba(52,211,153,0.9)",
            }}
          />
        </div>

        {/* Overlay de acción */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute -bottom-2 right-0 flex size-11 items-center justify-center rounded-full transition-all duration-300",
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

      {/* Waveform */}
      <div
        aria-hidden="true"
        className="mt-8 flex h-12 items-center gap-[3px]"
        style={{
          filter: "drop-shadow(0 0 6px rgba(34,211,238,0.35))",
        }}
      >
        {Array.from({ length: WAVE_BARS }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "w-[3px] rounded-full",
              state === "LISTENING"
                ? "voice-wave-bar bg-cyan-400"
                : state === "PROCESSING"
                  ? "voice-wave-bar bg-violet-400"
                  : state === "RESPONDING"
                    ? "voice-wave-bar bg-emerald-400"
                    : "bg-cyan-400/30",
            )}
            style={{
              height: "100%",
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
  );
}
