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
    <div className="relative min-h-screen text-foreground selection:bg-primary/20">
      {/* Fondo fotográfico médico con superposición translúcida */}
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat pointer-events-none transition-opacity duration-700"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(11, 17, 32, 0.88), rgba(11, 17, 32, 0.94)), url('/doctoria_doctor_workspace.jpg')`,
        }}
      />

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

      {/* Cajón móvil */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 border-r border-border/40 bg-surface/85 dark:bg-slate-950/85 backdrop-blur-2xl">
          <SheetHeader className="sr-only">
            <SheetTitle>Navegación DoctorIA</SheetTitle>
          </SheetHeader>
          <SidebarContent onNavigate={() => setMobileOpen(false)} isMobile={true} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
