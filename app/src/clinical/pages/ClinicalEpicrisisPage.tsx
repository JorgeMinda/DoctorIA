import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { routes } from "wasp/client/router";
import { useAction, useQuery } from "wasp/client/operations";
import { getEpicrisis } from "wasp/client/operations";
import {
  confirmEpicrisis,
  createEpicrisisAddendum,
  updateEpicrisisDraft,
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
import { statusLabel } from "../services/statusLabels";

type EpicrisisFieldKey =
  | "patientIdentification"
  | "reasonForAdmission"
  | "relevantHistory"
  | "evolutionSummary"
  | "proceduresResults"
  | "validatedDiagnoses"
  | "conditionAtDischarge"
  | "followUpInstructions";

const EPICRISIS_FIELDS: [EpicrisisFieldKey, string][] = [
  ["patientIdentification", "Identificación del paciente"],
  ["reasonForAdmission", "Motivo de ingreso"],
  ["relevantHistory", "Antecedentes relevantes"],
  ["evolutionSummary", "Resumen de evolución"],
  ["proceduresResults", "Procedimientos y resultados"],
  ["validatedDiagnoses", "Diagnósticos validados"],
  ["conditionAtDischarge", "Condición al egreso"],
  ["followUpInstructions", "Instrucciones de seguimiento"],
];

export function ClinicalEpicrisisPage() {
  const { epicrisisId } = useParams();
  const navigate = useNavigate();
  const { data: user } = useAuth();

  const { data: epicrisis, isLoading, refetch } = useQuery(getEpicrisis, {
    epicrisisId: epicrisisId ?? "",
  });

  const updateDraftFn = useAction(updateEpicrisisDraft);
  const confirmFn = useAction(confirmEpicrisis);
  const addendumFn = useAction(createEpicrisisAddendum);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addendumOpen, setAddendumOpen] = useState(false);
  const [addendumReason, setAddendumReason] = useState("");
  const [addendumDraft, setAddendumDraft] = useState<Record<string, string>>({});

  if (isLoading) {
    return <div className="mt-10 px-6 lg:m-8">Cargando…</div>;
  }

  if (!epicrisis || !user?.isMedico || user.isAdmin) {
    return <div className="mt-10 px-6 lg:m-8">No autorizado.</div>;
  }

  const isConfirmed = epicrisis.status === "CONFIRMED";

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateDraftFn({
        epicrisisId: epicrisis.id,
        reasonForAdmission: epicrisis.reasonForAdmission ?? undefined,
        relevantHistory: epicrisis.relevantHistory ?? undefined,
        evolutionSummary: epicrisis.evolutionSummary ?? undefined,
        proceduresResults: epicrisis.proceduresResults ?? undefined,
        validatedDiagnoses: epicrisis.validatedDiagnoses ?? undefined,
        conditionAtDischarge: epicrisis.conditionAtDischarge ?? undefined,
        followUpInstructions: epicrisis.followUpInstructions ?? undefined,
      });
      await refetch();
    } catch (err: any) {
      setError(err?.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      await confirmFn({ epicrisisId: epicrisis.id });
      await refetch();
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
        parentEpicrisisId: epicrisis.id,
        addendumReason,
        patientIdentification: epicrisis.patientIdentification,
        ...addendumDraft,
      });
      navigate(routes.ClinicalEpicrisisRoute.build({ params: { epicrisisId: addendum.id } }));
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
          {epicrisis.noteType === "ADDENDUM" ? "Adenda de epicrisis" : "Epicrisis"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {epicrisis.patient.firstName} {epicrisis.patient.lastName} ({epicrisis.patient.syntheticId})
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-semibold">
            {statusLabel(epicrisis.status)}
          </span>
          {epicrisis.aiAssisted && (
            <span className="bg-accent text-accent-foreground rounded-full px-2.5 py-0.5 text-xs font-semibold">
              Contenido asistido por IA
            </span>
          )}
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
              Elementos de la epicrisis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {EPICRISIS_FIELDS.map(([key, label]) => (
              <div key={key}>
                <label className="mb-1 block text-sm font-semibold">{label}</label>
                {isConfirmed ? (
                  <p className="text-sm whitespace-pre-wrap">{epicrisis[key] ?? "—"}</p>
                ) : (
                  <Textarea
                    rows={key === "patientIdentification" ? 1 : 3}
                    value={epicrisis[key] ?? ""}
                    readOnly={key === "patientIdentification"}
                    onChange={(e) => {
                      if (key === "patientIdentification") {
                        return;
                      }
                      void updateDraftFn({
                        epicrisisId: epicrisis.id,
                        [key]: e.target.value,
                      });
                    }}
                  />
                )}
              </div>
            ))}
            {!isConfirmed && (
              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="secondary" onClick={handleSave} disabled={saving}>
                  Guardar cambios
                </Button>
                <Button onClick={handleConfirm} disabled={saving}>
                  Confirmar epicrisis
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
                    placeholder="Motivo de la adenda"
                    rows={2}
                    value={addendumReason}
                    onChange={(e) => setAddendumReason(e.target.value)}
                  />
                  {EPICRISIS_FIELDS.filter(([key]) => key !== "patientIdentification").map(
                    ([key, label]) => (
                      <div key={key}>
                        <label className="mb-1 block text-sm font-semibold">{label}</label>
                        <Textarea
                          rows={2}
                          value={addendumDraft[key] ?? ""}
                          onChange={(e) =>
                            setAddendumDraft((d) => ({ ...d, [key]: e.target.value }))
                          }
                        />
                      </div>
                    ),
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddendum}
                      disabled={saving || !addendumReason}
                    >
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
    </div>
  );
}
