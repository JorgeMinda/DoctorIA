import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { Button } from "../../client/components/ui/button";

/**
 * CTA final de la landing: cierra el recorrido con la acción principal.
 * Reutiliza el botón "Comenzar" del hero sin duplicar secciones.
 */
export function FinalCTA() {
  return (
    <section className="mx-auto mt-16 max-w-7xl px-6 md:mt-24 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-8 text-center shadow-2xl shadow-black/25 md:p-14 lg:p-16">
        {/* Glow ambiental */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 -top-24 h-48 bg-linear-to-tr from-cyan-400/20 via-blue-400/10 to-violet-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-400/40 to-transparent"
        />

        <div className="relative">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-1.5">
            <span className="ambient-pulse-dot size-1.5 rounded-full bg-cyan-400" />
            <span className="text-cyan-300 text-xs font-semibold tracking-[0.22em]">
              DOCTORIA
            </span>
          </div>

          <h2 className="text-foreground mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Empieza a estructurar tu práctica clínica con{" "}
            <span className="text-gradient-primary ambient-shimmer">
              asistencia de IA
            </span>
          </h2>

          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-base leading-7 md:text-lg">
            Menos tipeo, más tiempo de atención. Crea tu cuenta y comienza hoy.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-x-6 gap-y-3 sm:flex-row">
            <Button
              size="lg"
              variant="default"
              className="bg-cyan-400 text-slate-950 shadow-[0_0_24px_rgba(54,199,244,0.35)] transition-all duration-300 hover:bg-cyan-300 hover:shadow-[0_0_36px_rgba(54,199,244,0.55)]"
              asChild
            >
              <WaspRouterLink to={routes.ClinicalVoiceRoute.to}>
                Comenzar <span aria-hidden="true">→</span>
              </WaspRouterLink>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-border/60 text-foreground hover:border-cyan-400/30 hover:bg-cyan-400/5"
              asChild
            >
              <WaspRouterLink to={routes.LoginRoute.to}>
                Iniciar sesión
              </WaspRouterLink>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}