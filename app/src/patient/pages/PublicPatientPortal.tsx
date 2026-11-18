import { useState, useMemo, useEffect } from "react";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useQuery, getPublicSpecialistsDirectory } from "wasp/client/operations";
import {
  PATIENT_ATTENTION_CATEGORIES,
  filterDoctorsByCategory,
} from "../patientCategories";
import { saveAppointmentIntent } from "../appointmentIntent";
import {
  DEFAULT_CLINICAL_FACILITY,
  EMERGENCY_ALERT_NOTICE,
} from "../constants";
import { SpecialistGridSkeleton } from "../components/SpecialistCardSkeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../client/components/ui/card";
import { Button } from "../../client/components/ui/button";
import { Badge } from "../../client/components/ui/badge";
import { AppFooterBar } from "../../client/components/AppFooterBar";
import {
  CalendarPlus,
  Clock,
  MapPin,
  ShieldCheck,
  Stethoscope,
  Sparkles,
  AlertCircle,
  RefreshCw,
  LogIn,
  HeartPulse,
  PhoneCall,
  UserPlus,
  AlertTriangle,
} from "lucide-react";

/**
 * Avatar local generado estrictamente con las iniciales del profesional.
 * CERO peticiones a servicios o CDNs externos (privacidad y rendimiento).
 */
export function SpecialistAvatar({ fullName }: { fullName: string }) {
  const initials = useMemo(() => {
    if (!fullName) return "MD";
    const cleaned = fullName.replace(/^(dr\.|dra\.|lic\.|msc\.|prof\.)\s+/i, "").trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "MD";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [fullName]);

  return (
    <div
      className="size-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm shrink-0 select-none shadow-xs"
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export function PublicPatientPortal() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isSlowLoading, setIsSlowLoading] = useState(false);

  const {
    data: rawSpecialists,
    isLoading,
    error,
    refetch,
  } = useQuery(getPublicSpecialistsDirectory, {}, {
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Detección de lentitud de red / cold-start (~8 segundos)
  useEffect(() => {
    if (!isLoading) {
      setIsSlowLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsSlowLoading(true);
    }, 8000);

    return () => clearTimeout(timer);
  }, [isLoading]);

  const specialists = Array.isArray(rawSpecialists) ? rawSpecialists : [];

  const filteredSpecialists = useMemo(() => {
    return filterDoctorsByCategory(specialists, selectedCategory);
  }, [specialists, selectedCategory]);

  const isUrgenciasSelected = selectedCategory === "urgencias";

  const handleScheduleClick = (categoryId?: string) => {
    const targetCategory = categoryId && categoryId !== "all" && categoryId !== "urgencias"
      ? categoryId
      : selectedCategory !== "all" && selectedCategory !== "urgencias"
      ? selectedCategory
      : "general";

    saveAppointmentIntent(targetCategory);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8 animate-in fade-in duration-300">
      {/* 1. Aviso Institucional Permanente de Emergencias (ECU 911) */}
      <aside
        aria-label="Aviso de Emergencias Médicas"
        className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs sm:text-sm text-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
      >
        <div className="flex items-start sm:items-center gap-2.5">
          <AlertTriangle className="size-5 text-rose-500 shrink-0 mt-0.5 sm:mt-0" />
          <div className="space-y-0.5">
            <p className="font-bold text-rose-500 text-xs uppercase tracking-wider">
              {EMERGENCY_ALERT_NOTICE.badge}
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {EMERGENCY_ALERT_NOTICE.message}
            </p>
          </div>
        </div>
        <a
          href={`tel:${EMERGENCY_ALERT_NOTICE.phone}`}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition-colors shrink-0 min-h-[44px] min-w-[44px]"
        >
          <PhoneCall className="size-3.5" />
          <span>{EMERGENCY_ALERT_NOTICE.callActionLabel}</span>
        </a>
      </aside>

      {/* 2. Encabezado Principal y Bienvenida (Contenido Veraz) */}
      <header className="relative rounded-2xl border border-outline-variant bg-surface/90 p-6 sm:p-8 lg:p-10 shadow-sm backdrop-blur-md overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
            <HeartPulse className="size-3.5 text-primary animate-pulse" />
            <span>Portal Oficial del Paciente</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
            Consulta externa programada y{" "}
            <span className="text-gradient-primary">seguimiento de citas</span>
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Revisa los especialistas disponibles para consulta externa, solicita tu turno y accede a tu historial de citas médicas e indicaciones confirmadas por tu médico tratante.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="gap-2 font-semibold shadow-md min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary"
              asChild
            >
              <WaspRouterLink
                to={routes.LoginRoute.to}
                onClick={() => handleScheduleClick()}
              >
                <CalendarPlus className="size-4" />
                Agendar Cita Médica
              </WaspRouterLink>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="gap-2 text-muted-foreground hover:text-foreground min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary"
              asChild
            >
              <WaspRouterLink to={routes.SignupRoute.to}>
                <UserPlus className="size-4" />
                Registrarme
              </WaspRouterLink>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground hover:text-primary min-h-[44px]"
              asChild
            >
              <WaspRouterLink to={routes.LoginRoute.to}>
                <LogIn className="size-3.5" />
                Acceso a mi Historial
              </WaspRouterLink>
            </Button>
          </div>
        </div>
      </header>

      {/* 3. Selector de Necesidades de Atención */}
      <section aria-labelledby="categories-heading" className="space-y-4">
        <div>
          <h2 id="categories-heading" className="text-xl font-bold tracking-tight text-foreground">
            Necesidades de Atención
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Selecciona un área de atención para filtrar a los profesionales de consulta externa
          </p>
        </div>

        <div
          role="group"
          aria-label="Filtro de especialidades de atención"
          className="flex flex-wrap gap-2.5 pt-1"
        >
          {PATIENT_ATTENTION_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={`cat-btn-${cat.id}`}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all cursor-pointer min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/40"
                    : "bg-surface border border-outline-variant text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. Directorio de Especialistas */}
      <section aria-labelledby="specialists-heading" className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 id="specialists-heading" className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Stethoscope className="size-5 text-primary" />
            Directorio de especialistas
          </h2>
          <span className="text-xs text-muted-foreground">
            {!isLoading && (
              filteredSpecialists.length === 0
                ? "0 disponibles"
                : `${filteredSpecialists.length} especialista${filteredSpecialists.length === 1 ? "" : "s"} disponible${filteredSpecialists.length === 1 ? "" : "s"}`
            )}
          </span>
        </div>

        {/* Estado: Latencia Prolongada (~8s) */}
        {isLoading && isSlowLoading && (
          <div
            role="status"
            className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-xs text-foreground flex items-center justify-between gap-3 animate-in fade-in"
          >
            <div className="flex items-center gap-2">
              <span className="size-2 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0" />
              <span>La consulta está tomando más tiempo del habitual. Conectando con la clínica...</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              className="text-xs min-h-[44px]"
            >
              <RefreshCw className="size-3.5 mr-1" />
              Reintentar
            </Button>
          </div>
        )}

        {/* Estado: Cargando (Skeletons) */}
        {isLoading && <SpecialistGridSkeleton count={3} />}

        {/* Estado: Error */}
        {!isLoading && error && (
          <div
            role="alert"
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center space-y-3"
          >
            <AlertCircle className="size-8 text-amber-500 mx-auto" />
            <p className="text-sm font-semibold text-foreground">
              No pudimos cargar la lista de especialistas en este momento.
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Puedes agendar tu consulta médica directamente o intentar consultar la disponibilidad nuevamente.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="gap-2 text-xs min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Reintentar cargar especialistas"
              >
                <RefreshCw className="size-3.5" />
                Reintentar
              </Button>
              <Button
                size="sm"
                className="gap-2 text-xs min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary"
                asChild
              >
                <WaspRouterLink
                  to={routes.LoginRoute.to}
                  onClick={() => handleScheduleClick()}
                >
                  <CalendarPlus className="size-3.5" />
                  Agendar Consulta
                </WaspRouterLink>
              </Button>
            </div>
          </div>
        )}

        {/* Caso Especial: Categoría Urgencias Seleccionada (No admite agendamiento web) */}
        {!isLoading && !error && isUrgenciasSelected && (
          <Card className="border-rose-500/30 bg-rose-500/5 p-6 text-center">
            <CardContent className="space-y-4 pt-4">
              <div className="size-12 rounded-full bg-rose-500/10 text-rose-500 mx-auto flex items-center justify-center">
                <AlertTriangle className="size-6" />
              </div>
              <CardTitle className="text-lg font-bold text-foreground">
                Urgencias Médicas: No requiere agendamiento web
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto">
                {EMERGENCY_ALERT_NOTICE.subtext} Si requieres atención urgente, acude directamente a nuestro centro hospitalario o comunícate con el ECU 911.
              </CardDescription>
              <div className="pt-2 flex justify-center">
                <a
                  href={`tel:${EMERGENCY_ALERT_NOTICE.phone}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition-colors min-h-[44px]"
                >
                  <PhoneCall className="size-4" />
                  Llamar al ECU 911
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estado Vacío (a): No hay especialistas publicados en la plataforma */}
        {!isLoading && !error && !isUrgenciasSelected && specialists.length === 0 && (
          <Card className="border-dashed border-outline-variant bg-surface/40 p-8 text-center">
            <CardContent className="space-y-3 pt-6">
              <div className="size-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                <Sparkles className="size-6" />
              </div>
              <CardTitle className="text-lg font-bold text-foreground">
                Consulta Externa Disponible
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm max-w-md mx-auto text-muted-foreground">
                No hay especialistas publicados en este momento en el directorio abierto. Puedes agendar tu cita seleccionando el área de atención requerida para que el equipo médico asigne tu turno.
              </CardDescription>
              <div className="pt-4 flex justify-center">
                <Button
                  className="gap-2 font-semibold text-xs min-h-[44px] px-5 focus-visible:ring-2 focus-visible:ring-primary"
                  asChild
                >
                  <WaspRouterLink
                    to={routes.LoginRoute.to}
                    onClick={() => handleScheduleClick(selectedCategory !== "all" ? selectedCategory : "general")}
                  >
                    <CalendarPlus className="size-4" />
                    Agendar Cita Médica
                  </WaspRouterLink>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estado Vacío (b): Hay especialistas en el sistema, pero NINGUNO coincide con el filtro */}
        {!isLoading && !error && !isUrgenciasSelected && specialists.length > 0 && filteredSpecialists.length === 0 && (
          <Card className="border-dashed border-outline-variant bg-surface/40 p-8 text-center">
            <CardContent className="space-y-3 pt-6">
              <div className="size-12 rounded-full bg-muted/60 text-muted-foreground mx-auto flex items-center justify-center">
                <Stethoscope className="size-6" />
              </div>
              <CardTitle className="text-base font-bold text-foreground">
                No se encontraron especialistas en la categoría seleccionada
              </CardTitle>
              <CardDescription className="text-xs max-w-md mx-auto text-muted-foreground">
                No hay profesionales listados para este filtro en este momento. Puedes limpiar el filtro para ver todos los especialistas disponibles o agendar tu cita general.
              </CardDescription>
              <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSelectedCategory("all")}
                  className="gap-2 text-xs min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Ver todas las especialidades
                </Button>
                <Button
                  className="gap-2 font-semibold text-xs min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary"
                  asChild
                >
                  <WaspRouterLink
                    to={routes.LoginRoute.to}
                    onClick={() => handleScheduleClick("general")}
                  >
                    <CalendarPlus className="size-4" />
                    Agendar Cita General
                  </WaspRouterLink>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estado: Lista con Especialistas coincidentes */}
        {!isLoading && !error && !isUrgenciasSelected && filteredSpecialists.length > 0 && (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            aria-live="polite"
          >
            {filteredSpecialists.map((doc, idx) => (
              <Card
                key={`specialist-${doc.fullName}-${idx}`}
                className="border-outline-variant bg-surface/80 hover:border-primary/50 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start gap-3">
                    <SpecialistAvatar fullName={doc.fullName} />
                    <div className="space-y-1 flex-1 min-w-0">
                      <h3 className="font-bold text-foreground text-base truncate" title={doc.fullName}>
                        {doc.fullName}
                      </h3>
                      <Badge
                        variant="secondary"
                        className="text-[11px] font-medium bg-primary/10 text-primary border-primary/20"
                      >
                        {doc.specialty}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-4">
                  <div className="space-y-1.5 pt-2 border-t border-outline-variant/50 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 truncate" title={doc.location || DEFAULT_CLINICAL_FACILITY.location}>
                      <MapPin className="size-3.5 text-primary shrink-0" />
                      <span className="truncate">{doc.location || DEFAULT_CLINICAL_FACILITY.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate" title={doc.generalHours || DEFAULT_CLINICAL_FACILITY.generalHours}>
                      <Clock className="size-3.5 text-primary shrink-0" />
                      <span className="truncate">{doc.generalHours || DEFAULT_CLINICAL_FACILITY.generalHours}</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full gap-2 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10 hover:text-primary transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary"
                    asChild
                  >
                    <WaspRouterLink
                      to={routes.LoginRoute.to}
                      onClick={() => handleScheduleClick(selectedCategory)}
                    >
                      <CalendarPlus className="size-3.5" />
                      Agendar Cita
                    </WaspRouterLink>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 5. Barra de Acceso para Profesionales y Personal de Salud */}
      <section aria-labelledby="staff-access-heading">
        <Card className="border-outline-variant bg-surface/40 hover:bg-surface/60 transition-colors">
          <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 text-center sm:text-left">
              <div className="size-10 rounded-xl bg-muted/60 text-muted-foreground flex items-center justify-center shrink-0 border border-outline-variant">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h2 id="staff-access-heading" className="text-sm font-bold text-foreground">
                  ¿Eres médico, personal de secretaría o administrador?
                </h2>
                <p className="text-xs text-muted-foreground">
                  Ingresa con tus credenciales asignadas para acceder a la estación de trabajo clínica.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-2 text-xs font-semibold min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary"
              asChild
            >
              <WaspRouterLink to={routes.LoginRoute.to}>
                <LogIn className="size-3.5" />
                Acceso Profesionales
              </WaspRouterLink>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* 6. Pie de Página con enlace legal/privacidad */}
      <footer className="pt-6 border-t border-outline-variant/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} DoctorIA. Asistencia clínica informativa.</p>
        <div className="flex items-center gap-4">
          <a
            href="#privacidad"
            className="hover:text-foreground transition-colors underline-offset-4 hover:underline min-h-[44px] inline-flex items-center"
          >
            Aviso de Privacidad
          </a>
          <WaspRouterLink
            to={routes.LoginRoute.to}
            className="hover:text-foreground transition-colors min-h-[44px] inline-flex items-center"
          >
            Acceso Profesionales
          </WaspRouterLink>
        </div>
      </footer>

      <AppFooterBar className="mt-4" />
    </div>
  );
}
