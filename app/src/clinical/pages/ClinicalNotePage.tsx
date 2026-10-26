import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useAction, useQuery } from "wasp/client/operations";
import { getClinicalNote } from "wasp/client/operations";
import {
  confirmClinicalNote,
  createNoteAddendum,
  deleteClinicalNote,
  requestAIStructuring,
  updateClinicalNoteDraft,
  createNoteFromVoice,
} from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  FileText,
  Loader2,
  Mic,
  Save,
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
import { StatusBadge } from "../components/StatusBadge";
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

  const [updateDraft, updateDraftLoading] = useAction(updateClinicalNoteDraft);
  const [requestAI, requestAILoading] = useAction(requestAIStructuring);
  const [confirmNote, confirmNoteLoading] = useAction(confirmClinicalNote);
  const [createAddendum, createAddendumLoading] = useAction(createNoteAddendum);
  const [createFromVoice, createFromVoiceLoading] = useAction(createNoteFromVoice);
  const [deleteNote, deleteNoteLoading] = useAction(deleteClinicalNote);

  const isConfirmed = note?.status === "CONFIRMED";
  const isDraft = note?.status === "DRAFT_MANUAL" || note?.status === "DRAFT_AI_ASSISTED";
  const isReviewed = note?.status === "REVIEWED";
  const isAIAssisted = note?.status === "DRAFT_AI_ASSISTED";
  const isAnyLoading = updateDraftLoading || confirmNoteLoading || createAddendumLoading || requestAILoading || createFromVoiceLoading || deleteNoteLoading;

  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSaveDraft = async () => {
    if (!note) return;
    await updateDraft({ noteId: note.id, text: editedText });
    setIsEditing(false);
    await refetch();
  };

  const handleConfirm = async () => {
    if (!note) return;
    await confirmNote({ noteId: note.id });
    await refetch();
  };

  const handleCreateAddendum = async () => {
    if (!note) return;
    const reason = prompt("Motivo de la adenda (requerido):");
    if (!reason?.trim()) return;
    await createAddendum({ parentNoteId: note.id, addendumReason: reason.trim() });
    await refetch();
  };

  const handleRequestAI = async () => {
    if (!note) return;
    await requestAI({ noteId: note.id });
    await refetch();
  };

  const handleDelete = async () => {
    if (!note) return;
    await deleteNote({ noteId: note.id });
    navigate(routes.ClinicalDashboardRoute.to);
  };

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

  const canEdit = isDraft;
  const canConfirm = isDraft || isReviewed;
  const canCreateAddendum = isConfirmed;

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
                <CalendarDays className="size-3.5" />
                {new Date(note.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
        </CardHeader>

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
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setEditedText(note.originalText); setIsEditing(true); }}>
                  Editar
                </Button>
                <Button onClick={handleConfirm} disabled={isAnyLoading}>
                  <Save className="size-4 mr-2" />
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
                <Save className="size-4 mr-2" />
                Confirmar definitivamente
              </Button>
            </CardContent>
          </Card>
        )}

        {isConfirmed && (
          <Card className="border-success/30">
            <CardHeader className="border-b border-outline-variant/50 bg-success/5">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Save className="size-4 text-success" />
                Nota confirmada
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
                Acciones
              </span>
              <div className="flex items-center gap-1">
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setEditedText(note.originalText); setIsEditing(true); }}
                    disabled={isAnyLoading}
                  >
                    Editar
                  </Button>
                )}
                {canConfirm && (
                  <Button
                    size="sm"
                    onClick={handleConfirm}
                    disabled={isAnyLoading}
                  >
                    Confirmar
                  </Button>
                )}
                {canCreateAddendum && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCreateAddendum}
                    disabled={isAnyLoading}
                  >
                    Adenda
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isAnyLoading}
                >
                  <Trash2 className="size-3.5 mr-1.5" />
                  Eliminar
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent />
        </Card>

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <Card className="border-destructive/50 w-full max-w-md mx-4">
              <CardContent className="p-6 space-y-4">
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
          </div>
        )}
      </Card>
    </div>
  );
}