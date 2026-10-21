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

      {/* Fondo Global Fijo con soporte Light / Dark Mode */}
      <div className="global-futuristic-bg" aria-hidden="true" />

      {/* Marca DoctorIA */}
      <div className="relative mb-6 flex flex-col items-center text-center z-10">
        <p className="mono-label text-[11px] uppercase tracking-widest text-primary font-semibold">
          DoctorIA · Acceso Seguro
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
          Portal Clínico Inteligente
        </h1>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Asistencia médica con datos protegidos y copiloto clínico interactivo.
        </p>
      </div>

      {/* Tarjeta glassmorphism */}
      <div className="relative w-full max-w-md z-10">
        <div className="clinical-glass-card rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-indigo-500 to-emerald-500" />
          {children}
        </div>
      </div>
    </div>
  );
}