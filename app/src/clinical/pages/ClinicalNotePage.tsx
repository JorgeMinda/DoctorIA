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
  ClipboardList,
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
import {
  CAPTURE_FIELDS,
  applyCaptureAnswer,
  initialCaptureState,
  transition,
  type CaptureEffect,
  type CaptureEvent,
  type CaptureState,
} from "../../client/voice/captureFsm";
import { ttsService } from "../services/tts.service";

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
  const aiProgress = note?.aiProgress ?? null;

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
  const [aiNow, setAiNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [addendumOpen, setAddendumOpen] = useState(false);
  const [addendumText, setAddendumText] = useState("");
  const [addendumReason, setAddendumReason] = useState("");
  const [aiAddendumOpen, setAiAddendumOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [cie11Open, setCie11Open] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  // Cola IA con progreso: mientras se estructura, refresca la nota (aiProgress)
  // y actualiza el reloj para mostrar el tiempo transcurrido.
  useEffect(() => {
    if (!aiBusy) return;
    const elapsed = setInterval(() => setAiNow(Date.now()), 1000);
    const poll = setInterval(() => {
      void refetch();
    }, 1500);
    return () => {
      clearInterval(elapsed);
      clearInterval(poll);
    };
  }, [aiBusy]);

  // Dictado por voz a nivel de nota
  const [isDictating, setIsDictating] = useState(false);
  const [dictationTranscript, setDictationTranscript] = useState("");
  const pageRecognitionRef = useRef<any>(null);

  // Captura guiada (FSM Formulario 002 → secciones SOAP)
  const [capture, setCapture] = useState<CaptureState>(initialCaptureState);
  const captureRef = useRef<CaptureState>(capture);
  const captureRecRef = useRef<any>(null);
  const micSuppressedRef = useRef(false);
  const draftRef = useRef(draft);

  useEffect(() => {
    captureRef.current = capture;
  }, [capture]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const stopCaptureRecognition = () => {
    micSuppressedRef.current = true;
    const rec = captureRecRef.current;
    captureRecRef.current = null;
    if (rec) {
      rec.onend = null;
      rec.onresult = null;
      try {
        rec.stop();
      } catch {
        // ignore
      }
    }
  };

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

    rec.onerror = () => {
      setIsDictating(false);
    };

    rec.onend = () => {
      setIsDictating(false);
      pageRecognitionRef.current = null;
    };

    rec.start();
    setIsDictating(true);
  };

  const updateNoteCIE11Fn = useAction(updateNoteCIE11);

  const handleSelectCIE11 = async (result: CIE11Result) => {
    if (!noteId) return;
    try {
      setSaving(true);
      await updateNoteCIE11Fn({
        noteId,
        cie11Code: result.code,
        cie11Description: result.title,
        cie11Uri: result.uri,
      });
      toast({
        title: "Código CIE-11 asignado",
        description: `${result.code} - ${result.title}`,
      });
    } catch (err: any) {
      toast({
        title: "Error al asignar CIE-11",
        description: err.message || "Intente nuevamente",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

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

  useEffect(() => {
    return () => {
      stopPageDictation();
      stopCaptureRecognition();
      ttsService.stop();
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
      }
    };
  }, []);

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

  const suggestedCieTerms = extractSuggestedDiagnoses(
    draft.sections.valoracionClinica,
    note.valoracionClinica,
    draft.sections.motivoConsulta,
    note.motivoConsulta,
  );

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

  // --- Captura guiada (FSM) ------------------------------------------------
  // El host aplica los efectos de la FSM: TTS (tts.service), micrófono
  // (SpeechRecognition con barge-in) y persistDraft (secciones SOAP).
  const startCaptureRecognition = () => {
    if (captureRecRef.current) return;
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    micSuppressedRef.current = false;
    const rec = new SR();
    captureRecRef.current = rec;
    rec.lang = "es-ES";
    rec.continuous = true;
    rec.interimResults = false;

    rec.onresult = (e: any) => {
      let final = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          final += e.results[i][0].transcript + " ";
        }
      }
      const text = final.trim();
      if (text) dispatchCapture({ type: "TRANSCRIPT", text });
    };

    rec.onerror = () => {
      // Silencioso: onend se encarga de reanudar si la FSM sigue esperando.
    };

    rec.onend = () => {
      if (captureRecRef.current !== rec) return;
      captureRecRef.current = null;
      const st = captureRef.current;
      const waiting = st.step === "LISTEN" || st.step === "CONFIRM";
      if (!micSuppressedRef.current && waiting) {
        startCaptureRecognition();
      }
    };

    try {
      rec.start();
    } catch {
      // ignore
    }
  };

  const runCaptureEffects = (effects: CaptureEffect[]) => {
    for (const eff of effects) {
      switch (eff.type) {
        case "LISTEN_OFF":
          stopCaptureRecognition();
          break;
        case "LISTEN_ON":
          startCaptureRecognition();
          break;
        case "SPEAK":
          // Barge-in: el micrófono se apaga mientras habla el TTS y se
          // reabre con el evento TTS_DONE que dispara onEnd.
          stopCaptureRecognition();
          ttsService.speak(eff.text, {
            onEnd: () => dispatchCapture({ type: "TTS_DONE" }),
          });
          break;
        case "COMMIT": {
          const field = CAPTURE_FIELDS.find((f) => f.id === eff.fieldId);
          if (!field) break;
          const next: SectionDraft = {
            ...draftRef.current,
            sections: { ...draftRef.current.sections },
          };
          next.sections[eff.section] = applyCaptureAnswer(
            next.sections[eff.section],
            field,
            eff.text,
          );
          persistDraft(next);
          break;
        }
        case "FINISHED":
          stopCaptureRecognition();
          toast({
            title: "Captura guiada finalizada",
            description: `${Object.keys(eff.answers).length} de ${CAPTURE_FIELDS.length} campos capturados.`,
          });
          break;
        case "CANCELLED":
          stopCaptureRecognition();
          break;
      }
    }
  };

  const dispatchCapture = (ev: CaptureEvent) => {
    const { state, effects } = transition(captureRef.current, ev);
    captureRef.current = state;
    setCapture(state);
    runCaptureEffects(effects);
  };

  const startCapture = () => {
    stopPageDictation();
    ttsService.stop();
    const { state, effects } = transition(initialCaptureState(), { type: "START" });
    captureRef.current = state;
    setCapture(state);
    runCaptureEffects(effects);
  };

  const captureRunning =
    capture.step === "ASK" || capture.step === "LISTEN" || capture.step === "CONFIRM";

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
      const result = await requestAIFn({
        noteId: note.id,
        expectedUpdatedAt: new Date(note.updatedAt).toISOString(),
      });
      if (
        result &&
        typeof result === "object" &&
        "status" in result &&
        (result as { status?: string }).status === "CONFLICT"
      ) {
        // La nota cambió durante la IA: el borrador generado se conserva y el
        // médico decide aplicarlo o mantener sus cambios (human-in-the-loop).
        const draft = (result as {
          aiDraft: {
            motivoConsulta: string | null;
            notaClinica: string | null;
            examenFisico: string | null;
            valoracionClinica: string | null;
            planIndicaciones: string | null;
          };
        }).aiDraft;
        const apply = await confirm({
          title: "El documento cambió mientras la IA procesaba",
          description:
            "La estructuración terminó, pero la nota fue editada en el proceso. ¿Aplicar el borrador de la IA (reemplaza las secciones con el contenido generado) o conservar tus cambios actuales?",
          confirmText: "Aplicar borrador IA",
          cancelText: "Conservar mis cambios",
          variant: "default",
        });
        if (apply) {
          const payload: {
            noteId: string;
            motivoConsulta?: string;
            notaClinica?: string;
            examenFisico?: string;
            valoracionClinica?: string;
            planIndicaciones?: string;
          } = { noteId: note.id };
          if (draft.motivoConsulta != null) payload.motivoConsulta = draft.motivoConsulta;
          if (draft.notaClinica != null) payload.notaClinica = draft.notaClinica;
          if (draft.examenFisico != null) payload.examenFisico = draft.examenFisico;
          if (draft.valoracionClinica != null) payload.valoracionClinica = draft.valoracionClinica;
          if (draft.planIndicaciones != null) payload.planIndicaciones = draft.planIndicaciones;
          await updateDraftFn(payload);
          await refetch();
          toast({ title: "Borrador de IA aplicado" });
        } else {
          await refetch();
          toast({ title: "Se conservaron tus cambios" });
        }
        return;
      }
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
    const ok = await confirm({
      title: "¿Confirmar y sellar nota clínica?",
      description:
        "Una vez confirmada, la nota clínica quedará sellada legalmente e inmutable. No podrá editarse directamente y cualquier corrección futura requerirá una adenda formal vinculada.",
      confirmText: "Sí, confirmar y sellar",
      cancelText: "Seguir revisando",
      variant: "default",
    });
    if (!ok) return;

    setSaving(true);
    setError(null);
    try {
      await persistNow();
      await confirmFn({ noteId: note.id });
      await refetch();
      toast({ title: "Nota clínica confirmada correctamente" });
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
    const ok = await confirm({
      title: "¿Eliminar este borrador de nota clínica?",
      description:
        "Esta acción descartará el borrador permanentemente. Solo los borradores no confirmados pueden eliminarse.",
      confirmText: "Sí, eliminar borrador",
      cancelText: "Cancelar",
      variant: "destructive",
    });
    if (!ok) return;

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
                  Dicta la consulta médica libremente o pulsa <strong>Estructurar con IA</strong> para organizar automáticamente las secciones SOAP.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isDictating ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={stopPageDictation}
                    className="gap-1.5 animate-pulse"
                  >
                    <MicOff className="size-4" />
                    Detener dictado
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={startPageDictation}
                    disabled={aiBusy || saving || captureRunning}
                    className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                  >
                    <Mic className="size-4" />
                    {dictationTranscript ? "Continuar dictando" : "Dictar consulta por voz"}
                  </Button>
                )}
                {!captureRunning && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={startCapture}
                    disabled={aiBusy || saving}
                    className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                    title="Captura guiada campo por campo según el Formulario 002 (MSP)"
                  >
                    <ClipboardList className="size-4" />
                    Captura guiada (Form. 002)
                  </Button>
                )}
                {note.status === "DRAFT_MANUAL" && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleRequestAI}
                    disabled={saving || aiBusy || captureRunning}
                    className="gap-1.5 shadow-[0_0_15px_rgba(0,218,243,0.25)]"
                  >
                    {aiBusy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )}
                    Estructurar con IA
                  </Button>
                )}
              </div>
            </div>

            {/* Transcripción en vivo si hay dictado */}
            {(isDictating || dictationTranscript) && (
              <div className="mt-3 rounded-lg border border-primary/20 bg-surface/80 p-3 text-sm">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Transcripción del dictado médico:
                </p>
                <p className="italic text-foreground">
                  {dictationTranscript || "Comienza a hablar para dictar la nota clínica…"}
                </p>
              </div>
            )}

            {/* Estado de la captura guiada (FSM Formulario 002) */}
            {captureRunning && (
              <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span className="font-medium">
                      Captura guiada · campo{" "}
                      {Math.min(capture.fieldIndex + 1, CAPTURE_FIELDS.length)}/
                      {CAPTURE_FIELDS.length} —{" "}
                      {CAPTURE_FIELDS[capture.fieldIndex]?.label}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => dispatchCapture({ type: "SKIP" })}
                    >
                      Omitir
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => dispatchCapture({ type: "CANCEL" })}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p>
                    {capture.step === "ASK"
                      ? "Preguntando…"
                      : capture.step === "LISTEN"
                        ? "Escuchando…"
                        : "Confirmando…"}{" "}
                    — di «sí» / «no» para confirmar, «omitir» o «cancelar».
                  </p>
                  {capture.step === "CONFIRM" && capture.captured && (
                    <p className="text-foreground">
                      Último valor: “{capture.captured}”
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isConfirmed && (
        <Card className="overflow-hidden border-outline-variant">
          <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
            <CardTitle className="text-base font-semibold">
              Secciones clínicas estructuradas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {aiBusy && (
              <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  {aiProgress?.state === "QUEUED" ? (
                    <span>
                      En cola de estructuración
                      {aiProgress.position > 0
                        ? ` (posición ${aiProgress.position + 1})`
                        : " (siguiente)"}
                      …
                    </span>
                  ) : aiProgress?.state === "RUNNING" ? (
                    <span>
                      DoctorIA está estructurando la nota…
                      {aiProgress.startedAt
                        ? ` ${Math.max(0, Math.floor((aiNow - aiProgress.startedAt) / 1000))}s`
                        : ""}
                    </span>
                  ) : (
                    <span>DoctorIA está generando un borrador…</span>
                  )}
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-primary/10">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-primary/60" />
                </div>
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
                  disabled={saving || aiBusy || captureRunning}
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
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCie11Open(true)}
                  disabled={saving || aiBusy}
                >
                  Asignar CIE-11
                </Button>
                {suggestedCieTerms.length > 0 && !note.cie11Code && (
                  <button
                    type="button"
                    onClick={() => setCie11Open(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 cursor-pointer"
                    title="Buscar código sugerido en catálogo CIE-11"
                  >
                    <Sparkles className="size-3" />
                    Sugerencia: {suggestedCieTerms[0]}
                  </button>
                )}
              </div>
              <Button
                onClick={handleConfirm}
                disabled={saving || aiBusy || captureRunning}
              >
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
      <CIE11SearchDialog
        open={cie11Open}
        onOpenChange={setCie11Open}
        onSelect={handleSelectCIE11}
        initialQuery={suggestedCieTerms[0] ?? ""}
        suggestedTerms={suggestedCieTerms}
      />
      {ConfirmDialog}
    </div>
  );
}