import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useAction, useQuery } from "wasp/client/operations";
import { getClinicalNote } from "wasp/client/operations";
import {
  confirmClinicalNote,
  createNoteAddendum,
  deleteClinicalNote,
  generateAddendumDraftAction,
  requestAIStructuring,
  updateClinicalNoteDraft,
  updateNoteCIE11,
} from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  FileText,
  FilePlus2,
  Loader2,
  Mic,
  MicOff,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Volume2,
  X,
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
import {
  SectionEditor,
  type SectionDraft,
} from "../components/SectionEditor";
import { StatusBadge } from "../components/StatusBadge";
import { CIE11SearchDialog, type CIE11Result } from "../components/CIE11SearchDialog";
import type { SectionKey } from "../services/noteValidation";
import { extractSuggestedDiagnoses } from "../services/clinicalFormat";
import { useConfirm } from "../../client/hooks/use-confirm";
import { RoleGuard } from "../../client/components/RoleGuard";
import { toast } from "../../client/hooks/use-toast";

export function ClinicalNotePage() {
  return (
    <RoleGuard allowedRoles={["medico"]} fallbackTo="/clinical/patients">
      <ClinicalNotePageContent />
    </RoleGuard>
  );
}

function ClinicalNotePageContent() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const { data: user } = useAuth();

  const { data: note, isLoading, refetch } = useQuery(
    getClinicalNote,
    {
      noteId: noteId ?? "",
    },
    { enabled: Boolean(user && noteId), staleTime: 30_000, refetchOnWindowFocus: false },
  );

  const updateDraftFn = useAction(updateClinicalNoteDraft);
  const requestAIFn = useAction(requestAIStructuring);
  const confirmFn = useAction(confirmClinicalNote);
  const addendumFn = useAction(createNoteAddendum);
  const deleteNoteFn = useAction(deleteClinicalNote);
  const aiAddendumFn = useAction(generateAddendumDraftAction);

  const [draft, setDraft] = useState<SectionDraft>({
    sections: {
      motivoConsulta: "",
      notaClinica: "",
      examenFisico: "",
      valoracionClinica: "",
      planIndicaciones: "",
    },
    sectionsNotApplicable: {},
  });
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [addendumOpen, setAddendumOpen] = useState(false);
  const [addendumText, setAddendumText] = useState("");
  const [addendumReason, setAddendumReason] = useState("");
  const [aiAddendumOpen, setAiAddendumOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [cie11Open, setCie11Open] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  // Dictado por voz a nivel de nota
  const [isDictating, setIsDictating] = useState(false);
  const [dictationTranscript, setDictationTranscript] = useState("");
  const pageRecognitionRef = useRef<any>(null);

  const stopPageDictation = () => {
    if (pageRecognitionRef.current) {
      try {
        pageRecognitionRef.current.stop();
      } catch {
        // ignore
      }
      pageRecognitionRef.current = null;
    }
    setIsDictating(false);
  };

  const startPageDictation = () => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({
        title: "Reconocimiento no disponible",
        description: "Tu navegador no soporta entrada de voz.",
        variant: "destructive",
      });
      return;
    }

    stopPageDictation();

    const rec = new SR();
    pageRecognitionRef.current = rec;
    rec.lang = "es-ES";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: any) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          final += e.results[i][0].transcript + " ";
        } else {
          interim += e.results[i][0].transcript + " ";
        }
      }
      setDictationTranscript((final + interim).trim());
    };

    rec.onerror = (err: any) => {
      console.warn("SpeechRecognition error:", err);
    };

    rec.onend = () => {
      setIsDictating(false);
      pageRecognitionRef.current = null;
    };

    rec.start();
    setIsDictating(true);
  };

  useEffect(() => {
    if (note && !draft.sections.motivoConsulta) {
      // Build sections from individual fields in ClinicalNoteDetail
      const sections = {
        motivoConsulta: note.motivoConsulta || "",
        notaClinica: note.notaClinica || "",
        examenFisico: note.examenFisico || "",
        valoracionClinica: note.valoracionClinica || "",
        planIndicaciones: note.planIndicaciones || "",
      };
      setDraft({
        sections,
        sectionsNotApplicable: (note.sectionsNotApplicable as Record<string, string>) || {},
      });
    }
  }, [note]);

  const isConfirmed = note?.status === "CONFIRMED";
  const isDraftState = note?.status === "DRAFT_MANUAL" || note?.status === "DRAFT_AI_ASSISTED";
  const isReviewed = note?.status === "REVIEWED";

  const handleUpdateDraft = async () => {
    if (!note) return;
    setSaving(true);
    setError(null);
    try {
      await updateDraftFn({
        noteId: note.id,
        text: JSON.stringify(draft.sections),
        sectionsNotApplicable: draft.sectionsNotApplicable,
        expectedUpdatedAt: note.updatedAt.toISOString(),
      });
      await refetch();
    } catch (e: any) {
      setError(e?.message ?? "Error al guardar el borrador");
    } finally {
      setSaving(false);
    }
  };

  const handleRequestAI = async () => {
    if (!note) return;
    setAiBusy(true);
    try {
      await requestAIFn({ noteId: note.id });
      await refetch();
    } catch (e: any) {
      setError(e?.message ?? "Error al solicitar estructuración IA");
    } finally {
      setAiBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!note) return;
    try {
      await confirmFn({ noteId: note.id });
      await refetch();
    } catch (e: any) {
      setError(e?.message ?? "Error al confirmar la nota");
    }
  };

  const handleAddendum = async () => {
    if (!note) return;
    try {
      await addendumFn({
        parentNoteId: note.id,
        originalText: addendumText,
        addendumReason,
      });
      setAddendumOpen(false);
      setAddendumText("");
      setAddendumReason("");
      await refetch();
    } catch (e: any) {
      setError(e?.message ?? "Error al crear la adenda");
    }
  };

  const handleAIAddendum = async () => {
    if (!note) return;
    setAiBusy(true);
    try {
      await aiAddendumFn({ parentNoteId: note.id, instruction: aiInstruction });
      setAiAddendumOpen(false);
      setAiInstruction("");
      await refetch();
    } catch (e: any) {
      setError(e?.message ?? "Error al generar adenda con IA");
    } finally {
      setAiBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!note) return;
    try {
      await deleteNoteFn({ noteId: note.id });
      navigate(routes.ClinicalDashboardRoute.to);
    } catch (e: any) {
      setError(e?.message ?? "Error al eliminar la nota");
    }
  };

  const handleVoiceDictation = async () => {
    if (isDictating) {
      stopPageDictation();
    } else {
      startPageDictation();
    }
  };

  const handleSelectCIE11 = (result: CIE11Result) => {
    if (!note) return;
    updateNoteCIE11({ noteId: note.id, cie11Code: result.code, cie11Description: result.title })
      .then(() => refetch())
      .catch((e: any) => setError(e?.message ?? "Error al asignar CIE-11"));
    setCie11Open(false);
  };

  const suggestedCieTerms = extractSuggestedDiagnoses(note?.originalText ?? "");

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="border-outline-variant">
          <CardContent className="flex items-start gap-3 p-6 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
            Debe iniciar sesión para acceder a esta nota.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-center gap-3 py-10">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Cargando nota clínica…</span>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="border-destructive/50">
          <CardContent className="flex items-start gap-2 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            Nota no encontrada.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <WaspRouterLink
          to={routes.ClinicalDashboardRoute.to}
          className="text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4 shrink-0" />
          Volver
        </WaspRouterLink>
        <div className="flex items-center gap-2">
          <StatusBadge status={note.status} />
          {note.status === "DRAFT_AI_ASSISTED" && (
            <Badge variant="outline" className="gap-1 border-primary/50 text-primary">
              <Sparkles className="size-3" />
              Borrador asistido por IA
            </Badge>
          )}
          {note.aiAssisted && (
            <Badge variant="secondary">
              <Sparkles className="size-3" />
              Asistido por IA
            </Badge>
          )}
          {note.cie11Code && (
            <Badge variant="outline" className="gap-1 border-primary text-primary" title={note.cie11Description ?? undefined}>
              CIE-11: {note.cie11Code}
            </Badge>
          )}
        </div>
      </div>

      <Card className="border-outline-variant">
        <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                <FileText className="size-4 text-primary" />
              </div>
              <div>
                <p className="mono-label mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Nota clínica
                </p>
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  {note.patient.firstName} {note.patient.lastName}
                  <WaspRouterLink
                    to={routes.ClinicalPatientDetailRoute.to}
                    params={{ patientId: note.patient.id }}
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {note.patient.syntheticId}
                  </WaspRouterLink>
                  <Badge variant="outline" className="mono-label">
                    {note.patient.syntheticId}
                  </Badge>
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={note.status} />
              {note.status === "DRAFT_AI_ASSISTED" && (
                <Badge variant="outline" className="gap-1 border-primary/50 text-primary">
                  <Sparkles className="size-3" />
                  Borrador asistido por IA
                </Badge>
              )}
              {note.aiAssisted && (
                <Badge variant="secondary">
                  <Sparkles className="size-3" />
                  Asistido por IA
                </Badge>
              )}
              {note.cie11Code && (
                <Badge variant="outline" className="gap-1 border-primary text-primary" title={note.cie11Description ?? undefined}>
                  CIE-11: {note.cie11Code}
                </Badge>
              )}
              <span className="mono-label inline-flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" />
                {new Date(note.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
        </CardHeader>

        {error && (
          <Card className="border-destructive/50">
            <CardContent className="flex items-start gap-2 p-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </CardContent>
          </Card>
        )}

        <Card className="overflow-hidden border-outline-variant">
          <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <FileText className="size-4 text-primary" />
              Texto original
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap text-foreground">
              {note.originalText}
            </p>
          </CardContent>
        </Card>

        {/* Panel de Dictado Asistido por Voz con IA */}
        {!isConfirmed && (
          <Card className="border-primary/30 bg-gradient-to-r from-primary/5 via-surface to-primary/5 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1 border-primary/50 text-primary">
                      <Sparkles className="size-3" />
                      Dictado por Voz con IA
                    </Badge>
                    {isDictating && (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-500 animate-pulse">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        Escuchando dictado…
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dicte su nota clínica y la IA la estructurará automáticamente según el modelo SOAP.
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={handleVoiceDictation}
                  disabled={aiBusy}
                  className="gap-2"
                >
                  {isDictating ? (
                    <>
                      <MicOff className="size-4" />
                      Detener
                    </>
                  ) : (
                    <>
                      <Mic className="size-4" />
                      Iniciar Dictado
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isDraftState && (
          <Card className="border-primary/30">
            <CardHeader className="border-b border-outline-variant/50 bg-primary/5">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Save className="size-4 text-primary" />
                Borrador estructurado (editable)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SectionEditor
                draft={draft}
                onChange={setDraft}
                isSaving={saving || aiBusy}
                onSave={handleUpdateDraft}
                onRequestAI={handleRequestAI}
              />
              <div className="flex gap-2 pt-2">
                <Button onClick={handleConfirm} disabled={saving || aiBusy}>
                  <ShieldCheck className="size-4 mr-2" />
                  Confirmar nota
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isReviewed && (
          <Card className="border-warning/30">
            <CardHeader className="border-b border-outline-variant/50 bg-warning/5">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <AlertCircle className="size-4 text-warning" />
                En revisión
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                Esta nota ha sido revisada y está pendiente de confirmación final.
              </p>
              <Button onClick={handleConfirm} disabled={saving}>
                <ShieldCheck className="size-4 mr-2" />
                Confirmar definitivamente
              </Button>
            </CardContent>
          </Card>
        )}

        {isConfirmed && (
          <Card className="border-success/30">
            <CardHeader className="border-b border-outline-variant/50 bg-success/5">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <ShieldCheck className="size-4 text-success" />
                Nota confirmada
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                Esta nota está confirmada y es inmutable. Solo se puede modificar mediante una adenda.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAddendumOpen(true)}
                  disabled={saving}
                >
                  <FilePlus2 className="size-4 mr-2" />
                  Crear adenda
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setAiAddendumOpen(true)}
                  disabled={saving}
                >
                  <Sparkles className="size-4 mr-2" />
                  Asistir redacción con IA
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="overflow-hidden border-outline-variant">
          <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
            <CardTitle className="text-base font-semibold">
              Acciones
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-outline-variant/40">
              {!isConfirmed && (
                <>
                  <Button
                    variant="ghost"
                    className="w-full justify-start px-6 py-3 text-left gap-3 hover:bg-accent/40"
                    onClick={() => setDraft(draft)}
                    disabled={saving || aiBusy}
                  >
                    <Save className="size-4" />
                    Guardar borrador
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start px-6 py-3 text-left gap-3 hover:bg-accent/40"
                    onClick={handleRequestAI}
                    disabled={saving || aiBusy}
                  >
                    <Sparkles className="size-4" />
                    Estructurar con IA
                  </Button>
                  {isDraftState && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start px-6 py-3 text-left gap-3 hover:bg-accent/40"
                      onClick={handleConfirm}
                      disabled={saving}
                    >
                      <ShieldCheck className="size-4" />
                      Confirmar nota
                    </Button>
                  )}
                  {isReviewed && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start px-6 py-3 text-left gap-3 hover:bg-accent/40"
                      onClick={handleConfirm}
                      disabled={saving}
                    >
                      <ShieldCheck className="size-4" />
                      Confirmar definitivamente
                    </Button>
                  )}
                </>
              )}
              {isConfirmed && (
                <>
                  <Button
                    variant="ghost"
                    className="w-full justify-start px-6 py-3 text-left gap-3 hover:bg-accent/40"
                    onClick={() => setAddendumOpen(true)}
                    disabled={saving}
                  >
                    <FilePlus2 className="size-4" />
                    Crear adenda
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start px-6 py-3 text-left gap-3 hover:bg-accent/40"
                    onClick={() => setAiAddendumOpen(true)}
                    disabled={saving}
                  >
                    <Sparkles className="size-4" />
                    Asistir redacción con IA
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                className="w-full justify-start px-6 py-3 text-left gap-3 hover:bg-destructive/10 text-destructive"
                onClick={() => confirm("¿Eliminar esta nota clínica? Esta acción no se puede deshacer.", handleDelete)}
              >
                <Trash2 className="size-4" />
                Eliminar nota
              </Button>
            </div>
          </CardContent>
        </Card>

        {note.childNotes && note.childNotes.length > 0 && (
          <Card className="overflow-hidden border-outline-variant">
            <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
              <CardTitle className="text-base font-semibold">
                Adendas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-outline-variant/40">
                {note.childNotes.map((child: any) => (
                  <div key={child.id} className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        Adenda
                      </span>
                      <StatusBadge status={child.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {child.originalText}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        <CIE11SearchDialog
          open={cie11Open}
          onOpenChange={setCie11Open}
          onSelect={handleSelectCIE11}
          initialQuery={suggestedCieTerms[0] ?? ""}
          suggestedTerms={suggestedCieTerms}
        />
        {ConfirmDialog}
      </Card>
    </div>
  );
}