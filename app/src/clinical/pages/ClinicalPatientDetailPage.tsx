import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useAction, useQuery } from "wasp/client/operations";
import {
  getPatientById,
  getPatientHistory,
  createClinicalNote,
  generateEpicrisisDraft,
  updateCitaStatus,
  getPrintableEpicrises,
} from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import { ArrowLeft, Pencil, ShieldAlert, Plus, Play, Printer } from "lucide-react";
import { Card, CardContent } from "../../client/components/ui/card";
import { Button } from "../../client/components/ui/button";
import { toast } from "../../client/hooks/use-toast";
import { PatientProfileHeader } from "../components/PatientProfileHeader";
import { PatientClinicalSummary } from "../components/PatientClinicalSummary";
import { PatientQuickActions } from "../components/PatientQuickActions";
import { PatientHistoryTimeline } from "../components/PatientHistoryTimeline";
import { PatientFormModal } from "../components/PatientFormModal";
import { VitalSignsForm } from "../components/VitalSignsForm";
import { NewAppointmentModal } from "../components/NewAppointmentModal";
import { PreClinicalRecordPanel } from "../components/PreClinicalRecordPanel";
import { EpicrisisPrintView } from "../components/EpicrisisPrintView";

export function ClinicalPatientDetailPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { data: user } = useAuth();

  const [newNoteText, setNewNoteText] = useState("");
  const [creating, setCreating] = useState(false);
  const [generatingEpicrisis, setGeneratingEpicrisis] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showNewCita, setShowNewCita] = useState(false);
  const [printEpicrisisId, setPrintEpicrisisId] = useState<string | null>(null);

  const { data: detail, isLoading: loadingDetail, refetch } = useQuery(
    getPatientById,
    {
      patientId: patientId ?? "",
    },
  );
  const { data: history, isLoading: loadingHistory, refetch: refetchHistory } =
    useQuery(getPatientHistory, { patientId: patientId ?? "" });

  const createNoteFn = useAction(createClinicalNote);
  const generateEpicrisisFn = useAction(generateEpicrisisDraft);
  const updateStatusFn = useAction(updateCitaStatus);

  const isSecretariaView = !!(
    (user as any)?.isSecretaria &&
    !(user as any)?.isMedico &&
    !(user as any)?.isAdmin
  );

  const { data: printableEpicrises } = useQuery(getPrintableEpicrises, {
    patientId: patientId ?? "",
  });

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
  const scheduledCita = (detail.latestCitas ?? []).find(
    (c: any) => c.status === "SCHEDULED",
  );

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
      setCreating(false);
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
      setGeneratingEpicrisis(false);
    }
  };

  const handleStartCita = async () => {
    if (!scheduledCita) return;
    try {
      await updateStatusFn({
        citaId: scheduledCita.id,
        status: "IN_PROGRESS",
      });
      toast({ title: "Cita iniciada" });
      await refetch();
    } catch (err: any) {
      toast({
        title: "No se pudo iniciar la cita",
        description: err?.message,
        variant: "destructive",
      });
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
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowEdit(true)}
        >
          <Pencil className="size-3.5" />
          Editar paciente
        </Button>
      </div>

      {isSecretariaView ? (
        <SecretaryView
          patientId={patient.id}
          scheduledCita={scheduledCita}
          printableEpicrises={printableEpicrises ?? []}
          onNewCita={() => setShowNewCita(true)}
          onStartCita={handleStartCita}
          onPrint={(id) => setPrintEpicrisisId(id)}
        />
      ) : (
        <>
          <PatientClinicalSummary
            notes={history?.notes ?? []}
            epicrises={history?.epicrises ?? []}
            citas={detail?.latestCitas ?? []}
          />

          <VitalSignsForm patientId={patient.id} />

          <PatientQuickActions
            noteCount={detail.noteCount}
            creating={creating}
            generatingEpicrisis={generatingEpicrisis}
            newNoteText={newNoteText}
            onNewNoteTextChange={setNewNoteText}
            onCreateNote={handleCreateNote}
            onGenerateEpicrisis={handleGenerateEpicrisis}
          />

          <PatientHistoryTimeline
            notes={history?.notes ?? []}
            epicrises={history?.epicrises ?? []}
          />
        </>
      )}

      <PatientFormModal
        open={showEdit}
        onOpenChange={setShowEdit}
        initialPatient={patient}
        onDone={() => refetch()}
      />

      {showNewCita && (
        <NewAppointmentModal
          open={showNewCita}
          onOpenChange={setShowNewCita}
          defaultPatientId={patient.id}
          onDone={() => refetch()}
        />
      )}

      {printEpicrisisId && (
        <EpicrisisPrintView
          epicrisisId={printEpicrisisId}
          open={!!printEpicrisisId}
          onOpenChange={(v) => !v && setPrintEpicrisisId(null)}
        />
      )}
    </div>
  );
}

function SecretaryView({
  patientId,
  scheduledCita,
  printableEpicrises,
  onNewCita,
  onStartCita,
  onPrint,
}: {
  patientId: string;
  scheduledCita: any;
  printableEpicrises: any[];
  onNewCita: () => void;
  onStartCita: () => void;
  onPrint: (id: string) => void;
}) {
  return (
    <>
      {scheduledCita && (
        <PreClinicalRecordPanel
          patientId={patientId}
          citaId={scheduledCita.id}
        />
      )}

      <Card className="overflow-hidden border-outline-variant">
        <CardContent className="flex flex-wrap items-center gap-3 p-5">
          <Button className="gap-1.5" onClick={onNewCita}>
            <Plus className="size-4" />
            Nueva cita
          </Button>
          {scheduledCita && (
            <Button variant="outline" className="gap-1.5" onClick={onStartCita}>
              <Play className="size-4" />
              Iniciar cita
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {scheduledCita
              ? `Cita agendada: ${new Date(
                  scheduledCita.scheduledAt,
                ).toLocaleString()}`
              : "Sin cita agendada."}
          </span>
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
