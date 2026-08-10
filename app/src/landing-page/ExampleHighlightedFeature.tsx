import { Bot, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { HighlightedFeature } from "./components/HighlightedFeature";

export function AIReady() {
  return (
    <HighlightedFeature
      name="Epicrisis asistida por IA"
      description={
        <span className="text-muted-foreground mt-4 text-base leading-7 sm:text-lg">
          Genera el borrador de la epicrisis a partir de las notas clínicas del
          paciente. El médico valida cada campo y confirma cuando está lista.
        </span>
      }
      highlightedComponent={<EpicrisisMockup />}
      direction="row-reverse"
    />
  );
}

function EpicrisisMockup() {
  const fields = [
    { label: "Motivo de ingreso", value: "Dolor torácico atípico" },
    { label: "Antecedentes", value: "Hipertensión controlada" },
    { label: "Evolución", value: "Estable, sin recurrencia" },
    { label: "Condición al egreso", value: "Estable" },
  ];

  return (
    <div className="relative w-full max-w-md">
      {/* Glow ambiental sutil */}
      <div
        aria-hidden="true"
        className="absolute -inset-6 -z-10 rounded-3xl bg-linear-to-br from-cyan-400/10 via-blue-400/10 to-violet-400/10 blur-2xl"
      />

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/30 backdrop-blur">
        {/* Línea superior con gradiente sutil */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-400/40 to-transparent"
        />

        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-cyan-400/10 ring-1 ring-cyan-400/20">
              <Sparkles className="size-4 text-cyan-300" />
            </span>
            <span className="text-foreground text-sm font-semibold">
              Borrador de epicrisis
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1">
            <span className="ambient-pulse-dot size-1.5 rounded-full bg-emerald-400" />
            <span className="text-emerald-300 text-[10px] font-semibold tracking-wider uppercase">
              IA activa
            </span>
          </span>
        </div>

        <div className="space-y-2.5">
          {fields.map((field, idx) => (
            <div
              key={field.label}
              className="group rounded-xl border border-border/60 bg-card-subtle/60 p-3.5 transition-all duration-300 hover:border-cyan-400/20 hover:bg-card-subtle"
            >
              <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                {field.label}
              </p>
              <p className="text-foreground mt-1 text-sm leading-6">
                {field.value}
              </p>
              {idx < fields.length - 1 && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-cyan-400/30">✓</span>
                  <span className="text-cyan-300/40 text-[10px]">
                    verificado por DoctorIA
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
            <ShieldCheck className="size-3.5 text-cyan-300/70" />
            Listo para revisión médica
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
            <CheckCircle2 className="size-4" />
            Confirmar
          </span>
        </div>

        {/* Firma IA en la base */}
        <div className="mt-4 flex items-center gap-1.5 border-t border-border/40 pt-3">
          <Bot className="size-3.5 text-violet-300/60" />
          <span className="text-muted-foreground/70 text-[11px]">
            Borrador generado por DoctorIA · datos sintéticos de demostración
          </span>
        </div>
      </div>
    </div>
  );
}
