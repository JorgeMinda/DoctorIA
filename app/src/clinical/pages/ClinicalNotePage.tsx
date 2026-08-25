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
} from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  FileText,
  FilePlus2,
  Loader2,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
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
import type { SectionKey } from "../services/noteValidation";
import { toast } from "../../client/hooks/use-toast";

export function ClinicalNotePage() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const { data: user } = useAuth();

  const { data: note, isLoading, refetch } = useQuery(getClinicalNote, {
    noteId: noteId ?? "",
  });

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

  useEffect(() => {
    if (note) {
      setDraft({
        sections: {
          motivoConsulta: note.motivoConsulta ?? "",
          notaClinica: note.notaClinica ?? "",
          examenFisico: note.examenFisico ?? "",
          valoracionClinica: note.valoracionClinica ?? "",
          planIndicaciones: note.planIndicaciones ?? "",
        },
        sectionsNotApplicable: note.sectionsNotApplicable ?? {},
      });
    }
  }, [note?.id]);

  useEffect(
    () => () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
      }
    },
    [],
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          Cargando nota clínica…
        </div>
      </div>
    );
  }

  if (!note || !user?.isMedico || user.isAdmin) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card className="border-destructive/50">
          <CardContent className="flex items-start gap-3 p-6 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            No autorizado.
          </CardContent>
        </Card>
      </div>
    );
  }

  const isConfirmed = note.status === "CONFIRMED";

  const persistDraft = (next: SectionDraft) => {
    setDraft(next);
    if (note.status === "CONFIRMED") {
      return;
    }
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
    }
    autosaveTimer.current = setTimeout(() => {
      void updateDraftFn({
        noteId: note.id,
        motivoConsulta: next.sections.motivoConsulta || undefined,
        notaClinica: next.sections.notaClinica || undefined,
        examenFisico: next.sections.examenFisico || undefined,
        valoracionClinica: next.sections.valoracionClinica || undefined,
        planIndicaciones: next.sections.planIndicaciones || undefined,
        sectionsNotApplicable: next.sectionsNotApplicable,
      }).catch((err: any) => {
        setError(err?.message ?? "No se pudo guardar automáticamente");
      });
    }, 400);
  };

  const persistNow = async (next: SectionDraft = draft) => {
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    await updateDraftFn({
      noteId: note.id,
      motivoConsulta: next.sections.motivoConsulta || undefined,
      notaClinica: next.sections.notaClinica || undefined,
      examenFisico: next.sections.examenFisico || undefined,
      valoracionClinica: next.sections.valoracionClinica || undefined,
      planIndicaciones: next.sections.planIndicaciones || undefined,
      sectionsNotApplicable: next.sectionsNotApplicable,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await persistNow();
      await refetch();
      toast({ title: "Nota clínica guardada correctamente" });
    } catch (err: any) {
      setError(err?.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  // Mensaje unificado (kickoff Fase 6) para 409 (CAS) y 502 (respuesta IA
  // inválida); otros errores muestran el mensaje del servidor.
  const AI_CONFLICT_TOAST = {
    title: "No se pudo aplicar la asistencia de IA",
    description:
      "El documento cambió o la respuesta fue inválida. Recarga para ver los cambios e inténtalo de nuevo.",
  } as const;

  const handleRequestAI = async () => {
    setAiBusy(true);
    setError(null);
    try {
      // Token CAS: versión de la nota vista por el cliente (Fase 7).
      await requestAIFn({
        noteId: note.id,
        expectedUpdatedAt: new Date(note.updatedAt).toISOString(),
      });
      await refetch();
      toast({ title: "Nota estructurada con IA" });
    } catch (err: any) {
      if (err?.statusCode === 409 || err?.statusCode === 502) {
        toast({ ...AI_CONFLICT_TOAST, variant: "destructive" });
        setError(err?.message ?? AI_CONFLICT_TOAST.description);
      } else {
        const msg =
          err?.message ?? "No se pudo estructurar con el asistente de IA";
        setError(msg);
        toast({ title: msg, variant: "destructive" });
      }
    } finally {
      setAiBusy(false);
    }
  };

  const handleAIAddendum = async () => {
    setAiBusy(true);
    setError(null);
    try {
      const addendum = await aiAddendumFn({
        parentNoteId: note.id,
        instruction: aiInstruction,
        expectedUpdatedAt: new Date(note.updatedAt).toISOString(),
      });
      toast({ title: "Borrador de adenda generado con IA" });
      navigate(
        routes.ClinicalNoteRoute.build({
          params: { noteId: (addendum as { id: string }).id },
        }),
      );
    } catch (err: any) {
      if (err?.statusCode === 409 || err?.statusCode === 502) {
        toast({ ...AI_CONFLICT_TOAST, variant: "destructive" });
        setError(err?.message ?? AI_CONFLICT_TOAST.description);
      } else {
        const msg =
          err?.message ?? "No se pudo generar el borrador de la adenda";
        setError(msg);
        toast({ title: msg, variant: "destructive" });
      }
    } finally {
      setAiBusy(false);
    }
  };

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      await persistNow();
      await confirmFn({ noteId: note.id });
      await refetch();
      toast({ title: "Nota clínica confirmada" });
    } catch (err: any) {
      setError(err?.message ?? "No se pudo confirmar");
    } finally {
      setSaving(false);
    }
  };

  const handleAddendum = async () => {
    setSaving(true);
    setError(null);
    try {
      const addendum = await addendumFn({
        parentNoteId: note.id,
        originalText: addendumText,
        addendumReason,
      });
      toast({ title: "Adenda creada correctamente" });
      navigate(
        routes.ClinicalNoteRoute.build({ params: { noteId: addendum.id } }),
      );
    } catch (err: any) {
      setError(err?.message ?? "No se pudo crear la adenda");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      window.setTimeout(() => setConfirmingDelete(false), 6000);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await deleteNoteFn({ noteId: note.id });
      toast({ title: "Nota eliminada correctamente" });
      navigate(
        routes.ClinicalPatientDetailRoute.build({
          params: { patientId: note.patientId },
        }),
      );
    } catch (err: any) {
      setError(err?.message ?? "No se pudo eliminar la nota");
      setConfirmingDelete(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(
      routes.ClinicalPatientDetailRoute.build({
        params: { patientId: note.patientId },
      }),
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <WaspRouterLink
        to={routes.ClinicalPatientDetailRoute.to}
        params={{ patientId: note.patient.id }}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-3.5" />
        Volver a la historia de {note.patient.firstName} {note.patient.lastName}
      </WaspRouterLink>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mono-label mb-1 text-[11px] uppercase tracking-widest text-primary">
            Nota clínica
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {note.noteType === "ADDENDUM" ? "Adenda" : "Nota clínica"}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <WaspRouterLink
              to={routes.ClinicalPatientDetailRoute.to}
              params={{ patientId: note.patient.id }}
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              {note.patient.firstName} {note.patient.lastName}
            </WaspRouterLink>
            <Badge variant="outline" className="mono-label">
              {note.patient.syntheticId}
            </Badge>
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
          <span className="mono-label inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" />
            {new Date(note.createdAt).toLocaleString()}
          </span>
        </div>
      </div>

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
            <Badge variant="outline" className="mono-label">
              Inmutable · RNF-004
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap text-foreground">
            {note.originalText}
          </p>
        </CardContent>
      </Card>

      {!isConfirmed && (
        <Card className="overflow-hidden border-outline-variant">
          <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
            <CardTitle className="text-base font-semibold">
              Secciones clínicas estructuradas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {aiBusy && (
              <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                DoctorIA está generando un borrador…
              </div>
            )}
            <SectionEditor draft={draft} onChange={persistDraft} disabled={aiBusy} />
            {note.status === "DRAFT_AI_ASSISTED" && (
              <p className="text-xs italic text-muted-foreground">
                La información generada debe ser revisada y validada por el profesional.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {note.status === "DRAFT_MANUAL" && (
                <Button
                  onClick={handleRequestAI}
                  disabled={saving || aiBusy}
                  className="shadow-[0_0_20px_rgba(0,218,243,0.25)]"
                >
                  {aiBusy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Estructurar con IA
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={handleSave}
                disabled={saving || aiBusy}
              >
                <Save className="size-4" />
                Actualizar nota
              </Button>
              <Button onClick={handleConfirm} disabled={saving || aiBusy}>
                <ShieldCheck className="size-4" />
                Confirmar nota
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant/60 pt-4">
              <Button
                variant="ghost"
                onClick={handleCancel}
                disabled={saving}
                className="text-muted-foreground"
              >
                <ArrowLeft className="size-4" />
                Cancelar
              </Button>
              {!isConfirmed && (
                <Button
                  variant={
                    confirmingDelete
                      ? "destructive"
                      : "outline"
                  }
                  onClick={handleDeleteNote}
                  disabled={saving}
                >
                  <Trash2 className="size-4" />
                  {confirmingDelete
                    ? "Pulsa de nuevo para confirmar"
                    : "Eliminar nota"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isConfirmed && (
        <Card className="overflow-hidden border-outline-variant">
          <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
            <CardTitle className="text-base font-semibold">
              Secciones clínicas
              <Badge variant="success" className="ml-2">
                Solo lectura
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-outline-variant/40">
            {(
              [
                ["motivoConsulta", "Motivo de consulta"],
                ["notaClinica", "Nota clínica / evolución"],
                ["examenFisico", "Examen físico"],
                ["valoracionClinica", "Valoración clínica"],
                ["planIndicaciones", "Plan / indicaciones"],
              ] as [SectionKey, string][]
            ).map(([key, label]) => (
              <div key={key} className="py-4">
                <p className="mono-label mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <p className="text-sm whitespace-pre-wrap text-foreground">
                  {note[key] ??
                    (note.sectionsNotApplicable?.[key]
                      ? `No aplica: ${note.sectionsNotApplicable[key]}`
                      : "—")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isConfirmed && (
        <Card className="overflow-hidden border-outline-variant">
          <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <FilePlus2 className="size-4 text-primary" />
              Corrección por adenda
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!addendumOpen && !aiAddendumOpen && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAddendumOpen(true)}
                >
                  Crear adenda
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setAiAddendumOpen(true)}
                  disabled={aiBusy}
                  className="gap-1.5"
                >
                  <Sparkles className="size-4 text-primary" />
                  Asistir redacción con IA
                </Button>
              </div>
            )}
            {aiAddendumOpen && (
              <>
                {aiBusy && (
                  <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    DoctorIA está generando un borrador…
                  </div>
                )}
                <Textarea
                  className="border-outline-variant bg-surface"
                  placeholder="Instrucción para el asistente (p. ej.: «Aclarar el plan de analgesia indicado el día 2»)"
                  rows={3}
                  value={aiInstruction}
                  disabled={aiBusy}
                  onChange={(e) => setAiInstruction(e.target.value)}
                />
                <p className="text-xs italic text-muted-foreground">
                  La información generada debe ser revisada y validada por el profesional.
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAIAddendum}
                    disabled={aiBusy || !aiInstruction.trim()}
                  >
                    {aiBusy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    Generar borrador con IA
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setAiAddendumOpen(false);
                      setAiInstruction("");
                    }}
                    disabled={aiBusy}
                  >
                    <X className="size-4" />
                    Cancelar
                  </Button>
                </div>
              </>
            )}
            {addendumOpen && (
              <>
                <Textarea
                  className="border-outline-variant bg-surface"
                  placeholder="Texto de la adenda (campo unificado)"
                  rows={4}
                  value={addendumText}
                  onChange={(e) => setAddendumText(e.target.value)}
                />
                <Textarea
                  className="border-outline-variant bg-surface"
                  placeholder="Motivo de la adenda"
                  rows={2}
                  value={addendumReason}
                  onChange={(e) => setAddendumReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddendum}
                    disabled={
                      saving || !addendumText || !addendumReason
                    }
                  >
                    Crear adenda
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setAddendumOpen(false)}
                  >
                    <X className="size-4" />
                    Cancelar
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}