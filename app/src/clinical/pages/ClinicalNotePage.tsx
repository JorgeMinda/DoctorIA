import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { routes } from "wasp/client/router";
import { useAction, useQuery } from "wasp/client/operations";
import { getClinicalNote } from "wasp/client/operations";
import {
  confirmClinicalNote,
  createNoteAddendum,
  requestAIStructuring,
  updateClinicalNoteDraft,
} from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import { Button } from "../../client/components/ui/button";
import { Textarea } from "../../client/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../client/components/ui/card";
import { SectionEditor, type SectionDraft } from "../components/SectionEditor";
import { statusLabel } from "../services/statusLabels";
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addendumOpen, setAddendumOpen] = useState(false);
  const [addendumText, setAddendumText] = useState("");
  const [addendumReason, setAddendumReason] = useState("");

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

  if (isLoading) {
    return <div className="mt-10 px-6 lg:m-8">Cargando…</div>;
  }

  if (!note || !user?.isMedico || user.isAdmin) {
    return <div className="mt-10 px-6 lg:m-8">No autorizado.</div>;
  }

  const isConfirmed = note.status === "CONFIRMED";

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateDraftFn({
        noteId: note.id,
        motivoConsulta: draft.sections.motivoConsulta || undefined,
        notaClinica: draft.sections.notaClinica || undefined,
        examenFisico: draft.sections.examenFisico || undefined,
        valoracionClinica: draft.sections.valoracionClinica || undefined,
        planIndicaciones: draft.sections.planIndicaciones || undefined,
        sectionsNotApplicable: draft.sectionsNotApplicable,
      });
      await refetch();
      toast({ title: "Nota clínica guardada correctamente" });
    } catch (err: any) {
      setError(err?.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleRequestAI = async () => {
    setSaving(true);
    setError(null);
    try {
      await requestAIFn({ noteId: note.id });
      await refetch();
      toast({ title: "Nota estructurada con IA" });
    } catch (err: any) {
      setError(err?.message ?? "No se pudo estructurar");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
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
      navigate(routes.ClinicalNoteRoute.build({ params: { noteId: addendum.id } }));
    } catch (err: any) {
      setError(err?.message ?? "No se pudo crear la adenda");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-10 px-6">
      <div className="mb-4 lg:mx-8">
        <h1 className="text-2xl font-bold">
          {note.noteType === "ADDENDUM" ? "Adenda" : "Nota clínica"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {note.patient.firstName} {note.patient.lastName} ({note.patient.syntheticId})
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-semibold">
            {statusLabel(note.status)}
          </span>
          {note.aiAssisted && (
            <span className="bg-accent text-accent-foreground rounded-full px-2.5 py-0.5 text-xs font-semibold">
              Contenido asistido por IA
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {new Date(note.createdAt).toLocaleString()}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 lg:mx-8">
          <Card className="border-destructive/50">
            <CardContent className="p-4 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mb-4 lg:mx-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Texto original (campo unificado)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{note.originalText}</p>
          </CardContent>
        </Card>
      </div>

      {!isConfirmed && (
        <div className="mb-4 lg:mx-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Secciones clínicas estructuradas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SectionEditor draft={draft} onChange={setDraft} />
              <div className="flex flex-wrap gap-2">
                {note.status === "DRAFT_MANUAL" && (
                  <Button onClick={handleRequestAI} disabled={saving}>
                    Estructurar con IA
                  </Button>
                )}
                <Button variant="secondary" onClick={handleSave} disabled={saving}>
                  Guardar cambios
                </Button>
                <Button onClick={handleConfirm} disabled={saving}>
                  Confirmar nota
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isConfirmed && (
        <div className="mb-4 lg:mx-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Secciones clínicas (solo lectura)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {([
                ["motivoConsulta", "Motivo de consulta"],
                ["notaClinica", "Nota clínica / evolución"],
                ["examenFisico", "Examen físico"],
                ["valoracionClinica", "Valoración clínica"],
                ["planIndicaciones", "Plan / indicaciones"],
              ] as [SectionKey, string][]).map(([key, label]) => (
                <div key={key}>
                  <div className="text-sm font-semibold">{label}</div>
                  <p className="text-sm whitespace-pre-wrap">
                    {note[key] ?? (note.sectionsNotApplicable?.[key]
                      ? `No aplica: ${note.sectionsNotApplicable[key]}`
                      : "—")}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {isConfirmed && (
        <div className="mb-4 lg:mx-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Corrección por adenda
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!addendumOpen && (
                <Button variant="outline" onClick={() => setAddendumOpen(true)}>
                  Crear adenda
                </Button>
              )}
              {addendumOpen && (
                <>
                  <Textarea
                    placeholder="Texto de la adenda (campo unificado)"
                    rows={4}
                    value={addendumText}
                    onChange={(e) => setAddendumText(e.target.value)}
                  />
                  <Textarea
                    placeholder="Motivo de la adenda"
                    rows={2}
                    value={addendumReason}
                    onChange={(e) => setAddendumReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleAddendum} disabled={saving || !addendumText || !addendumReason}>
                      Crear adenda
                    </Button>
                    <Button variant="ghost" onClick={() => setAddendumOpen(false)}>
                      Cancelar
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {note.childNotes && note.childNotes.length > 0 && (
        <div className="mb-4 lg:mx-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Adendas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {note.childNotes.map((child: any) => (
                  <div key={child.id} className="px-6 py-4">
                    <div className="text-sm font-semibold">
                      Adenda · {statusLabel(child.status)}
                    </div>
                    <p className="mt-1 text-sm">{child.originalText}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
