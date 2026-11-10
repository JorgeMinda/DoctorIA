import { cn } from "../utils";

export function AppFooterBar({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "mt-8 flex flex-col gap-1.5 border-t border-border/60 bg-surface/70 px-4 py-3 text-[11px] text-muted-foreground backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:text-xs lg:px-8",
        className,
      )}
    >
      <span>
        © 2026 DoctorIA — Todos los derechos
        reservados.
      </span>
      <span className="flex gap-4">
        <a href="#" className="transition-colors duration-200 hover:text-primary">
          Política de Privacidad
        </a>
        <a href="#" className="transition-colors duration-200 hover:text-primary">
          Términos de Servicio
        </a>
      </span>
    </footer>
  );
}