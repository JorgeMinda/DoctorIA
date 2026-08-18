import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useAction, useQuery } from "wasp/client/operations";
import {
  getPatientById,
  getPatientHistory,
} from "wasp/client/operations";
import {
  createClinicalNote,
  generateEpicrisisDraft,
} from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  ClipboardPlus,
  FileText,
  NotebookPen,
  ShieldAlert,
} from "lucide-react";
import { Button } from "../../client/components/ui/button";
import { Textarea } from "../../client/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../client/components/ui/card";
import { Badge } from "../../client/components/ui/badge";
import { StatusBadge } from "../components/StatusBadge";
import {
  patientAge,
  sexLabel,
} from "../services/clinicalFormat";
import { toast } from "../../client/hooks/use-toast";

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
      navigate(
        routes.ClinicalNoteRoute.build({ params: { noteId: note.id } }),
      );
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

      <Card className="overflow-hidden border-outline-variant">
        <div className="border-b border-outline-variant/50 bg-surface-container/60 px-6 py-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-lg font-bold text-primary">
              {patient.firstName[0]}
              {patient.lastName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {patient.firstName} {patient.lastName}
                </h1>
                <Badge variant="outline" className="mono-label">
                  {patient.syntheticId}
                </Badge>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{sexLabel(patient.sex)}</span>
                <span>·</span>
                <span>{patientAge(patient.birthDate)} años</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" />
                  nac. {new Date(patient.birthDate).toLocaleDateString()}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <div className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-center">
                <p className="text-lg font-semibold text-foreground">
                  {detail.noteCount}
                </p>
                <p className="mono-label text-[10px] uppercase tracking-wider text-muted-foreground">
                  Notas
                </p>
              </div>
              <div className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-center">
                <p className="text-lg font-semibold text-foreground">
                  {detail.epicrisisCount}
                </p>
                <p className="mono-label text-[10px] uppercase tracking-wider text-muted-foreground">
                  Epicrisis
                </p>
              </div>
            </div>
          </div>
        </div>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <div>
            <p className="mono-label mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              Antecedentes
            </p>
            <p className="text-sm text-foreground">
              {patient.medicalHistory || "Sin antecedentes registrados."}
            </p>
          </div>
          <div>
            <p className="mono-label mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              Alergias
            </p>
            {patient.allergies && patient.allergies.trim() !== "" ? (
              <Badge variant="warning">{patient.allergies}</Badge>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sin alergias registradas.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-outline-variant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ClipboardPlus className="size-4 text-primary" />
            Nueva nota clínica
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            className="min-h-32 border-outline-variant bg-surface"
            placeholder="Escriba la nota en lenguaje natural (campo unificado). La IA asistiva estructurará el contenido en las secciones clínicas al solicitarlo."
            rows={5}
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleCreateNote}
              disabled={creating || !newNoteText.trim()}
            >
              <FileText className="size-4" />
              Crear nota
            </Button>
            <Button
              variant="outline"
              onClick={handleGenerateEpicrisis}
              disabled={detail.noteCount === 0}
            >
              <NotebookPen className="size-4" />
              Generar epicrisis
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-outline-variant">
        <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
          <CardTitle className="text-base font-semibold">
            Historia clínica
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history && history.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">
              El paciente aún no tiene notas clínicas.
            </div>
          )}
          {history && history.length > 0 && (
            <div className="divide-y divide-outline-variant/40">
              {history.map((note: any) => (
                <div key={note.id} className="group px-6 py-4 transition-colors hover:bg-accent/40">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {note.noteType === "ADDENDUM"
                            ? "Adenda"
                            : "Nota clínica"}
                        </span>
                        <StatusBadge status={note.status} />
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-3.5" />
                          {new Date(note.createdAt).toLocaleString()}
                        </span>
                        {note.noteType === "ADDENDUM" &&
                          note.addendumReason && (
                            <span>· Motivo: {note.addendumReason}</span>
                          )}
                      </div>
                    </div>
                    <WaspRouterLink
                      to={routes.ClinicalNoteRoute.to}
                      params={{ noteId: note.id }}
                      className="shrink-0"
                    >
                      <Button variant="outline" size="sm" className="gap-1.5">
                        Ver detalle
                        <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </Button>
                    </WaspRouterLink>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                    {note.originalText}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}