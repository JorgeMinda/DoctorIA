import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useAction, useQuery } from "wasp/client/operations";
import { getPatientById, getPatientHistory } from "wasp/client/operations";
import {
  createClinicalNote,
  generateEpicrisisDraft,
} from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "../../client/components/ui/card";
import { toast } from "../../client/hooks/use-toast";
import { PatientProfileHeader } from "../components/PatientProfileHeader";
import { PatientClinicalSummary } from "../components/PatientClinicalSummary";
import { PatientQuickActions } from "../components/PatientQuickActions";
import { PatientHistoryTimeline } from "../components/PatientHistoryTimeline";

export function ClinicalPatientDetailPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { data: user } = useAuth();

  const [newNoteText, setNewNoteText] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: detail, isLoading: loadingDetail } = useQuery(getPatientById, {
    patientId: patientId ?? "",
  });
  const { data: history, isLoading: loadingHistory } = useQuery(
    getPatientHistory,
    { patientId: patientId ?? "" },
  );

  const createNoteFn = useAction(createClinicalNote);
  const generateEpicrisisFn = useAction(generateEpicrisisDraft);

  if (!user?.isMedico || user.isAdmin) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="border-outline-variant">
          <CardContent className="flex items-start gap-3 p-6 text-sm">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>
              Solo profesionales médicos habilitados pueden acceder a este
              módulo.
            </span>
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
      setCreating(false);
    }
  };

  const handleGenerateEpicrisis = async () => {
    try {
      const epicrisis = await generateEpicrisisFn({ patientId: patientId! });
      toast({ title: "Epicrisis generada correctamente" });
      navigate(
        routes.ClinicalEpicrisisRoute.build({
          params: { epicrisisId: epicrisis.id },
        }),
      );
    } catch (err: any) {
      toast({
        title: "No se pudo generar la epicrisis",
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

      <PatientProfileHeader
        patient={patient}
        noteCount={detail.noteCount}
        epicrisisCount={detail.epicrisisCount}
      />

      <PatientClinicalSummary
        notes={history?.notes ?? []}
        epicrises={history?.epicrises ?? []}
      />

      <PatientQuickActions
        noteCount={detail.noteCount}
        creating={creating}
        newNoteText={newNoteText}
        onNewNoteTextChange={setNewNoteText}
        onCreateNote={handleCreateNote}
        onGenerateEpicrisis={handleGenerateEpicrisis}
      />

      <PatientHistoryTimeline
        notes={history?.notes ?? []}
        epicrises={history?.epicrises ?? []}
      />
    </div>
  );
}
