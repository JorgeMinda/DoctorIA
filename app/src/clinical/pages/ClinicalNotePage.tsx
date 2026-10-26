import { useState, useCallback } from "react";
import { useQuery, useAction } from "wasp/client/operations";
import { useAuth, useNavigate } from "wasp/client/auth";
import {
  getClinicalNote,
  updateClinicalNoteDraft,
  confirmClinicalNote,
  createNoteAddendum,
  requestAIStructuring,
  createNoteFromVoice,
  deleteClinicalNote,
} from "wasp/client/operations";
import { getPatients } from "wasp/client/operations";
import { AlertCircle, ArrowLeft, Check, FileText, Loader2, MoreHorizontal, Save, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "../../client/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../client/components/ui/card";
import { Badge } from "../../client/components/ui/badge";
import { Separator } from "../../client/components/ui/separator";
import { ScrollArea } from "../../client/components/ui/scroll-area";
import { Textarea } from "../../client/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../client/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../client/components/ui/dropdown-menu";
import { Toaster } from "../../client/components/ui/sonner";
import { statusLabel, statusBadgeVariant } from "../services/statusLabels";
import { routes } from "wasp/client/router";
import { WaspRouterLink } from "wasp/client/router";

export function ClinicalNotePage({ noteId }: { noteId: string }) {
  const navigate = useNavigate();
  const { data: user } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  const { data: note, isLoading, error: noteError, refetch } = useQuery(
    getClinicalNote,
    { noteId },
    { enabled: Boolean(user), staleTime: 10_000, refetchOnWindowFocus: false },
  );

  const [updateDraft, updateDraftLoading] = useAction(updateClinicalNoteDraft);
  const [confirmNote, confirmNoteLoading] = useAction(confirmClinicalNote);
  const [createAddendum, createAddendumLoading] = useAction(createNoteAddendum);
  const [requestAI, requestAILoading] = useAction(requestAIStructuring);
  const [createFromVoice, createFromVoiceLoading] = useAction(createNoteFromVoice);
  const [deleteNote, deleteNoteLoading] = useAction(deleteClinicalNote);

  const { data: patients } = useQuery(getPatients, {}, { enabled: Boolean(user), staleTime: 60_000 });

  const isConfirmed = note?.status === "CONFIRMED";
  const isDraft = note?.status === "DRAFT_MANUAL" || note?.status === "DRAFT_AI_ASSISTED";
  const isReviewed = note?.status === "REVIEWED";
  const isAnyLoading = updateDraftLoading || confirmNoteLoading || createAddendumLoading || requestAILoading || createFromVoiceLoading || deleteNoteLoading;

  const handleSaveDraft = useCallback(async () => {
    if (!note) return;
    await updateDraft({ noteId: note.id, text: editedText });
    setIsEditing(false);
    await refetch();
  }, [note, editedText, updateDraft, refetch]);

  const handleConfirm = useCallback(async () => {
    if (!note) return;
    await confirmNote({ noteId: note.id });
    await refetch();
  }, [note, confirmNote, refetch]);

  const handleCreateAddendum = useCallback(async () => {
    if (!note) return;
    const reason = prompt("Motivo de la adenda (requerido):");
    if (!reason?.trim()) return;
    await createAddendum({ parentNoteId: note.id, addendumReason: reason.trim() });
    await refetch();
  }, [note, createAddendum, refetch]);

  const handleRequestAI = useCallback(async () => {
    if (!note) return;
    await requestAI({ noteId: note.id });
    await refetch();
  }, [note, requestAI, refetch]);

  const handleDelete = useCallback(async () => {
    if (!note) return;
    await deleteNote({ noteId: note.id });
    navigate(routes.ClinicalDashboardRoute.to);
  }, [note, deleteNote, navigate]);

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

  if (noteError || !note) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="border-destructive/50">
          <CardContent className="flex items-start gap-2 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {noteError?.message ?? "Nota no encontrada."}
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAIAssisted = note.status === "DRAFT_AI_ASSISTED";
  const canEdit = isDraft;
  const canConfirm = isDraft || isReviewed;
  const canCreateAddendum = isConfirmed;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Toaster position="top-right" />

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
          {isAIAssisted && (
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
              {isAIAssisted && (
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
                <FileText className="size-3.5" />
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
                  disabled={isDictating || isTranscribing || isStructuring}
                  className="gap-2"
                >
                  {isDictating ? (
                    <>
                      <X className="size-4" />
                      Detener
                    </>
                  ) : isTranscribing ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Transcribiendo…
                    </>
                  ) : isStructuring ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Estructurando…
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

        {isEditing ? (
          <Card className="border-primary/30">
            <CardHeader className="border-b border-outline-variant/50 bg-primary/5">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Save className="size-4 text-primary" />
                Editar borrador
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
                placeholder="Escriba el contenido de la nota clínica…"
                disabled={isAnyLoading}
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isAnyLoading}>
                  <X className="size-4 mr-2" />
                  Cancelar
                </Button>
                <Button onClick={handleSaveDraft} disabled={isAnyLoading}>
                  <Save className="size-4 mr-2" />
                  Guardar borrador
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : isDraft && note.originalText && (
          <Card className="border-primary/30">
            <CardHeader className="border-b border-outline-variant/50 bg-primary/5">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Save className="size-4 text-primary" />
                Borrador estructurado (editable)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="max-h-96">
                <div className="space-y-4 text-sm text-foreground">
                  {Object.entries(note.structuredSections || {}).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <p className="mono-label text-[10px] uppercase tracking-wider text-primary">
                        {key}
                      </p>
                      <p className="whitespace-pre-wrap">{value}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setEditedText(note.originalText); setIsEditing(true); }}>
                  <Edit className="size-4 mr-2" />
                  Editar
                </Button>
                <Button onClick={handleConfirm} disabled={isAnyLoading}>
                  <Check className="size-4 mr-2" />
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
              <Button onClick={handleConfirm} disabled={isAnyLoading}>
                <Check className="size-4 mr-2" />
                Confirmar definitivamente
              </Button>
            </CardContent>
          </Card>
        )}

        {isConfirmed && (
          <Card className="border-success/30">
            <CardHeader className="border-b border-outline-variant/50 bg-success/5">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Check className="size-4 text-success" />
                Nota confirmada (inmutable)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                Esta nota está confirmada y es inmutable. Solo se puede modificar mediante una adenda.
              </p>
              <Button variant="outline" onClick={handleCreateAddendum} disabled={isAnyLoading}>
                <FileText className="size-4 mr-2" />
                Crear adenda
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="border-outline-variant">
          <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
            <CardTitle className="flex items-center justify-between text-base font-semibold">
              <span className="flex items-center gap-2">
                <MoreHorizontal className="size-4 text-muted-foreground" />
                Acciones
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {canEdit && (
                    <>
                      <DropdownMenuItem
                        onClick={() => {
                          setEditedText(note.originalText);
                          setIsEditing(true);
                          setActiveDropdownId(null);
                        }}
                        className="flex items-center gap-2"
                      >
                        <Edit className="size-4" />
                        Editar borrador
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleRequestAI}
                        disabled={isAnyLoading}
                        className="flex items-center gap-2"
                      >
                        <Sparkles className="size-4" />
                        Estructurar con IA
                      </DropdownMenuItem>
                    </>
                  )}
                  {canConfirm && (
                    <DropdownMenuItem
                      onClick={handleConfirm}
                      disabled={isAnyLoading}
                      className="flex items-center gap-2"
                    >
                      <Check className="size-4" />
                      Confirmar
                    </DropdownMenuItem>
                  )}
                  {canCreateAddendum && (
                    <DropdownMenuItem
                      onClick={handleCreateAddendum}
                      disabled={isAnyLoading}
                      className="flex items-center gap-2"
                    >
                      <FileText className="size-4" />
                      Crear adenda
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-4" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardTitle>
          </CardHeader>
          <CardContent />
        </Card>

        {showDeleteConfirm && (
          <Card className="border-destructive/50 fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <CardContent className="w-full max-w-md mx-4 p-6 space-y-4">
              <div className="text-center space-y-2">
                <AlertCircle className="mx-auto size-10 text-destructive" />
                <h3 className="text-lg font-semibold">Eliminar nota clínica</h3>
                <p className="text-sm text-muted-foreground">
                  ¿Está seguro? Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>
                  Cancelar
                </Button>
                <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={isAnyLoading}>
                  <Trash2 className="size-4 mr-2" />
                  Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={statusBadgeVariant(status)} className="mono-label">
      {statusLabel(status)}
    </Badge>
  );
}