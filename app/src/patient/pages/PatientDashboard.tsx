import { useState, useEffect } from "react";
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
import { PatientProfileModal } from "../components/PatientProfileModal";
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
  ExternalLink,
  Activity,
  AlertTriangle,
  Pill,
  Calendar as CalendarIcon,
  CheckCircle2,
  PhoneCall,
  Edit3,
} from "lucide-react";

function getGoogleCalendarUrl(cita: any, patientName: string) {
  const start = new Date(cita.scheduledAt);
  const end = new Date(start.getTime() + (cita.durationMinutes || 30) * 60 * 1000);
  const formatGDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
  const title = encodeURIComponent(`Cita Médica DoctorIA - ${patientName}`);
  const details = encodeURIComponent(
    `Cita Médica en DoctorIA\nPaciente: ${patientName}\nMédico: ${cita.medico?.fullName || cita.medico?.email} (${cita.medico?.specialty || "Medicina General"})\nMotivo: ${cita.reason || "Consulta médica general"}\nEstado: ${cita.status}`
  );
  const location = encodeURIComponent("Consultorio DoctorIA");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatGDate(start)}/${formatGDate(end)}&details=${details}&location=${location}`;
}

export function PatientDashboard() {
  return (
    <RoleGuard allowedRoles={["paciente"]} fallbackTo="/patient/link">
      <PatientDashboardContent />
    </RoleGuard>
  );
}

type PatientTab = "resumen" | "citas" | "historial" | "epicrisis";

function PatientDashboardContent() {
  const navigate = useNavigate();
  const { user } = useRole();
  const [orbState, setOrbState] = useState<VoiceAssistantState>("IDLE");
  const [voiceAnswer, setVoiceAnswer] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PatientTab>("resumen");
  const [citasViewMode, setCitasViewMode] = useState<"list" | "calendar">("list");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isFirstTimeOnboarding, setIsFirstTimeOnboarding] = useState(false);

  const {
    data: apptData,
    isLoading: loadingAppts,
    refetch: refetchAppts,
  } = useQuery(getPatientAppointments, {}, { enabled: Boolean(user) });

  const {
    data: historyData,
    isLoading: loadingHistory,
    refetch: refetchHistory,
  } = useQuery(getPatientClinicalHistory, {}, { enabled: Boolean(user) });

  const dataAppts = apptData as any;
  const dataHistory = historyData as any;
  const patient = dataAppts?.patient;
  const citas = dataAppts?.citas || [];
  const notes = dataHistory?.notes || [];
  const epicrises = dataHistory?.epicrises || [];

  // Detección automática de primer ingreso o datos pendientes al vincular cuenta (Hook en el nivel superior)
  useEffect(() => {
    if (patient) {
      const isPlaceholderName =
        !patient.firstName ||
        patient.firstName.includes("@") ||
        patient.firstName === "Paciente" ||
        patient.lastName?.startsWith("PAC-");
      const isMissingContact = !patient.phone || !patient.address;
      const seenKey = `patient_onboarding_prompted_${patient.id}`;
      const alreadyPrompted = sessionStorage.getItem(seenKey);

      if ((isPlaceholderName || isMissingContact) && !alreadyPrompted) {
        setIsFirstTimeOnboarding(true);
        setShowProfileModal(true);
        sessionStorage.setItem(seenKey, "true");
      }
    }
  }, [patient]);

  if (loadingAppts || loadingHistory) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-center p-12 text-sm text-muted-foreground gap-3">
          <span className="size-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Cargando tu portal de paciente...
        </div>
      </div>
    );
  }

  if (dataAppts && !dataAppts.linked) {
    return (
      <div className="mx-auto max-w-xl p-6 text-center">
        <Card className="border-outline-variant bg-surface/90 shadow-xl">
          <CardContent className="p-8 space-y-4">
            <AlertCircle className="size-12 text-primary mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Sin Perfil Vinculado</h2>
            <p className="text-sm text-muted-foreground">
              Aún no has vinculado tu código de paciente. Solicita la vinculación con tu documento de identidad para ver tus citas y registros.
            </p>
            <Button onClick={() => navigate("/patient/link")}>
              Vincular Ficha de Paciente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayName =
    patient?.firstName === "Paciente" && patient?.lastName?.startsWith("PAC-")
      ? "Paciente"
      : `${patient?.firstName || ""} ${patient?.lastName || ""}`.trim() || "Paciente";

  const now = new Date();
  const upcomingCita = citas.find(
    (c: any) =>
      (c.status === "SCHEDULED" || c.status === "IN_PROGRESS") &&
      new Date(c.scheduledAt).getTime() >= now.getTime() - 3600000,
  );

  const handleExportIcs = (cita: any) => {
    const start = new Date(cita.scheduledAt);
    const end = new Date(start.getTime() + (cita.durationMinutes || 30) * 60000);
    const medicoName = cita.medico?.fullName || "Profesional de Turno";

    const ics = generateIcsFile({
      summary: `Consulta Médica DoctorIA - ${cita.reason || "Cita Programada"}`,
      description: `Cita médica con ${medicoName} (${cita.medico?.specialty || "Medicina General"}). Paciente: ${displayName} (${patient?.syntheticId}).`,
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

  const handleOrbQuery = (type: "cita" | "indicaciones" | "alergias") => {
    setOrbState("LISTENING");
    setTimeout(() => {
      setOrbState("PROCESSING");
      setTimeout(() => {
        setOrbState("RESPONDING");
        if (type === "cita") {
          if (upcomingCita) {
            const dateStr = new Date(upcomingCita.scheduledAt).toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            });
            setVoiceAnswer(`Tu próxima cita es el ${dateStr} con ${upcomingCita.medico?.fullName || "tu médico asignado"}.`);
          } else {
            setVoiceAnswer("No tienes citas médicas pendientes programadas.");
          }
        } else if (type === "indicaciones") {
          const lastNote = notes[0];
          if (lastNote?.planIndicaciones) {
            setVoiceAnswer(`Tus últimas indicaciones médicas son: "${lastNote.planIndicaciones.slice(0, 140)}..."`);
          } else {
            setVoiceAnswer("No tienes indicaciones médicas recientes registradas en tus consultas confirmadas.");
          }
        } else if (type === "alergias") {
          if (patient?.allergies) {
            setVoiceAnswer(`Tienes registradas las siguientes alergias: ${patient.allergies}.`);
          } else {
            setVoiceAnswer("No tienes alergias registradas en tu ficha médica.");
          }
        }
        setTimeout(() => setOrbState("IDLE"), 6000);
      }, 800);
    }, 800);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header del Paciente */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-outline-variant/60 pb-5">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Hola, {displayName}
            </h1>
            <Badge variant="outline" className="font-mono text-xs text-primary border-primary/40 bg-primary/5 px-2.5 py-0.5">
              {patient?.syntheticId}
            </Badge>
            {patient?.documento && (
              <Badge className="text-xs bg-surface border border-outline-variant text-muted-foreground">
                {patient.tipoDocumento || "CI"}: {patient.documento}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-emerald-400" />
            Portal de Paciente · Historial clínico confidencial y citas confirmadas
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsFirstTimeOnboarding(false);
              setShowProfileModal(true);
            }}
            className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10"
          >
            <Edit3 className="size-3.5" />
            Actualizar mis datos
          </Button>

          <a
            href="https://calendar.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-container transition-colors shadow-sm"
          >
            <ExternalLink className="size-3.5" />
            Google Calendar
          </a>
        </div>
      </div>

      {/* Tarjeta de Ficha de Salud Rápida */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-outline-variant bg-surface/60 shadow-sm p-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              <CalendarClock className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Citas</p>
              <p className="text-sm font-bold text-foreground truncate">{citas.length} registradas</p>
            </div>
          </div>
        </Card>

        <Card className="border-outline-variant bg-surface/60 shadow-sm p-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Consultas</p>
              <p className="text-sm font-bold text-foreground truncate">{notes.length} confirmadas</p>
            </div>
          </div>
        </Card>

        <Card className="border-outline-variant bg-surface/60 shadow-sm p-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
              <AlertTriangle className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Alergias</p>
              <p className="text-xs font-medium text-foreground truncate" title={patient?.allergies || "Ninguna registrada"}>
                {patient?.allergies ? patient.allergies : "Ninguna"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-outline-variant bg-surface/60 shadow-sm p-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
              <HeartPulse className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Epicrisis</p>
              <p className="text-sm font-bold text-foreground truncate">{epicrises.length} emitidas</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Asistente Virtual Inteligente */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/10 via-surface to-surface-container shadow-md">
        <CardContent className="flex flex-col md:flex-row items-center justify-between gap-6 p-6">
          <div className="space-y-2.5 text-center md:text-left flex-1">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <Sparkles className="size-4 text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary mono-label">
                Asistente Virtual de Salud
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              ¿En qué puedo ayudarte hoy, {displayName}?
            </h3>
            <p className="text-xs text-muted-foreground max-w-lg">
              Consulta tus citas, medicamentos e historial médico de forma inmediata o toca las preguntas rápidas:
            </p>

            {/* Chips de consulta rápida */}
            <div className="flex flex-wrap gap-2 pt-1 justify-center md:justify-start">
              <button
                type="button"
                onClick={() => handleOrbQuery("cita")}
                className="text-xs bg-surface border border-outline-variant hover:border-primary/60 px-2.5 py-1 rounded-full text-foreground transition-colors flex items-center gap-1.5 shadow-sm"
              >
                🗓️ ¿Cuándo es mi próxima cita?
              </button>
              <button
                type="button"
                onClick={() => handleOrbQuery("indicaciones")}
                className="text-xs bg-surface border border-outline-variant hover:border-primary/60 px-2.5 py-1 rounded-full text-foreground transition-colors flex items-center gap-1.5 shadow-sm"
              >
                💊 Ver mis indicaciones médicas
              </button>
              <button
                type="button"
                onClick={() => handleOrbQuery("alergias")}
                className="text-xs bg-surface border border-outline-variant hover:border-primary/60 px-2.5 py-1 rounded-full text-foreground transition-colors flex items-center gap-1.5 shadow-sm"
              >
                🛡️ Mis alergias registradas
              </button>
            </div>

            {voiceAnswer && (
              <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-foreground animate-in fade-in flex items-start gap-2">
                <span className="text-base">🗣️</span>
                <span className="font-medium pt-0.5">{voiceAnswer}</span>
              </div>
            )}
          </div>

          <div className="shrink-0 flex flex-col items-center">
            <VoiceOrb
              state={orbState}
              onActivate={() => handleOrbQuery("cita")}
              disabled={false}
              className="size-20 cursor-pointer hover:scale-105 transition-transform"
            />
            <span className="text-[10px] text-muted-foreground mt-2 mono-label">
              {orbState === "IDLE" ? "Toca para consultar" : orbState === "LISTENING" ? "Escuchando..." : orbState === "PROCESSING" ? "Consultando..." : "Respondiendo"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Navegación por Pestañas del Portal */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-outline-variant bg-surface-container/60 p-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab("resumen")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === "resumen"
              ? "bg-primary text-primary-foreground font-semibold shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Activity className="size-4" />
          Resumen de Salud
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("citas")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === "citas"
              ? "bg-primary text-primary-foreground font-semibold shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CalendarDays className="size-4" />
          Mis Citas ({citas.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("historial")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === "historial"
              ? "bg-primary text-primary-foreground font-semibold shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="size-4" />
          Consultas & Recetas ({notes.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("epicrisis")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === "epicrisis"
              ? "bg-primary text-primary-foreground font-semibold shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <HeartPulse className="size-4" />
          Epicrisis y Altas ({epicrises.length})
        </button>
      </div>

      {/* CONTENIDO DE PESTAÑA: RESUMEN DE SALUD */}
      {activeTab === "resumen" && (
        <div className="space-y-6 animate-in fade-in">
          {(!patient?.phone || !patient?.address || !patient?.bloodType) && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 backdrop-blur-sm">
              <div className="flex items-center gap-3 text-xs">
                <AlertTriangle className="size-5 text-amber-400 shrink-0" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-foreground">
                    Ficha de paciente pendiente de completar
                  </p>
                  <p className="text-muted-foreground">
                    Por favor registra tu teléfono, dirección domiciliaria y grupo sanguíneo para la atención clínica.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsFirstTimeOnboarding(false);
                  setShowProfileModal(true);
                }}
                className="text-xs shrink-0 border-amber-500/40 text-amber-300 hover:bg-amber-500/20 w-full sm:w-auto"
              >
                Completar mis datos
              </Button>
            </div>
          )}

          {/* Próxima Cita */}
          {upcomingCita ? (
            <Card className="border-primary/40 bg-gradient-to-br from-primary/10 to-surface shadow-md">
              <CardHeader className="pb-2 border-b border-primary/20">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold text-primary">
                    <CalendarClock className="size-4" />
                    Próxima Cita Médica Confirmada
                  </CardTitle>
                  <StatusBadge status={upcomingCita.status} />
                </div>
              </CardHeader>
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1.5">
                  <p className="text-base sm:text-lg font-bold text-foreground capitalize">
                    {new Date(upcomingCita.scheduledAt).toLocaleDateString("es-ES", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                      <Clock className="size-3.5 text-primary" />
                      {new Date(upcomingCita.scheduledAt).toLocaleTimeString("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      ({upcomingCita.durationMinutes || 30} min)
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Stethoscope className="size-3.5 text-primary" />
                      {upcomingCita.medico?.fullName || "Médico Asignado"} ({upcomingCita.medico?.specialty || "Medicina General"})
                    </span>
                  </div>
                  {upcomingCita.reason && (
                    <p className="text-xs text-muted-foreground pt-1">
                      Motivo: <span className="text-foreground font-medium">{upcomingCita.reason}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <a
                    href={getGoogleCalendarUrl(upcomingCita, displayName)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-2 rounded-lg font-medium shadow-sm transition-colors"
                  >
                    <ExternalLink className="size-3.5" />
                    Google Calendar
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-outline-variant hover:bg-surface-container text-xs h-9"
                    onClick={() => handleExportIcs(upcomingCita)}
                  >
                    <Download className="size-3.5" />
                    Descargar .ics
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-outline-variant bg-surface/50">
              <CardContent className="p-6 text-center space-y-1.5">
                <CalendarDays className="size-8 text-muted-foreground/60 mx-auto mb-1" />
                <p className="text-sm font-semibold text-foreground">No tienes citas médicas pendientes</p>
                <p className="text-xs text-muted-foreground">
                  Comunícate con recepción o con tu médico tratante para programar tu próxima consulta.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Últimas Indicaciones y Notas Clínicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-outline-variant shadow-sm">
              <CardHeader className="border-b border-outline-variant/60 bg-surface-container/40 pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Pill className="size-4 text-primary" />
                  Últimas Indicaciones Médicas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {notes.length === 0 || !notes[0]?.planIndicaciones ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Sin indicaciones médicas recientes.
                  </p>
                ) : (
                  <div className="rounded-lg bg-surface-container/60 border border-outline-variant/60 p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Consulta del {new Date(notes[0].createdAt).toLocaleDateString("es-ES")}</span>
                      <span>Dr(a). {notes[0].author?.fullName || "Médico"}</span>
                    </div>
                    <p className="text-foreground whitespace-pre-wrap leading-relaxed font-medium">
                      {notes[0].planIndicaciones}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-outline-variant shadow-sm">
              <CardHeader className="border-b border-outline-variant/60 bg-surface-container/40 pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <HeartPulse className="size-4 text-primary" />
                  Información del Paciente
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsFirstTimeOnboarding(false);
                    setShowProfileModal(true);
                  }}
                  className="h-7 px-2 text-xs text-primary gap-1 hover:bg-primary/10"
                >
                  <Edit3 className="size-3" />
                  Editar
                </Button>
              </CardHeader>
              <CardContent className="p-4 text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-outline-variant/40">
                  <span className="text-muted-foreground">Código de Ficha:</span>
                  <span className="font-mono font-bold text-primary">{patient?.syntheticId}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-outline-variant/40">
                  <span className="text-muted-foreground">Documento:</span>
                  <span className="font-medium text-foreground">{patient?.documento || "No registrado"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-outline-variant/40">
                  <span className="text-muted-foreground">Teléfono:</span>
                  <span className="font-mono font-medium text-foreground">{patient?.phone || "No registrado"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-outline-variant/40">
                  <span className="text-muted-foreground">Dirección:</span>
                  <span className="font-medium text-foreground truncate max-w-[180px]" title={patient?.address || ""}>
                    {patient?.address || "No registrada"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-outline-variant/40">
                  <span className="text-muted-foreground">Grupo Sanguíneo:</span>
                  <span className="font-mono font-bold text-primary">{patient?.bloodType || "No registrado"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-outline-variant/40">
                  <span className="text-muted-foreground">Fecha de Nacimiento:</span>
                  <span className="font-medium text-foreground">
                    {patient?.birthDate ? new Date(patient.birthDate).toLocaleDateString("es-ES") : "No registrada"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Alergias Conocidas:</span>
                  <span className="font-medium text-amber-400">{patient?.allergies || "Ninguna"}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* CONTENIDO DE PESTAÑA: MIS CITAS */}
      {activeTab === "citas" && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              Historial de Citas Médicas ({citas.length})
            </h3>
            <div className="flex items-center rounded-lg border border-outline-variant bg-surface p-0.5 text-xs">
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md transition-all ${
                  citasViewMode === "list"
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setCitasViewMode("list")}
              >
                Lista
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md transition-all ${
                  citasViewMode === "calendar"
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setCitasViewMode("calendar")}
              >
                Calendario
              </button>
            </div>
          </div>

          {citasViewMode === "calendar" ? (
            <ClinicalCalendarView citas={citas} />
          ) : (
            <Card className="border-outline-variant shadow-sm overflow-hidden">
              <CardContent className="p-0 divide-y divide-outline-variant/40">
                {citas.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No tienes citas médicas registradas en el sistema.
                  </div>
                ) : (
                  citas.map((c: any) => (
                    <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-surface-container/30 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-foreground">
                            {new Date(c.scheduledAt).toLocaleDateString("es-ES", {
                              weekday: "short",
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                          <span className="text-xs font-semibold text-primary">
                            {new Date(c.scheduledAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <StatusBadge status={c.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Médico: <strong className="text-foreground">{c.medico?.fullName || "Médico Asignado"}</strong> ({c.medico?.specialty || "Medicina General"})
                          {c.reason && ` · Motivo: ${c.reason}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <a
                          href={getGoogleCalendarUrl(c, displayName)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs border border-primary/40 bg-primary/10 px-2.5 py-1.5 rounded-md text-primary hover:bg-primary/20 transition-colors shadow-sm font-medium"
                          title="Añadir a Google Calendar"
                        >
                          <ExternalLink className="size-3" />
                          Google Calendar
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-8 p-0"
                          title="Descargar (.ics)"
                          onClick={() => handleExportIcs(c)}
                        >
                          <Download className="size-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* CONTENIDO DE PESTAÑA: CONSULTAS & NOTAS */}
      {activeTab === "historial" && (
        <div className="space-y-4 animate-in fade-in">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            Consultas Médicas & Indicaciones Confirmadas ({notes.length})
          </h3>

          <div className="space-y-4">
            {notes.length === 0 ? (
              <Card className="border-outline-variant">
                <CardContent className="p-8 text-center text-xs text-muted-foreground">
                  Aún no tienes notas de consultas médicas confirmadas por tus doctores.
                </CardContent>
              </Card>
            ) : (
              notes.map((n: any) => (
                <Card key={n.id} className="border-outline-variant shadow-sm">
                  <CardHeader className="border-b border-outline-variant/60 bg-surface-container/40 p-4 pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-primary" />
                        <span className="text-sm font-bold text-foreground">
                          Consulta con Dr(a). {n.author?.fullName || "Médico Tratante"}
                        </span>
                        <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
                          Confirmada
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(n.createdAt).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 text-xs">
                    {n.motivoConsulta && (
                      <div>
                        <strong className="text-muted-foreground block mb-0.5">Motivo de Consulta:</strong>
                        <p className="text-foreground font-medium">{n.motivoConsulta}</p>
                      </div>
                    )}

                    {n.planIndicaciones && (
                      <div className="rounded-lg bg-surface-container/80 border border-primary/20 p-3 space-y-1">
                        <strong className="text-primary font-bold flex items-center gap-1.5">
                          <Pill className="size-3.5" />
                          Plan de Tratamiento e Indicaciones Médicas:
                        </strong>
                        <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                          {n.planIndicaciones}
                        </p>
                      </div>
                    )}

                    {n.cie11Code && (
                      <div className="pt-1">
                        <Badge variant="outline" className="text-[11px] border-primary/40 text-primary font-medium">
                          Diagnóstico CIE-11: {n.cie11Code} - {n.cie11Description}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* CONTENIDO DE PESTAÑA: EPICRISIS */}
      {activeTab === "epicrisis" && (
        <div className="space-y-4 animate-in fade-in">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <HeartPulse className="size-4 text-primary" />
            Epicrisis y Altas Médicas ({epicrises.length})
          </h3>

          <div className="space-y-4">
            {epicrises.length === 0 ? (
              <Card className="border-outline-variant">
                <CardContent className="p-8 text-center text-xs text-muted-foreground">
                  No tienes registros de epicrisis o altas hospitalarias emitidas.
                </CardContent>
              </Card>
            ) : (
              epicrises.map((ep: any) => (
                <Card key={ep.id} className="border-primary/30 bg-primary/5 shadow-sm">
                  <CardHeader className="border-b border-primary/20 p-4 pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="size-4 text-primary" />
                        <span className="text-sm font-bold text-foreground">
                          Epicrisis de Alta Médica
                        </span>
                        <Badge className="bg-primary/20 text-primary text-[10px] border-primary/30">
                          Alta Médica
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(ep.createdAt).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 text-xs">
                    {ep.reasonForAdmission && (
                      <div>
                        <strong className="text-muted-foreground block mb-0.5">Motivo de Ingreso / Atención:</strong>
                        <p className="text-foreground font-medium">{ep.reasonForAdmission}</p>
                      </div>
                    )}

                    {ep.evolutionSummary && (
                      <div>
                        <strong className="text-muted-foreground block mb-0.5">Resumen de Evolución:</strong>
                        <p className="text-foreground whitespace-pre-wrap">{ep.evolutionSummary}</p>
                      </div>
                    )}

                    {ep.followUpInstructions && (
                      <div className="rounded-lg bg-surface border border-primary/30 p-3 space-y-1">
                        <strong className="text-primary font-bold block">
                          Instrucciones de Cuidado y Seguimiento al Alta:
                        </strong>
                        <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                          {ep.followUpInstructions}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      <PatientProfileModal
        open={showProfileModal}
        onOpenChange={setShowProfileModal}
        patient={patient}
        isFirstTimeOnboarding={isFirstTimeOnboarding}
        onSuccess={() => {
          refetchAppts();
          refetchHistory();
        }}
      />
    </div>
  );
}
