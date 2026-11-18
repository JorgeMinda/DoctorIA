import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "wasp/client/operations";
import { getPublicSpecialistsDirectory } from "wasp/client/operations";
import {
  PATIENT_ATTENTION_CATEGORIES,
  filterDoctorsByCategory,
} from "../patientCategories";
import { saveAppointmentIntent } from "../appointmentIntent";
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
} from "lucide-react";

/**
 * Avatar local generado estrictamente con las iniciales del profesional.
 * CERO peticiones a servicios o CDNs externos (privacidad y performance).
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
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const {
    data: rawSpecialists,
    isLoading,
    error,
    refetch,
  } = useQuery(getPublicSpecialistsDirectory, {}, {
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const specialists = Array.isArray(rawSpecialists) ? rawSpecialists : [];

  const filteredSpecialists = useMemo(() => {
    return filterDoctorsByCategory(specialists, selectedCategory);
  }, [specialists, selectedCategory]);

  const handleScheduleClick = (categoryId?: string) => {
    const targetCategory = categoryId && categoryId !== "all"
      ? categoryId
      : selectedCategory !== "all"
      ? selectedCategory
      : "general";

    saveAppointmentIntent(targetCategory);
    navigate("/login");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-10 p-4 sm:p-6 lg:p-8 animate-in fade-in duration-300">
      {/* 1. Encabezado Principal y Bienvenida */}
      <header className="relative rounded-2xl border border-outline-variant bg-surface/90 p-6 sm:p-8 lg:p-10 shadow-sm backdrop-blur-md overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
            <HeartPulse className="size-3.5 text-primary animate-pulse" />
            <span>Portal Oficial del Paciente</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
            Atención médica de calidad con{" "}
            <span className="text-gradient-primary">precisión y calidez</span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            Consulta los profesionales disponibles, selecciona el área de atención requerida y agenda tu cita médica de manera rápida y segura.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="gap-2 font-semibold shadow-md"
              onClick={() => handleScheduleClick()}
            >
              <CalendarPlus className="size-4" />
              Agendar Cita Médica
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="gap-2 text-muted-foreground hover:text-foreground"
              asChild
            >
              <Link to="/login">
                <LogIn className="size-4" />
                Acceso a mi Historial
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* 2. Selector de Necesidades de Atención */}
      <section aria-labelledby="categories-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 id="categories-heading" className="text-xl font-bold tracking-tight text-foreground">
              Necesidades de Atención
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Filtra por especialidad para encontrar al profesional adecuado
            </p>
          </div>
        </div>

        <div
          role="group"
          aria-label="Filtro de especialidades de atención"
          className="flex flex-wrap gap-2 pt-1"
        >
          {PATIENT_ATTENTION_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30"
                    : "bg-surface border border-outline-variant text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Directorio de Especialistas */}
      <section aria-labelledby="specialists-heading" className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 id="specialists-heading" className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Stethoscope className="size-5 text-primary" />
            Especialistas de Turno
          </h2>
          <span className="text-xs text-muted-foreground">
            {!isLoading && `${filteredSpecialists.length} disponible${filteredSpecialists.length === 1 ? "" : "s"}`}
          </span>
        </div>

        {/* Estado: Cargando */}
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
            <div className="pt-2 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="gap-2 text-xs"
                aria-label="Reintentar cargar especialistas"
              >
                <RefreshCw className="size-3.5" />
                Reintentar
              </Button>
              <Button
                size="sm"
                onClick={() => handleScheduleClick()}
                className="gap-2 text-xs"
              >
                <CalendarPlus className="size-3.5" />
                Agendar Consulta
              </Button>
            </div>
          </div>
        )}

        {/* Estado: Lista Vacía Segura */}
        {!isLoading && !error && filteredSpecialists.length === 0 && (
          <Card className="border-dashed border-outline-variant bg-surface/40 p-8 text-center">
            <CardContent className="space-y-3 pt-6">
              <div className="size-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                <Sparkles className="size-6" />
              </div>
              <CardTitle className="text-lg font-bold text-foreground">
                Consulta Externa Disponible
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm max-w-md mx-auto">
                {selectedCategory !== "all"
                  ? "No se registran médicos activos en esta categoría específica en este momento. Puedes agendar tu consulta en el área general o consultar otras opciones."
                  : "Horarios y especialidades disponibles para consulta externa. Puedes agendar tu cita seleccionando el área de atención requerida."}
              </CardDescription>
              <div className="pt-4 flex justify-center">
                <Button
                  onClick={() => handleScheduleClick(selectedCategory !== "all" ? selectedCategory : "general")}
                  className="gap-2 font-semibold text-xs h-10 px-5"
                >
                  <CalendarPlus className="size-4" />
                  Agendar en esta Especialidad
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estado: Lista con Especialistas */}
        {!isLoading && !error && filteredSpecialists.length > 0 && (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            aria-live="polite"
          >
            {filteredSpecialists.map((doc, idx) => (
              <Card
                key={`${doc.fullName}-${idx}`}
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
                    <div className="flex items-center gap-1.5 truncate" title={doc.location}>
                      <MapPin className="size-3.5 text-primary shrink-0" />
                      <span className="truncate">{doc.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate" title={doc.generalHours}>
                      <Clock className="size-3.5 text-primary shrink-0" />
                      <span className="truncate">{doc.generalHours}</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full gap-2 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10 hover:text-primary transition-colors h-9"
                    onClick={() => handleScheduleClick(selectedCategory)}
                  >
                    <CalendarPlus className="size-3.5" />
                    Agendar Cita
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 4. Barra de Acceso para Profesionales y Personal de Salud */}
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
              className="shrink-0 gap-2 text-xs font-semibold"
              asChild
            >
              <Link to="/login">
                <LogIn className="size-3.5" />
                Acceso Profesionales
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* 5. Pie de Página */}
      <AppFooterBar className="mt-8" />
    </div>
  );
}
