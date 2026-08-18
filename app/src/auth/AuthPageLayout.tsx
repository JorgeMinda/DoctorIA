import { ReactNode } from "react";
import { Mic } from "lucide-react";
import { AUTH_AMBIENT_STYLE } from "./ambientAuthTheme";

export function AuthPageLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-login-ambient
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12"
    >
      <style>{AUTH_AMBIENT_STYLE}</style>
      {/* Gradientes ambientales cyan / violeta / verde */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 size-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -right-24 top-1/3 size-96 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 size-96 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      {/* Marca */}
      <div className="relative mb-8 flex flex-col items-center text-center">
        <p className="mono-label text-[11px] uppercase tracking-widest text-cyan-400">
          DoctorIA
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          Ambient Voice Interface
        </h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Historia clínica asistida por voz e inteligencia artificial.
        </p>
      </div>

      {/* Orbe decorativo (solo visual, no interactivo) */}
      <div
        aria-hidden="true"
        className="relative mb-10 flex flex-col items-center"
      >
        <div
          className="absolute -inset-10 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(54,199,244,0.14) 0%, rgba(139,124,255,0.06) 45%, transparent 70%)",
          }}
        />
        <div className="relative flex size-32 items-center justify-center rounded-full">
          <div
            className="voice-orb-ring absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, #36C7F4, #5D8CFF, #8B7CFF, #35D6A5, #36C7F4)",
              animationDuration: "18s",
              animationIterationCount: "infinite",
              filter: "blur(0.5px)",
            }}
          />
          <div className="absolute inset-[3px] rounded-full border border-white/10" />
          <div className="absolute inset-[8px] flex items-center justify-center rounded-full bg-[#050B14]">
            <Mic className="size-6 text-cyan-400" />
          </div>
        </div>
        <div
          className="mt-6 flex h-8 items-center gap-[3px] opacity-40"
          style={{ filter: "drop-shadow(0 0 6px rgba(54,199,244,0.35))" }}
        >
          {Array.from({ length: 28 }).map((_, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-cyan-400"
              style={{
                height: "100%",
                animation: `voice-wave-bar ${1.4 + (i % 7) * 0.18}s ease-in-out ${
                  i * 0.06
                }s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Tarjeta glass */}
      <div className="relative w-full max-w-md">
        <div className="glass-panel rounded-2xl px-6 py-8 shadow-2xl sm:px-10">
          {children}
        </div>
      </div>
    </div>
  );
}