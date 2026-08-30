import { useState } from "react";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  User,
  Plus,
  ExternalLink,
  Edit3,
  Activity,
  XCircle,
  Download,
} from "lucide-react";
import { Button } from "../../client/components/ui/button";
import { Badge } from "../../client/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../client/components/ui/card";
import { citaStatusLabel } from "../services/statusLabels";
import { generateIcsFile, downloadIcsFile } from "../../shared/utils/icsGenerator";
import { toast } from "../../client/hooks/use-toast";

export type CalendarViewMode = "day" | "week" | "month" | "year" | "list";

interface CalendarViewProps {
  citas: any[];
  onSelectCita?: (cita: any) => void;
  onNewCitaAtDate?: (date: Date) => void;
  onEditCita?: (cita: any) => void;
  onRunTransition?: (citaId: string, status: string, label: string) => Promise<void>;
  busyCitaId?: string | null;
}

export function ClinicalCalendarView({
  citas,
  onSelectCita,
  onNewCitaAtDate,
  onEditCita,
  onRunTransition,
  busyCitaId,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");

  // Navegación de fechas
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === "day") d.setDate(d.getDate() - 1);
    else if (viewMode === "week") d.setDate(d.getDate() - 7);
    else if (viewMode === "month") d.setMonth(d.getMonth() - 1);
    else if (viewMode === "year") d.setFullYear(d.getFullYear() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === "day") d.setDate(d.getDate() + 1);
    else if (viewMode === "week") d.setDate(d.getDate() + 7);
    else if (viewMode === "month") d.setMonth(d.getMonth() + 1);
    else if (viewMode === "year") d.setFullYear(d.getFullYear() + 1);
    setCurrentDate(d);
  };

  const handleToday = () => setCurrentDate(new Date());

  // Formato del título del calendario
  const getHeaderTitle = () => {
    const months = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
    ];
    if (viewMode === "day") {
      return `${currentDate.toLocaleDateString("es-ES", { weekday: "long" })}, ${currentDate.getDate()} de ${months[currentDate.getMonth()]} de ${currentDate.getFullYear()}`;
    }
    if (viewMode === "week") {
      const startOfWeek = new Date(currentDate);
      const day = startOfWeek.getDay() || 7;
      startOfWeek.setDate(startOfWeek.getDate() - day + 1);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      return `${startOfWeek.getDate()} ${months[startOfWeek.getMonth()].slice(0, 3)} - ${endOfWeek.getDate()} ${months[endOfWeek.getMonth()]} ${endOfWeek.getFullYear()}`;
    }
    if (viewMode === "month") {
      return `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    if (viewMode === "year") {
      return `Año ${currentDate.getFullYear()}`;
    }
    return "Todas las Citas";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30";
      case "IN_PROGRESS":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse hover:bg-cyan-500/30";
      case "CANCELLED":
        return "bg-destructive/20 text-destructive border-destructive/40 opacity-60";
      default:
        return "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30";
    }
  };

  // ----------------------------------------------------
  // VISTA DÍA (Day View)
  // ----------------------------------------------------
  const renderDayView = () => {
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(currentDate);
    dayEnd.setHours(23, 59, 59, 999);

    const dayCitas = citas.filter((c) => {
      const d = new Date(c.scheduledAt);
      return d >= dayStart && d <= dayEnd;
    });

    const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 a 20:00

    return (
      <div className="space-y-2 divide-y divide-outline-variant/30">
        {hours.map((hour) => {
          const hourCitas = dayCitas.filter((c) => {
            const d = new Date(c.scheduledAt);
            return d.getHours() === hour;
          });

          return (
            <div key={hour} className="flex min-h-16 gap-4 py-2 hover:bg-surface-high/20 transition-colors">
              <div className="w-16 shrink-0 text-right text-xs font-mono text-muted-foreground pt-1">
                {String(hour).padStart(2, "0")}:00
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                {hourCitas.map((cita) => (
                  <div
                    key={cita.id}
                    className={`rounded-lg border p-2 text-xs transition-all shadow-sm flex items-center justify-between gap-2 ${getStatusColor(cita.status)}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground truncate">
                          {cita.patient.firstName} {cita.patient.lastName} ({cita.patient.syntheticId})
                        </span>
                        <Badge variant="outline" className="text-[10px] mono-label">
                          {citaStatusLabel(cita.status)}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-[11px] truncate">
                        {new Date(cita.scheduledAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} · {cita.durationMinutes} min · {cita.reason || "Consulta médica"}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <WaspRouterLink
                        to={routes.ClinicalPatientDetailRoute.to}
                        params={{ patientId: cita.patient.id }}
                      >
                        <Button size="sm" variant="ghost" className="size-7 p-0" title="Ver paciente">
                          <ExternalLink className="size-3.5" />
                        </Button>
                      </WaspRouterLink>
                      {onEditCita && cita.status === "SCHEDULED" && (
                        <Button size="sm" variant="ghost" className="size-7 p-0" onClick={() => onEditCita(cita)}>
                          <Edit3 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ----------------------------------------------------
  // VISTA SEMANA (Week View)
  // ----------------------------------------------------
  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay() || 7;
    startOfWeek.setDate(startOfWeek.getDate() - day + 1);

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      return d;
    });

    const isToday = (d: Date) => {
      const today = new Date();
      return (
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    };

    return (
      <div className="grid grid-cols-7 gap-2 overflow-x-auto min-w-[700px]">
        {weekDays.map((date, idx) => {
          const dayCitas = citas.filter((c) => {
            const cd = new Date(c.scheduledAt);
            return (
              cd.getDate() === date.getDate() &&
              cd.getMonth() === date.getMonth() &&
              cd.getFullYear() === date.getFullYear()
            );
          });

          return (
            <div
              key={idx}
              className={`rounded-xl border p-2 min-h-[360px] flex flex-col justify-between transition-colors ${
                isToday(date)
                  ? "border-primary/50 bg-primary/5 shadow-[0_0_15px_rgba(0,218,243,0.1)]"
                  : "border-outline-variant/40 bg-surface/30"
              }`}
            >
              <div>
                <div className="text-center border-b border-outline-variant/40 pb-2 mb-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mono-label">
                    {date.toLocaleDateString("es-ES", { weekday: "short" })}
                  </p>
                  <p className={`text-base font-bold ${isToday(date) ? "text-primary" : "text-foreground"}`}>
                    {date.getDate()}
                  </p>
                </div>

                <div className="space-y-1.5 overflow-y-auto max-h-[260px] pr-0.5">
                  {dayCitas.map((cita) => (
                    <div
                      key={cita.id}
                      onClick={() => onSelectCita?.(cita)}
                      className={`cursor-pointer rounded-lg border p-1.5 text-[11px] transition-transform hover:scale-[1.02] ${getStatusColor(cita.status)}`}
                    >
                      <div className="font-semibold truncate">
                        {new Date(cita.scheduledAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}{" "}
                        {cita.patient.firstName}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {cita.patient.syntheticId}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {onNewCitaAtDate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground hover:text-primary mt-2 h-7"
                  onClick={() => onNewCitaAtDate(date)}
                >
                  <Plus className="size-3" />
                  Cita
                </Button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ----------------------------------------------------
  // VISTA MES (Month View - Google Calendar Style)
  // ----------------------------------------------------
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startOffset = (firstDay.getDay() + 6) % 7; // Lunes = 0
    const totalDays = lastDay.getDate();

    const days = [];
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      days.push(new Date(year, month, d));
    }

    const isToday = (d: Date | null) => {
      if (!d) return false;
      const today = new Date();
      return (
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    };

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-1 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground pb-1">
          <span>Lun</span>
          <span>Mar</span>
          <span>Mié</span>
          <span>Jue</span>
          <span>Vie</span>
          <span>Sáb</span>
          <span>Dom</span>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {days.map((date, idx) => {
            if (!date) {
              return <div key={`empty-${idx}`} className="min-h-24 rounded-lg bg-surface-container/20 opacity-30" />;
            }

            const dayCitas = citas.filter((c) => {
              const cd = new Date(c.scheduledAt);
              return (
                cd.getDate() === date.getDate() &&
                cd.getMonth() === date.getMonth() &&
                cd.getFullYear() === date.getFullYear()
              );
            });

            return (
              <div
                key={date.toISOString()}
                onClick={() => onNewCitaAtDate?.(date)}
                className={`group min-h-24 rounded-xl border p-2 flex flex-col justify-between transition-all cursor-pointer hover:border-primary/50 hover:bg-primary/5 ${
                  isToday(date)
                    ? "border-primary/60 bg-primary/10 shadow-[0_0_15px_rgba(0,218,243,0.15)] ring-1 ring-primary/40"
                    : "border-outline-variant/40 bg-surface/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isToday(date) ? "text-primary" : "text-foreground"}`}>
                    {date.getDate()}
                  </span>
                  {dayCitas.length > 0 && (
                    <span className="flex size-4 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                      {dayCitas.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1 overflow-y-auto max-h-16 py-1">
                  {dayCitas.slice(0, 2).map((c) => (
                    <div
                      key={c.id}
                      className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium border ${getStatusColor(c.status)}`}
                      title={`${c.patient.firstName} ${c.patient.lastName} - ${new Date(c.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                    >
                      {new Date(c.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} {c.patient.firstName}
                    </div>
                  ))}
                  {dayCitas.length > 2 && (
                    <p className="text-[9px] text-muted-foreground text-center font-mono">
                      +{dayCitas.length - 2} más
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ----------------------------------------------------
  // VISTA AÑO (Year View - 12 Months Heatmap)
  // ----------------------------------------------------
  const renderYearView = () => {
    const year = currentDate.getFullYear();
    const months = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
    ];

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {months.map((mName, mIdx) => {
          const monthCitas = citas.filter((c) => {
            const cd = new Date(c.scheduledAt);
            return cd.getFullYear() === year && cd.getMonth() === mIdx;
          });

          return (
            <Card
              key={mName}
              onClick={() => {
                const target = new Date(currentDate);
                target.setMonth(mIdx);
                setCurrentDate(target);
                setViewMode("month");
              }}
              className="cursor-pointer border-outline-variant hover:border-primary/60 hover:bg-primary/5 transition-all p-3 text-center"
            >
              <h4 className="text-sm font-bold text-foreground">{mName}</h4>
              <p className="text-2xl font-bold text-primary my-2">{monthCitas.length}</p>
              <p className="text-[10px] text-muted-foreground mono-label uppercase">Citas agendadas</p>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="overflow-hidden border-outline-variant/60 bg-surface/40 backdrop-blur-md shadow-lg">
      <CardHeader className="border-b border-outline-variant/40 bg-surface-container/30 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Controles de Navegación de Fecha */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleToday} className="text-xs">
              Hoy
            </Button>
            <div className="flex items-center">
              <Button variant="ghost" size="sm" onClick={handlePrev} className="size-8 p-0">
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleNext} className="size-8 p-0">
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-foreground capitalize">
              {getHeaderTitle()}
            </h2>
          </div>

          {/* Selector de Modo de Vista (Día | Semana | Mes | Año) */}
          <div className="flex items-center rounded-lg border border-outline-variant/60 bg-surface-container/50 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                viewMode === "day" ? "bg-primary text-primary-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Día
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                viewMode === "week" ? "bg-primary text-primary-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                viewMode === "month" ? "bg-primary text-primary-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mes
            </button>
            <button
              type="button"
              onClick={() => setViewMode("year")}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                viewMode === "year" ? "bg-primary text-primary-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Año
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        {viewMode === "day" && renderDayView()}
        {viewMode === "week" && renderWeekView()}
        {viewMode === "month" && renderMonthView()}
        {viewMode === "year" && renderYearView()}
      </CardContent>
    </Card>
  );
}
