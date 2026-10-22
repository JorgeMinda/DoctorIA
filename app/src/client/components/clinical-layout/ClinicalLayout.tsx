import { useState, type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Sidebar, SidebarContent } from "./Sidebar";
import { Topbar } from "./Topbar";
import { cn } from "../../utils";

export function ClinicalLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("doctoria_sidebar_expanded");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });

  const toggleExpanded = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("doctoria_sidebar_expanded", String(next));
      }
      return next;
    });
  };

  return (
    <div className="relative min-h-screen text-slate-900 dark:text-slate-100 selection:bg-cyan-500/20 bg-transparent transition-colors duration-300">
      {/* Fondo Global Fijo con soporte Cockpit Holográfico y Glassmorphism */}
      <div className="global-futuristic-bg" aria-hidden="true" />

      {/* Contenido en capa superior */}
      <div className="relative z-10">
        {/* Sidebar Expandible con Glassmorphism */}
        <Sidebar isExpanded={isExpanded} onToggleExpand={toggleExpanded} />

        {/* Área principal con padding adaptativo */}
        <div
          className={cn(
            "transition-[padding] duration-300 ease-in-out",
            isExpanded ? "lg:pl-72" : "lg:pl-20",
          )}
        >
          <Topbar onOpenMobile={() => setMobileOpen(true)} />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>

      {/* Cajón móvil */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 border-r border-slate-200/70 dark:border-white/10 bg-white/95 dark:bg-slate-950/90 backdrop-blur-2xl text-slate-900 dark:text-slate-100">
          <SheetHeader className="sr-only">
            <SheetTitle>Navegación DoctorIA</SheetTitle>
          </SheetHeader>
          <SidebarContent onNavigate={() => setMobileOpen(false)} isMobile={true} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
