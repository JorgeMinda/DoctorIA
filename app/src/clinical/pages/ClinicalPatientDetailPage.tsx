import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useAction, useQuery } from "wasp/client/operations";
import { getPatientById, getPatientHistory } from "wasp/client/operations";
import { createClinicalNote, generateEpicrisisDraft } from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import { Button } from "../../client/components/ui/button";
import { Textarea } from "../../client/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../client/components/ui/card";
import { statusLabel } from "../services/statusLabels";

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
      <div className="mt-10 px-6">
        <Card className="mb-4 lg:m-8">
          <CardContent className="p-6">
            Solo profesionales médicos habilitados pueden acceder a este módulo.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadingDetail || loadingHistory) {
    return <div className="mt-10 px-6 lg:m-8">Cargando…</div>;
  }

  if (!detail) {
    return (
      <div className="mt-10 px-6 lg:m-8">Paciente no encontrado.</div>
    );
  }

  const handleCreateNote = async () => {
    if (!newNoteText.trim()) return;
    setCreating(true);
    try {
      const note = await createNoteFn({ patientId: patientId!, originalText: newNoteText });
      navigate(routes.ClinicalNoteRoute.build({ params: { noteId: note.id } }));
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateEpicrisis = async () => {
    try {
      const epicrisis = await generateEpicrisisFn({ patientId: patientId! });
      navigate(routes.ClinicalEpicrisisRoute.build({ params: { epicrisisId: epicrisis.id } }));
    } catch (err: any) {
      alert(err?.message ?? "No se pudo generar la epicrisis");
    }
  };

  return (
    <div className="mt-10 px-6">
      <div className="mb-4 lg:mx-8">
        <h1 className="text-2xl font-bold">
          {detail.patient.firstName} {detail.patient.lastName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {detail.patient.syntheticId} · {detail.patient.sex} ·{" "}
          {new Date(detail.patient.birthDate).toLocaleDateString()}
        </p>
        {detail.patient.medicalHistory && (
          <p className="mt-2 text-sm">
            <span className="font-semibold">Antecedentes: </span>
            {detail.patient.medicalHistory}
          </p>
        )}
        {detail.patient.allergies && (
          <p className="mt-1 text-sm">
            <span className="font-semibold">Alergias: </span>
            {detail.patient.allergies}
          </p>
        )}
        <div className="mt-2 flex gap-4 text-sm">
          <span>
            <span className="font-semibold">{detail.noteCount}</span> notas
          </span>
          <span>
            <span className="font-semibold">{detail.epicrisisCount}</span> epicrisis
          </span>
        </div>
      </div>

      <div className="mb-4 lg:mx-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Nueva nota clínica
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Escriba la nota en lenguaje natural (campo unificado). La IA asistiva estructurará el contenido en las secciones clínicas al solicitarlo."
              rows={5}
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleCreateNote} disabled={creating || !newNoteText.trim()}>
                Crear nota
              </Button>
              <Button
                variant="outline"
                onClick={handleGenerateEpicrisis}
                disabled={detail.noteCount === 0}
              >
                Generar epicrisis
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4 lg:mx-8">
        <CardHeader>
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
            <div className="divide-y">
              {history.map((note: any) => (
                <div key={note.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">
                      {note.noteType === "ADDENDUM" ? "Adenda" : "Nota clínica"}
                    </div>
                    <WaspRouterLink
                      to={routes.ClinicalNoteRoute.to}
                      params={{ noteId: note.id }}
                    >
                      <Button variant="outline" size="sm">
                        Ver detalle
                      </Button>
                    </WaspRouterLink>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{statusLabel(note.status)}</span>
                    <span>· {new Date(note.createdAt).toLocaleString()}</span>
                    {note.noteType === "ADDENDUM" && note.addendumReason && (
                      <span>· Motivo: {note.addendumReason}</span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm">
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
