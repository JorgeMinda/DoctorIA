import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { Button } from "../../client/components/ui/button";
import {
  AMBIENT_MESSAGE,
  AmbientBadgeIcon,
  useAmbientDemo,
  VoiceOrbHero,
} from "./VoiceOrbHero";

export function Hero() {
  const { state, activate } = useAmbientDemo();

  return (
    <div className="relative w-full pt-16 md:pt-20">
      <AmbientGradients />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 pb-12 lg:min-h-[80vh] lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:px-8 lg:pb-16">
        {/* Contenido */}
        <div className="order-1 text-center lg:text-left">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-1.5">
            <AmbientBadgeIcon state={state} />
            <span className="text-cyan-300 text-xs font-semibold tracking-[0.22em]">
              DOCTORIA
            </span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-muted-foreground text-xs font-medium tracking-[0.22em]">
              ASISTENCIA DE IA
            </span>
          </div>

          <h1 className="text-foreground text-5xl font-bold tracking-tight sm:text-6xl">
            Historias clínicas con{" "}
            <span className="text-gradient-primary ambient-shimmer">
              asistencia de IA
            </span>
          </h1>

          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg leading-7 lg:mx-0">
            DoctorIA estructura las notas clínicas y epicrisis de tus
            pacientes: menos tipeo, más tiempo de atención.
          </p>

          <div className="mt-8 flex items-center justify-center gap-x-6 lg:justify-start">
            <Button
              size="lg"
              variant="default"
              className="bg-cyan-400 text-slate-950 shadow-[0_0_24px_rgba(54,199,244,0.35)] transition-all duration-300 hover:bg-cyan-300 hover:shadow-[0_0_36px_rgba(54,199,244,0.55)]"
              asChild
            >
              <WaspRouterLink to={routes.SignupRoute.to}>
                Comenzar <span aria-hidden="true">→</span>
              </WaspRouterLink>
            </Button>
          </div>
        </div>

        {/* Voice Orb */}
        <div className="order-2 flex flex-col items-center">
          <VoiceOrbHero state={state} onActivate={activate} />
          <p
            aria-live="polite"
            className="text-muted-foreground mt-5 max-w-xs text-center text-sm leading-6"
          >
            {AMBIENT_MESSAGE[state]}
          </p>
          <p className="text-muted-foreground/70 mt-1.5 text-xs">
            Toca el orbe para probar la interfaz de voz.
          </p>
        </div>
      </div>
    </div>
  );
}

function AmbientGradients() {
  return (
    <>
      <div
        className="absolute right-0 top-0 -z-10 w-full transform-gpu overflow-hidden blur-3xl"
        aria-hidden="true"
      >
        <div
          className="aspect-1020/880 w-280 flex-none bg-linear-to-tr from-cyan-400/25 to-violet-400/25 opacity-20 sm:right-1/4 sm:translate-x-1/2"
          style={{
            clipPath:
              "polygon(80% 20%, 90% 55%, 50% 100%, 70% 30%, 20% 50%, 50% 0)",
          }}
        />
      </div>
      <div
        className="absolute inset-x-0 top-[calc(100%-40rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-65rem)]"
        aria-hidden="true"
      >
        <div
          className="aspect-1020/880 w-360 bg-linear-to-br relative from-blue-400/20 to-emerald-400/20 opacity-20 sm:-left-3/4 sm:translate-x-1/4"
          style={{
            clipPath: "ellipse(80% 30% at 80% 50%)",
          }}
        />
      </div>
    </>
  );
}
