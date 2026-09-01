import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useAction, useQuery } from "wasp/client/operations";
import {
  getPatientById,
  getPatientHistory,
  createClinicalNote,
  generateEpicrisisDraft,
  updateCitaStatus,
  manageCitaByMedico,
  deleteEpicrisis,
  getPrintableEpicrises,
} from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  Pencil,
  PhoneMissed,
  Play,
  Plus,
  Printer,
  ShieldAlert,
  Trash2,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "../../client/components/ui/card";
import { Button } from "../../client/components/ui/button";
import { toast } from "../../client/hooks/use-toast";
import { useConfirm } from "../../client/hooks/use-confirm";
import { generateIcsFile, downloadIcsFile } from "../../shared/utils/icsGenerator";
import { citaStatusLabel } from "../services/statusLabels";
import { PatientProfileHeader } from "../components/PatientProfileHeader";
import { PatientClinicalSummary } from "../components/PatientClinicalSummary";
import { PatientQuickActions } from "../components/PatientQuickActions";
import { PatientHistoryTimeline } from "../components/PatientHistoryTimeline";
import { PatientFormModal } from "../components/PatientFormModal";
import { NewAppointmentModal } from "../components/NewAppointmentModal";
import { EditAppointmentModal } from "../components/EditAppointmentModal";
import { PreClinicalRecordPanel } from "../components/PreClinicalRecordPanel";
import { EpicrisisPrintView } from "../components/EpicrisisPrintView";
import { CardHeader, CardTitle } from "../../client/components/ui/card";
import { Badge } from "../../client/components/ui/badge";

export function ClinicalPatientDetailPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { data: user } = useAuth();
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [newNoteText, setNewNoteText] = useState("");
  const [creating, setCreating] = useState(false);
  const [generatingEpicrisis, setGeneratingEpicrisis] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showNewCita, setShowNewCita] = useState(false);
  const [editingCita, setEditingCita] = useState<any>(null);
  const [printEpicrisisId, setPrintEpicrisisId] = useState<string | null>(null);
  const [busyCitaId, setBusyCitaId] = useState<string | null>(null);

  const isAuthResolved = Boolean(user && patientId);

  const { data: detail, isLoading: loadingDetail, refetch } = useQuery(
    getPatientById,
    {
      patientId: patientId ?? "",
    },
    { enabled: isAuthResolved },
  );
  const { data: history, isLoading: loadingHistory, refetch: refetchHistory } =
    useQuery(
      getPatientHistory,
      { patientId: patientId ?? "" },
      { enabled: isAuthResolved },
    );

  const createNoteFn = useAction(createClinicalNote);
  const generateEpicrisisFn = useAction(generateEpicrisisDraft);
  const updateStatusFn = useAction(updateCitaStatus);
  const manageCitaByMedicoFn = useAction(manageCitaByMedico);
  const deleteEpicrisisFn = useAction(deleteEpicrisis);
  const { confirm, ConfirmDialog } = useConfirm();

  const isSecretariaView = !!(
    (user as any)?.isSecretaria &&
    !(user as any)?.isMedico &&
    !(user as any)?.isAdmin
  );

  const canEditPatient = Boolean(user?.isSecretaria || user?.isAdmin);

  const { data: printableEpicrises } = useQuery(
    getPrintableEpicrises,
    {
      patientId: patientId ?? "",
    },
    { enabled: isAuthResolved },
  );

  if (!(user?.isMedico || user?.isSecretaria || user?.isAdmin)) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="border-outline-variant">
          <CardContent className="flex items-start gap-3 p-6 text-sm">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>No tienes acceso a este módulo clínico.</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadingDetail || loadingHistory) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          Cargando historia clínica…
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card className="border-destructive/50">
          <CardContent className="p-6 text-sm text-destructive">
            Paciente no encontrado.
          </CardContent>
        </Card>
      </div>
    );
  }

  const patient = detail.patient;

  const handleCreateNote = async () => {
    if (!newNoteText.trim()) return;
    setCreating(true);
    try {
      const note = await createNoteFn({
        patientId: patientId!,
        originalText: newNoteText,
      });
      toast({ title: "Nota clínica creada correctamente" });
      navigate(routes.ClinicalNoteRoute.build({ params: { noteId: note.id } }));
    } catch (err: any) {
      toast({
        title: "No se pudo crear la nota",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setCreating(false);
      }
    }
  };

  const handleGenerateEpicrisis = async () => {
    if (generatingEpicrisis) return;
    setGeneratingEpicrisis(true);
    try {
      const epicrisis = await generateEpicrisisFn({ patientId: patientId! });
      toast({ title: "Epicrisis generada correctamente" });
      await refetchHistory();
      navigate(
        routes.ClinicalEpicrisisRoute.build({
          params: { epicrisisId: epicrisis.id },
        }),
      );
    } catch (err: any) {
      try {
        const fresh = await refetchHistory();
        const epicrises = fresh?.data?.epicrises ?? [];
        const latest = epicrises.sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0];
        if (latest) {
          toast({
            title: "Epicrisis lista",
            description:
              "El borrador asistido por IA se generó; abriendo para revisión.",
          });
          navigate(
            routes.ClinicalEpicrisisRoute.build({
              params: { epicrisisId: latest.id },
            }),
          );
          return;
        }
      } catch {
        // error original
      }
      const message = err?.message ?? "No se pudo generar la epicrisis";
      const description = message.includes("confirmada")
        ? "El paciente debe tener al menos una nota CONFIRMADA. Confirma una nota e inténtalo de nuevo."
        : message;
      toast({
        title: "No se pudo generar la epicrisis",
        description,
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        setGeneratingEpicrisis(false);
      }
    }
  };

  const activeCita = (detail.latestCitas ?? []).find(
    (c: any) => c.status === "IN_PROGRESS" || c.status === "SCHEDULED",
  ) || detail.latestCitas?.[0];

  const handleUpdateCitaStatus = async (
    citaId: string,
    status: string,
    label: string,
  ) => {
    setBusyCitaId(citaId);
    try {
      await updateStatusFn({
        citaId,
        status,
      });
      toast({ title: label });
      await refetch();
    } catch (err: any) {
      toast({
        title: "No se pudo actualizar el estado de la cita",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setBusyCitaId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <WaspRouterLink
        to={routes.ClinicalPatientsRoute.to}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-3.5" />
        Volver a pacientes
      </WaspRouterLink>

      <div className="flex items-center justify-between gap-2">
        <PatientProfileHeader
          patient={patient}
          noteCount={detail.noteCount}
          epicrisisCount={detail.epicrisisCount}
        />
        {canEditPatient && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowEdit(true)}
          >
            <Pencil className="size-3.5" />
            Editar paciente
          </Button>
        )}
      </div>

      {isSecretariaView ? (
        <SecretaryView
          patientId={patient.id}
          citas={detail.latestCitas ?? []}
          printableEpicrises={printableEpicrises ?? []}
          busyCitaId={busyCitaId}
          onNewCita={() => setShowNewCita(true)}
          onUpdateCitaStatus={handleUpdateCitaStatus}
          onPrint={(id) => setPrintEpicrisisId(id)}
          onDone={() => refetch()}
        />
      ) : (
        <>
          <PatientClinicalSummary
            notes={history?.notes ?? []}
            epicrises={history?.epicrises ?? []}
            citas={detail?.latestCitas ?? []}
          />

          {activeCita ? (
            <PreClinicalRecordPanel
              patientId={patient.id}
              citaId={activeCita.id}
              readOnly={true}
            />
          ) : (
            <Card className="overflow-hidden border-outline-variant bg-surface">
              <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Badge variant="outline" className="mono-label">
                    📊 Registro Pre-Clínico
                  </Badge>
                  <span className="text-xs font-normal text-muted-foreground">
                    Sin cita activa
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 text-sm text-muted-foreground">
                No hay citas asociadas a este paciente. El registro pre-clínico (motivo de consulta y signos vitales) es cargado por secretaría al recibir al paciente para su cita.
              </CardContent>
            </Card>
          )}

          <PatientQuickActions
            noteCount={detail.noteCount}
            creating={creating}
            generatingEpicrisis={generatingEpicrisis}
            newNoteText={newNoteText}
            onNewNoteTextChange={setNewNoteText}
            onCreateNote={handleCreateNote}
            onGenerateEpicrisis={handleGenerateEpicrisis}
          />

          {/* Gestión de citas para el Médico */}
          <Card className="overflow-hidden border-outline-variant shadow-sm">
            <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60 pb-3">
              <CardTitle className="flex items-center justify-between text-base font-semibold">
                <span className="flex items-center gap-2">
                  <CalendarClock className="size-4 text-primary" />
                  Citas del paciente ({detail.latestCitas?.length ?? 0})
                </span>
                <Button
                  size="sm"
                  className="gap-1.5 shadow-sm"
                  onClick={() => setShowNewCita(true)}
                >
                  <Plus className="size-4" />
                  Nueva cita
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(!detail.latestCitas || detail.latestCitas.length === 0) ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No hay citas agendadas para este paciente. Presiona &quot;Nueva cita&quot; para programar una.
                </div>
              ) : (
                <div className="divide-y divide-outline-variant/40">
                  {detail.latestCitas.map((cita: any) => (
                    <div
                      key={cita.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-accent/20 transition-colors"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {new Date(cita.scheduledAt).toLocaleDateString("es-ES", {
                              weekday: "short",
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <Badge
                            variant={
                              cita.status === "COMPLETED"
                                ? "success"
                                : cita.status === "IN_PROGRESS"
                                  ? "warning"
                                  : cita.status === "CANCELLED"
                                    ? "destructive"
                                    : "outline"
                            }
                            className="mono-label"
                          >
                            {citaStatusLabel(cita.status)}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                          <span>{cita.durationMinutes ?? 30} min</span>
                          {cita.medico && (
                            <span>· Profesional: {cita.medico.fullName || cita.medico.username}</span>
                          )}
                          {cita.reason && <span>· Motivo: {cita.reason}</span>}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {/* Botón .ics */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-8 p-0"
                          title="Exportar a calendario (.ics)"
                          onClick={() => {
                            const start = new Date(cita.scheduledAt);
                            const end = new Date(start.getTime() + (cita.durationMinutes ?? 30) * 60000);
                            const ics = generateIcsFile({
                              summary: `Consulta Médica: ${patient.firstName} ${patient.lastName}`,
                              description: `Cita Médica en DoctorIA. Motivo: ${cita.reason || "Consulta médica"}`,
                              startTime: start,
                              endTime: end,
                              organizer: cita.medico?.fullName || user?.fullName || "Médico Tratante",
                            });
                            const dateStr = start.toISOString().split("T")[0];
                            downloadIcsFile(`Cita_${patient.syntheticId}_${dateStr}`, ics);
                            toast({ title: "📅 Cita exportada a .ics" });
                          }}
                        >
                          <Download className="size-3.5 text-muted-foreground hover:text-primary" />
                        </Button>

                        {cita.status === "SCHEDULED" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingCita(cita)}
                              className="gap-1 text-xs"
                            >
                              <Edit3 className="size-3.5" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              disabled={busyCitaId === cita.id}
                              onClick={() =>
                                handleUpdateCitaStatus(
                                  cita.id,
                                  "IN_PROGRESS",
                                  "Cita iniciada / Asistió",
                                )
                              }
                              className="gap-1 text-xs"
                            >
                              <Play className="size-3.5" />
                              Iniciar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyCitaId === cita.id}
                              onClick={async () => {
                                const ok = await confirm({
                                  title: "¿Cancelar cita médica?",
                                  description: `Se cancelará la cita de ${patient.firstName} ${patient.lastName} y se liberará el cupo en la agenda.`,
                                  confirmText: "Sí, cancelar cita",
                                  variant: "destructive",
                                });
                                if (ok) {
                                  await handleUpdateCitaStatus(
                                    cita.id,
                                    "CANCELLED",
                                    "Cita cancelada",
                                  );
                                }
                              }}
                              className="gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <XCircle className="size-3.5" />
                              Cancelar
                            </Button>
                          </>
                        )}

                        {cita.status === "IN_PROGRESS" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyCitaId === cita.id}
                            onClick={async () => {
                              const ok = await confirm({
                                title: "¿Completar o cancelar consulta en curso?",
                                description: "Puedes marcar la cita como completada una vez atendido el paciente.",
                                confirmText: "Completar atención",
                              });
                              if (ok) {
                                await handleUpdateCitaStatus(
                                  cita.id,
                                  "COMPLETED",
                                  "Consulta completada con éxito",
                                );
                              }
                            }}
                            className="gap-1 text-xs text-primary"
                          >
                            <Activity className="size-3.5" />
                            Completar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <PatientHistoryTimeline
            notes={history?.notes ?? []}
            epicrises={history?.epicrises ?? []}
          />
        </>
      )}

      {canEditPatient && (
        <PatientFormModal
          open={showEdit}
          onOpenChange={setShowEdit}
          initialPatient={patient}
          onDone={() => refetch()}
        />
      )}

      <NewAppointmentModal
        open={Boolean(showNewCita)}
        onOpenChange={setShowNewCita}
        defaultPatientId={patient.id}
        onDone={() => refetch()}
      />

      <EditAppointmentModal
        open={Boolean(editingCita)}
        onOpenChange={(v) => !v && setEditingCita(null)}
        cita={editingCita}
        onDone={() => {
          setEditingCita(null);
          refetch();
        }}
      />

      {printEpicrisisId && (
        <EpicrisisPrintView
          epicrisisId={printEpicrisisId}
          open={!!printEpicrisisId}
          onOpenChange={(v) => !v && setPrintEpicrisisId(null)}
        />
      )}

      {ConfirmDialog}
    </div>
  );
}

function SecretaryView({
  patientId,
  citas,
  printableEpicrises,
  busyCitaId,
  onNewCita,
  onUpdateCitaStatus,
  onPrint,
  onDone,
}: {
  patientId: string;
  citas: any[];
  printableEpicrises: any[];
  busyCitaId: string | null;
  onNewCita: () => void;
  onUpdateCitaStatus: (
    citaId: string,
    status: string,
    label: string,
  ) => Promise<void>;
  onPrint: (id: string) => void;
  onDone: () => void;
}) {
  const activeCita =
    (citas ?? []).find((c: any) => c.status === "SCHEDULED") ||
    (citas ?? []).find((c: any) => c.status === "IN_PROGRESS") ||
    citas?.[0];

  return (
    <>
      {activeCita ? (
        <PreClinicalRecordPanel
          patientId={patientId}
          citaId={activeCita.id}
          readOnly={false}
          onSaved={onDone}
        />
      ) : (
        <Card className="overflow-hidden border-outline-variant bg-surface">
          <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Badge variant="outline" className="mono-label">
                📋 Registro Pre-Clínico
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5 text-sm text-muted-foreground">
            <p>
              El paciente no tiene citas registradas. Para ingresar el registro pre-clínico (motivo de consulta y signos vitales), crea primero una nueva cita.
            </p>
            <Button size="sm" className="gap-1.5" onClick={onNewCita}>
              <Plus className="size-4" />
              Agendar nueva cita
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Gestión de citas del paciente */}
      <Card className="overflow-hidden border-outline-variant">
        <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
          <CardTitle className="flex items-center justify-between text-base font-semibold">
            <span className="flex items-center gap-2">
              <CalendarClock className="size-4 text-primary" />
              Citas del paciente ({citas?.length ?? 0})
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" className="gap-1.5" onClick={onNewCita}>
                <Plus className="size-4" />
                Nueva cita
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(!citas || citas.length === 0) && (
            <div className="p-6 text-sm text-muted-foreground">
              No hay citas programadas para este paciente.
            </div>
          )}
          <div className="divide-y divide-outline-variant/40">
            {(citas ?? []).map((cita: any) => (
              <div
                key={cita.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {new Date(cita.scheduledAt).toLocaleString()}
                    </span>
                    <Badge
                      variant={
                        cita.status === "COMPLETED"
                          ? "success"
                          : cita.status === "IN_PROGRESS"
                            ? "warning"
                            : cita.status === "CANCELLED"
                              ? "destructive"
                              : "outline"
                      }
                      className="mono-label"
                    >
                      {citaStatusLabel(cita.status)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    <span>{cita.durationMinutes ?? 30} min</span>
                    {cita.reason && <span>· Motivo: {cita.reason}</span>}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {cita.status === "SCHEDULED" && (
                    <>
                      <Button
                        size="sm"
                        disabled={busyCitaId === cita.id}
                        onClick={() =>
                          onUpdateCitaStatus(
                            cita.id,
                            "IN_PROGRESS",
                            "Cita iniciada (paciente asistió)",
                          )
                        }
                        className="gap-1 text-xs"
                      >
                        <Play className="size-3.5" />
                        Asistió / Iniciar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyCitaId === cita.id}
                        onClick={() =>
                          onUpdateCitaStatus(
                            cita.id,
                            "NO_SHOW",
                            "Registrado: no asistió",
                          )
                        }
                        className="gap-1 text-xs"
                      >
                        <PhoneMissed className="size-3.5" />
                        No asistió
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyCitaId === cita.id}
                        onClick={() =>
                          onUpdateCitaStatus(
                            cita.id,
                            "CANCELLED",
                            "Cita cancelada (horario liberado)",
                          )
                        }
                        className="gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <XCircle className="size-3.5" />
                        Cancelar cita
                      </Button>
                    </>
                  )}

                  {cita.status === "IN_PROGRESS" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyCitaId === cita.id}
                      onClick={() =>
                        onUpdateCitaStatus(
                          cita.id,
                          "CANCELLED",
                          "Cita cancelada",
                        )
                      }
                      className="gap-1 text-xs text-destructive"
                    >
                      <XCircle className="size-3.5" />
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-outline-variant">
        <CardContent className="space-y-3 p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Epicrisis confirmadas (impresión)
          </p>
          {printableEpicrises.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay epicrisis confirmadas para este paciente.
            </p>
          )}
          <div className="space-y-2">
            {printableEpicrises.map((e: any) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-md border border-outline-variant/60 px-3 py-2"
              >
                <span className="text-sm">
                  {new Date(e.dateTime).toLocaleString()} · {e.noteType}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => onPrint(e.id)}
                >
                  <Printer className="size-3.5" />
                  Imprimir
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
