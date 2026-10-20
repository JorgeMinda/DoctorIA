import { Link, useLocation } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRole } from "../../hooks/useRole";
import logo from "../../static/logo.jpeg";
import { cn } from "../../utils";
import { Button } from "../ui/button";
import {
  getNavGroupsForRole,
  isClinicalNavItemActive,
} from "./nav-items";

interface SidebarContentProps {
  onNavigate?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isMobile?: boolean;
}

export function SidebarContent({
  onNavigate,
  isExpanded = true,
  onToggleExpand,
  isMobile = false,
}: SidebarContentProps) {
  const location = useLocation();
  const { user, role } = useRole();
  const navGroups = getNavGroupsForRole(role);

  return (
    <div className="relative flex h-full flex-col overflow-hidden backdrop-blur-2xl">
      {/* Reflejo de luz especular superior (estilo glassmorphism) */}
      <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-36 rotate-12 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Header con botones estilo macOS y logo */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border/40 px-4">
        <div className="flex items-center gap-3 overflow-hidden">
          {/* Botones de ventana tipo macOS */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="size-2.5 rounded-full bg-rose-500/80 transition-transform hover:scale-110" />
            <span className="size-2.5 rounded-full bg-amber-500/80 transition-transform hover:scale-110" />
            <span className="size-2.5 rounded-full bg-emerald-500/80 transition-transform hover:scale-110" />
          </div>

          {(isExpanded || isMobile) && (
            <div className="flex items-center gap-2.5 pl-2 overflow-hidden transition-all duration-300">
              <img src={logo} alt="DoctorIA" className="size-7 rounded-md shadow-sm shrink-0" />
              <div className="flex flex-col leading-tight min-w-0">
                <span className="text-foreground font-bold tracking-tight text-sm truncate">DoctorIA</span>
                <span className="mono-label text-muted-foreground text-[9px] uppercase tracking-widest truncate">
                  Clinical AI
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Botón toggle expandir/colapsar (solo visible en desktop) */}
        {!isMobile && onToggleExpand && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleExpand}
            className="size-7 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors shrink-0"
            title={isExpanded ? "Colapsar menú" : "Expandir menú"}
          >
            {isExpanded ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
        )}
      </div>

      {/* Navegación */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            {(isExpanded || isMobile) && (
              <p className="mono-label text-muted-foreground/70 px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider">
                {group.label}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isClinicalNavItemActive(location.pathname, item.to);
                return (
                  <li key={item.name}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      title={!isExpanded && !isMobile ? item.name : undefined}
                      className={cn(
                        "group relative flex items-center rounded-xl border border-transparent text-sm font-medium transition-all duration-200",
                        isExpanded || isMobile
                          ? "gap-3 px-3 py-2.5"
                          : "justify-center p-2.5",
                        active
                          ? "border-primary/30 bg-primary/15 text-primary shadow-[0_0_20px_rgba(0,218,243,0.2)] font-semibold backdrop-blur-md"
                          : "text-muted-foreground hover:bg-white/10 dark:hover:bg-white/5 hover:text-foreground",
                      )}
                    >
                      <item.icon className="size-5 shrink-0 transition-transform group-hover:scale-105" aria-hidden />
                      {(isExpanded || isMobile) && (
                        <span className="truncate">{item.name}</span>
                      )}
                      {active && (
                        <span
                          className={cn(
                            "rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)]",
                            isExpanded || isMobile ? "ml-auto size-2" : "absolute right-1.5 top-1.5 size-1.5",
                          )}
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Perfil del profesional */}
      {user && (
        <div className="shrink-0 border-t border-border/40 p-3">
          <div
            className={cn(
              "flex items-center rounded-xl bg-white/5 dark:bg-white/5 p-2 transition-all",
              isExpanded || isMobile ? "gap-3" : "justify-center",
            )}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/15 text-xs font-bold uppercase text-primary shadow-sm">
              {(user.username ?? "?").slice(0, 2)}
            </div>
            {(isExpanded || isMobile) && (
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-xs font-semibold">
                  {user.username}
                </p>
                <p className="mono-label text-muted-foreground truncate text-[10px]">
                  {user.email}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function Sidebar({ isExpanded, onToggleExpand }: SidebarProps) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden border-r border-border/40 lg:block transition-all duration-300 ease-in-out",
        "bg-surface/75 dark:bg-slate-950/75 backdrop-blur-2xl shadow-2xl",
        isExpanded ? "w-72" : "w-20",
      )}
    >
      <SidebarContent isExpanded={isExpanded} onToggleExpand={onToggleExpand} />
    </aside>
  );
}
