import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "wasp/client/operations";
import { getPatientAppointments, getPatientClinicalHistory } from "wasp/client/operations";
import { useRole } from "../../client/hooks/useRole";
import { RoleGuard } from "../../client/components/RoleGuard";
import { generateIcsFile, downloadIcsFile } from "../../shared/utils/icsGenerator";
import { VoiceOrb, type VoiceAssistantState } from "../../clinical/components/VoiceOrb";
import { ClinicalCalendarView } from "../../clinical/components/ClinicalCalendarView";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../client/components/ui/card";
import { Button } from "../../client/components/ui/button";
import { Badge } from "../../client/components/ui/badge";
import { StatusBadge } from "../../clinical/components/StatusBadge";
import { toast } from "../../client/hooks/use-toast";
import {
  CalendarDays,
  CalendarClock,
  Clock,
  Download,
  FileText,
  HeartPulse,
  Mic,
  ShieldCheck,
  Sparkles,
  UserRound,
  Stethoscope,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

export function PatientDashboard() {
  return (
    <RoleGuard allowedRoles={["paciente"]} fallbackTo="/patient/link">
      <PatientDashboardContent />
    </RoleGuard>
  );
}

function PatientDashboardContent() {
  const navigate = useNavigate();
  const { user } = useRole();
  const [orbState, setOrbState] = useState<VoiceAssistantState>("IDLE");
  const [voiceAnswer, setVoiceAnswer] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<"cards" | "calendar">("cards");

  const { data: apptData, isLoading: loadingAppts } = useQuery(
    getPatientAppointments,
    {},
    { enabled: Boolean(user) },
  );

  const { data: historyData, isLoading: loadingHistory } = useQuery(
    getPatientClinicalHistory,
    {},
    { enabled: Boolean(user) },
  );

  if (loadingAppts || loadingHistory) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          Cargando tu portal de paciente...
        </div>
      </div>
    );
  }

  const dataAppts = apptData as any;
  const dataHistory = historyData as any;

  if (dataAppts && !dataAppts.linked) {
    return (
      <div className="mx-auto max-w-xl p-6 text-center">
        <Card className="border-outline-variant bg-surface/90">
          <CardContent className="p-8 space-y-4">
            <AlertCircle className="size-10 text-primary mx-auto" />
            <h2 className="text-xl font-bold">Sin Perfil Vinculado</h2>
            <p className="text-sm text-muted-foreground">
              Aún no has vinculado tu código de paciente. Ingresa tu código PAC-XXX para ver tus citas y registros.
            </p>
            <Button onClick={() => navigate("/patient/link")}>
              Vincular Código de Paciente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const patient = dataAppts?.patient;
  const citas = dataAppts?.citas || [];
  const notes = dataHistory?.notes || [];
  const epicrises = dataHistory?.epicrises || [];

  const now = new Date();
  const upcomingCita = citas.find(
    (c: any) =>
      (c.status === "SCHEDULED" || c.status === "IN_PROGRESS") &&
      new Date(c.scheduledAt).getTime() >= now.getTime() - 3600000,
  );

  const handleExportIcs = (cita: any) => {
    const start = new Date(cita.scheduledAt);
    const end = new Date(start.getTime() + cita.durationMinutes * 60000);
    const medicoName = cita.medico?.fullName || "Profesional de Turno";

    const ics = generateIcsFile({
      summary: `Consulta Médica DoctorIA - ${cita.reason || "Cita Programada"}`,
      description: `Cita médica con ${medicoName} (${cita.medico?.specialty || "Medicina General"}). Paciente: ${patient?.firstName} ${patient?.lastName} (${patient?.syntheticId}).`,
      startTime: start,
      endTime: end,
      organizer: medicoName,
    });

    const dateStr = start.toISOString().split("T")[0];
    downloadIcsFile(`Cita_DoctorIA_${patient?.syntheticId}_${dateStr}`, ics);
    toast({
      title: "📅 Calendario (.ics) Descargado",
      description: "Puedes importar este archivo en Google Calendar, Apple Calendar u Outlook.",
    });
  };

  const handleOrbClick = () => {
    if (orbState === "IDLE") {
      setOrbState("LISTENING");
      setTimeout(() => {
        setOrbState("PROCESSING");
        setTimeout(() => {
          setOrbState("RESPONDING");
          if (upcomingCita) {
            const dateStr = new Date(upcomingCita.scheduledAt).toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            });
            setVoiceAnswer(`Tu próxima cita es el ${dateStr} con ${upcomingCita.medico?.fullName || "tu médico de cabecera"}.`);
          } else {
            setVoiceAnswer("No tienes citas pendientes programadas. Puedes consultar tu historial de consultas confirmadas.");
          }
          setTimeout(() => {
            setOrbState("IDLE");
          }, 6000);
        }, 1200);
      }, 1500);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Header del Paciente */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-outline-variant/60 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Hola, {patient?.firstName} {patient?.lastName}
            </h1>
            <Badge variant="outline" className="font-mono text-primary border-primary/30">
              {patient?.syntheticId}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-primary" />
            Portal de Paciente · Historial clínico y citas confirmadas
          </p>
        </div>
      </div>

      {/* Orbe Asistente para Paciente */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 via-surface to-surface-container shadow-lg">
        <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6">
          <div className="space-y-2 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Sparkles className="size-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary mono-label">
                Asistente Virtual del Paciente
              </span>
            </div>
            <h3 className="text-lg font-bold text-foreground">
              ¿Tienes dudas sobre tu próxima cita o historial?
            </h3>
            <p className="text-xs text-muted-foreground max-w-md">
              Toca el orbe inteligente para consultar al instante la fecha de tu próxima cita o el estado de tus consultas.
            </p>
            {voiceAnswer && (
              <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-foreground animate-in fade-in">
                🗣️ {voiceAnswer}
              </div>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-center">
            <VoiceOrb
              state={orbState}
              onActivate={handleOrbClick}
              disabled={false}
              className="size-24 cursor-pointer hover:scale-105 transition-transform"
            />
            <span className="text-[10px] text-muted-foreground mt-2 mono-label">
              {orbState === "IDLE" ? "Toca para hablar" : orbState === "LISTENING" ? "Escuchando..." : orbState === "PROCESSING" ? "Consultando..." : "Respondiendo"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Selector de Modo: Resumen vs Calendario */}
      <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
        <div className="flex items-center rounded-lg border border-outline-variant/60 bg-surface-container/40 p-1 text-xs">
          <button
            type="button"
            onClick={() => setDisplayMode("cards")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all ${
              displayMode === "cards"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarClock className="size-4" />
            Resumen & Próxima Cita
          </button>
          <button
            type="button"
            onClick={() => setDisplayMode("calendar")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all ${
              displayMode === "calendar"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarDays className="size-4" />
            Vista Calendario (Día / Sem / Mes / Año)
          </button>
        </div>
      </div>

      {displayMode === "calendar" ? (
        <ClinicalCalendarView citas={citas} />
      ) : (
        <>
          {/* Próxima Cita Highlight */}
          {upcomingCita ? (
        <Card className="border-sky-500/30 bg-sky-500/5 shadow-md">
          <CardHeader className="pb-3 border-b border-sky-500/20">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-sky-400">
                <CalendarClock className="size-5" />
                Próxima Cita Médica
              </CardTitle>
              <StatusBadge status={upcomingCita.status} />
            </div>
          </CardHeader>
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-lg font-bold text-foreground">
                {new Date(upcomingCita.scheduledAt).toLocaleDateString("es-ES", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  <Clock className="size-3.5 text-primary" />
                  {new Date(upcomingCita.scheduledAt).toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  ({upcomingCita.durationMinutes} min)
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Stethoscope className="size-3.5 text-primary" />
                  {upcomingCita.medico?.fullName || "Médico Asignado"} ({upcomingCita.medico?.specialty || "Medicina General"})
                </span>
              </div>
              {upcomingCita.reason && (
                <p className="text-xs text-muted-foreground pt-1">
                  Motivo: <span className="text-foreground">{upcomingCita.reason}</span>
                </p>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-sky-500/40 hover:bg-sky-500/10 text-sky-300 shrink-0"
              onClick={() => handleExportIcs(upcomingCita)}
            >
              <Download className="size-3.5" />
              Guardar en Calendario (.ics)
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-outline-variant bg-surface/50">
          <CardContent className="p-6 text-center space-y-1">
            <CalendarDays className="size-8 text-muted-foreground mx-auto mb-2 opacity-60" />
            <p className="text-sm font-medium text-foreground">No tienes citas programadas próximas</p>
            <p className="text-xs text-muted-foreground">Comunícate con recepción o secretaría para agendar tu próxima consulta médica.</p>
          </CardContent>
        </Card>
      )}

      {/* Historial de Citas y Consultas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de Citas */}
        <Card className="border-outline-variant shadow-sm">
          <CardHeader className="border-b border-outline-variant/60 bg-surface-container/50 pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              Mis Citas Médicas ({citas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-outline-variant/40">
            {citas.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No hay registro de citas anteriores.
              </div>
            ) : (
              citas.map((c: any) => (
                <div key={c.id} className="p-4 flex items-center justify-between gap-3 hover:bg-accent/20 transition-colors">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {new Date(c.scheduledAt).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.medico?.fullName || "Médico"} · {c.reason || "Consulta general"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0 shrink-0"
                    title="Exportar a calendario (.ics)"
                    onClick={() => handleExportIcs(c)}
                  >
                    <Download className="size-3.5 text-muted-foreground hover:text-primary" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Historial Clínico Confirmado */}
        <Card className="border-outline-variant shadow-sm">
          <CardHeader className="border-b border-outline-variant/60 bg-surface-container/50 pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <HeartPulse className="size-4 text-primary" />
              Historial Clínico Confirmado
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-outline-variant/40">
            {notes.length === 0 && epicrises.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Aún no tienes atenciones médicas confirmadas registradas.
              </div>
            ) : (
              <>
                {notes.map((n: any) => (
                  <div key={n.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <FileText className="size-3.5 text-primary" />
                        Consulta Médica
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {n.motivoConsulta && (
                      <p className="text-xs text-muted-foreground">
                        <strong className="text-foreground">Motivo:</strong> {n.motivoConsulta}
                      </p>
                    )}
                    {n.planIndicaciones && (
                      <div className="rounded-lg bg-surface-container/60 p-2.5 text-xs text-foreground/90">
                        <strong className="text-primary text-[11px] block mb-0.5">Indicaciones Médicas:</strong>
                        <p className="whitespace-pre-wrap">{n.planIndicaciones}</p>
                      </div>
                    )}
                    {n.cie11Code && (
                      <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                        CIE-11: {n.cie11Code} - {n.cie11Description}
                      </Badge>
                    )}
                  </div>
                ))}

                {epicrises.map((ep: any) => (
                  <div key={ep.id} className="p-4 space-y-2 bg-primary/5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                        <Sparkles className="size-3.5" />
                        Epicrisis de Alta
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(ep.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {ep.reasonForAdmission && (
                      <p className="text-xs text-muted-foreground">
                        <strong className="text-foreground">Motivo:</strong> {ep.reasonForAdmission}
                      </p>
                    )}
                    {ep.followUpInstructions && (
                      <div className="rounded-lg bg-surface-container/60 p-2.5 text-xs text-foreground/90">
                        <strong className="text-primary text-[11px] block mb-0.5">Instrucciones de Seguimiento:</strong>
                        <p className="whitespace-pre-wrap">{ep.followUpInstructions}</p>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>
      </>
      )}
    </div>
  );
}
