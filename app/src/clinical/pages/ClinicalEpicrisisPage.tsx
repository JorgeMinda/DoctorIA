import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useAction, useQuery } from "wasp/client/operations";
import { getEpicrisis } from "wasp/client/operations";
import {
  confirmEpicrisis,
  createEpicrisisAddendum,
  updateEpicrisisDraft,
  updateEpicrisisCIE11,
  deleteEpicrisis,
  recordEpicrisisExport,
} from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import { pdf } from "@react-pdf/renderer";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  FilePlus2,
  FileText,
  NotebookPen,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useConfirm } from "../../client/hooks/use-confirm";
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
import { CIE11SearchDialog, type CIE11Result } from "../components/CIE11SearchDialog";
import {
  EpicrisisPDFDocument,
  type EpicrisisPDFData,
} from "../components/EpicrisisPDFDocument";
import { toast } from "../../client/hooks/use-toast";

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

import { RoleGuard } from "../../client/components/RoleGuard";

export function ClinicalEpicrisisPage() {
  return (
    <RoleGuard allowedRoles={["medico"]} fallbackTo="/clinical/patients">
      <ClinicalEpicrisisPageContent />
    </RoleGuard>
  );
}

function ClinicalEpicrisisPageContent() {
  const { epicrisisId } = useParams();
  const navigate = useNavigate();
  const { data: user } = useAuth();

  const { data: epicrisis, isLoading, refetch } = useQuery(
    getEpicrisis,
    {
      epicrisisId: epicrisisId ?? "",
    },
    { enabled: Boolean(user && epicrisisId) },
  );

  const updateDraftFn = useAction(updateEpicrisisDraft);
  const confirmFn = useAction(confirmEpicrisis);
  const addendumFn = useAction(createEpicrisisAddendum);
  const deleteEpicrisisFn = useAction(deleteEpicrisis);
  const exportAuditFn = useAction(recordEpicrisisExport);
  const confirm = useConfirm();

  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addendumOpen, setAddendumOpen] = useState(false);
  const [addendumReason, setAddendumReason] = useState("");
  const [addendumDraft, setAddendumDraft] = useState<Record<string, string>>(
    {},
  );
  const [cie11Open, setCie11Open] = useState(false);

  const updateEpicrisisCIE11Fn = useAction(updateEpicrisisCIE11);

  const handleSelectCIE11 = async (result: CIE11Result) => {
    if (!epicrisisId) return;
    try {
      setSaving(true);
      await updateEpicrisisCIE11Fn({
        epicrisisId,
        cie11Code: result.code,
        cie11Description: result.title,
        cie11Uri: result.uri,
      });
      toast({
        title: "Código CIE-11 asignado a epicrisis",
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

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          Cargando epicrisis…
        </div>
      </div>
    );
  }

  if (!epicrisis || !user?.isMedico || user.isAdmin) {
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

  const isConfirmed = epicrisis.status === "CONFIRMED";

  const handleExportPdf = async () => {
    setExporting(true);
    setError(null);
    try {
      // 1. Auditoría primero (RF-019): el servidor valida acceso y registra
      //    EXPORT_EPICRISIS_PDF sin contenido clínico (RNF-002).
      await exportAuditFn({ epicrisisId: epicrisis.id });

      // 2. Generación 100% client-side (@react-pdf/renderer).
      const blob = await pdf(
        <EpicrisisPDFDocument epicrisis={epicrisis as EpicrisisPDFData} />,
      ).toBlob();

      // 3. Descarga con nombre Epicrisis_PAC-XXX_Fecha.pdf.
      const d = new Date(epicrisis.dateTime ?? epicrisis.createdAt);
      const pad = (n: number) => String(n).padStart(2, "0");
      const fecha = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
        d.getDate(),
      )}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Epicrisis_${epicrisis.patient.syntheticId}_${fecha}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast({ title: "Epicrisis exportada a PDF" });
    } catch (err: any) {
      toast({
        title:
          err?.message ?? "No se pudo generar el PDF de la epicrisis",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

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
      toast({ title: "Epicrisis guardada correctamente" });
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
      toast({ title: "Epicrisis confirmada" });
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
      toast({ title: "Adenda de epicrisis creada" });
      navigate(
        routes.ClinicalEpicrisisRoute.build({
          params: { epicrisisId: addendum.id },
        }),
      );
    } catch (err: any) {
      setError(err?.message ?? "No se pudo crear la adenda");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <WaspRouterLink
        to={routes.ClinicalPatientDetailRoute.to}
        params={{ patientId: epicrisis.patient.id }}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-3.5" />
        Volver a la historia de {epicrisis.patient.firstName}{" "}
        {epicrisis.patient.lastName}
      </WaspRouterLink>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mono-label mb-1 text-[11px] uppercase tracking-widest text-primary">
            Epicrisis
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {epicrisis.noteType === "ADDENDUM"
              ? "Adenda de epicrisis"
              : "Epicrisis"}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <WaspRouterLink
              to={routes.ClinicalPatientDetailRoute.to}
              params={{ patientId: epicrisis.patient.id }}
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              {epicrisis.patient.firstName} {epicrisis.patient.lastName}
            </WaspRouterLink>
            <Badge variant="outline" className="mono-label">
              {epicrisis.patient.syntheticId}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={epicrisis.status} />
          {epicrisis.aiAssisted && (
            <Badge variant="secondary">
              <Sparkles className="size-3" />
              Asistido por IA
            </Badge>
          )}
          {epicrisis.cie11Code && (
            <Badge variant="outline" className="gap-1 border-primary text-primary" title={epicrisis.cie11Description ?? undefined}>
              CIE-11: {epicrisis.cie11Code}
            </Badge>
          )}
          <span className="mono-label inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" />
            {new Date(epicrisis.createdAt).toLocaleString()}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleExportPdf}
            disabled={exporting}
          >
            <FileText className="size-3.5" />
            {exporting ? "Generando…" : "Exportar a PDF"}
          </Button>
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
            <NotebookPen className="size-4 text-primary" />
            Elementos de la epicrisis
            {isConfirmed && (
              <Badge variant="success" className="ml-auto">
                Solo lectura
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {epicrisis.aiAssisted && !isConfirmed && (
            <p className="text-xs italic text-muted-foreground">
              La información generada debe ser revisada y validada por el profesional.
            </p>
          )}
          {EPICRISIS_FIELDS.map(([key, label]) => (
            <div key={key}>
              <p className="mono-label mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
              {isConfirmed ? (
                <p className="text-sm whitespace-pre-wrap text-foreground">
                  {epicrisis[key] ?? "—"}
                </p>
              ) : (
                <Textarea
                  className="border-outline-variant bg-surface"
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
              <Button
                variant="secondary"
                onClick={handleSave}
                disabled={saving}
              >
                <Save className="size-4" />
                Guardar cambios
              </Button>
              <Button
                variant="outline"
                onClick={() => setCie11Open(true)}
                disabled={saving}
              >
                Asignar CIE-11
              </Button>
              <Button onClick={handleConfirm} disabled={saving}>
                <ShieldCheck className="size-4" />
                Confirmar epicrisis
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={async () => {
                  const ok = await confirm({
                    title: "¿Eliminar este borrador de epicrisis?",
                    description: "Esta acción descartará el borrador asistido por IA permanentemente.",
                    confirmText: "Sí, eliminar borrador",
                    variant: "destructive",
                  });
                  if (!ok) return;
                  try {
                    setSaving(true);
                    await deleteEpicrisisFn({ epicrisisId: epicrisis.id });
                    toast({ title: "Borrador de epicrisis eliminado" });
                    navigate(
                      routes.ClinicalPatientDetailRoute.build({
                        params: { patientId: epicrisis.patient.id },
                      }),
                    );
                  } catch (err: any) {
                    toast({
                      title: "No se pudo eliminar el borrador",
                      description: err?.message,
                      variant: "destructive",
                    });
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
              >
                <Trash2 className="size-4" />
                Eliminar borrador
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isConfirmed && (
        <Card className="overflow-hidden border-outline-variant">
          <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <FilePlus2 className="size-4 text-primary" />
              Corrección por adenda
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!addendumOpen && (
              <Button
                variant="outline"
                onClick={() => setAddendumOpen(true)}
              >
                Crear adenda
              </Button>
            )}
            {addendumOpen && (
              <>
                <Textarea
                  className="border-outline-variant bg-surface"
                  placeholder="Motivo de la adenda"
                  rows={2}
                  value={addendumReason}
                  onChange={(e) => setAddendumReason(e.target.value)}
                />
                {EPICRISIS_FIELDS.filter(
                  ([key]) => key !== "patientIdentification",
                ).map(([key, label]) => (
                  <div key={key}>
                    <p className="mono-label mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {label}
                    </p>
                    <Textarea
                      className="border-outline-variant bg-surface"
                      rows={2}
                      value={addendumDraft[key] ?? ""}
                      onChange={(e) =>
                        setAddendumDraft((d) => ({
                          ...d,
                          [key]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddendum}
                    disabled={saving || !addendumReason}
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
      <CIE11SearchDialog
        open={cie11Open}
        onOpenChange={setCie11Open}
        onSelect={handleSelectCIE11}
      />
    </div>
  );
}