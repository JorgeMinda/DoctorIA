import { useState } from "react";
import { useAction, useQuery } from "wasp/client/operations";
import { getPreClinicalRecord, createPreClinicalRecord } from "wasp/client/operations";
import { toast } from "../../client/hooks/use-toast";
import { Button } from "../../client/components/ui/button";
import { Input } from "../../client/components/ui/input";
import { Label } from "../../client/components/ui/label";
import { Textarea } from "../../client/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../client/components/ui/card";
import { Badge } from "../../client/components/ui/badge";

const VITAL_FIELDS = [
  { key: "systolicBP", label: "TA sistólica (mmHg)", min: 50, max: 300 },
  { key: "diastolicBP", label: "TA diastólica (mmHg)", min: 20, max: 200 },
  { key: "heartRate", label: "Frecuencia cardíaca (lpm)", min: 20, max: 300 },
  { key: "temperature", label: "Temperatura (°C)", min: 30, max: 45 },
  {
    key: "respiratoryRate",
    label: "Frecuencia respiratoria (rpm)",
    min: 4,
    max: 80,
  },
  {
    key: "oxygenSaturation",
    label: "Saturación O₂ (%)",
    min: 40,
    max: 100,
  },
  { key: "weight", label: "Peso (kg)", min: 0.1, max: 500 },
  { key: "height", label: "Talla (cm)", min: 1, max: 260 },
] as const;

type VitalKey = (typeof VITAL_FIELDS)[number]["key"];

export function PreClinicalRecordPanel({
  patientId,
  citaId,
  readOnly = false,
  onSaved,
}: {
  patientId: string;
  citaId: string;
  readOnly?: boolean;
  onSaved?: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [vitals, setVitals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    data: existing,
    isLoading,
    refetch,
  } = useQuery(getPreClinicalRecord, {
    citaId,
  });
  const createFn = useAction(createPreClinicalRecord);

  if (isLoading) {
    return (
      <Card className="border-outline-variant">
        <CardContent className="p-5 text-sm text-muted-foreground">
          Cargando registro pre-clínico…
        </CardContent>
      </Card>
    );
  }

  if (existing) {
    return (
      <Card className="overflow-hidden border-outline-variant">
        <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Badge variant="outline" className="mono-label">
              📊 Registro Pre-Clínico
            </Badge>
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
              Registrado por secretaría
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Motivo de consulta
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {existing.motivoConsulta}
            </p>
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              Signos vitales registrados
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {VITAL_FIELDS.map((f) => (
                <div
                  key={f.key}
                  className="rounded-md border border-outline-variant/60 bg-surface-container/30 p-2.5"
                >
                  <p className="text-[11px] text-muted-foreground">{f.label}</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-foreground">
                    {(existing as any)[f.key]}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Registro administrativo previo completado · Bloqueado para edición clínica.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Si no hay registro y la vista es de solo lectura (Médico)
  if (readOnly) {
    return (
      <Card className="overflow-hidden border-outline-variant bg-surface">
        <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Badge variant="outline" className="mono-label">
              📊 Registro Pre-Clínico
            </Badge>
            <span className="text-xs font-normal text-muted-foreground">
              Pendiente
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 text-sm text-muted-foreground">
          Aún no se ha ingresado el registro pre-clínico (signos vitales y motivo de consulta) por parte del personal de secretaría para esta cita.
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = async () => {
    setError(null);
    const parsed: Record<string, number> = {};
    for (const f of VITAL_FIELDS) {
      const raw = vitals[f.key];
      const num = Number(raw);
      if (!raw || Number.isNaN(num)) {
        setError(`"${f.label}" es requerido y debe ser numérico.`);
        return;
      }
      if (num < f.min || num > f.max) {
        setError(`"${f.label}" fuera de rango (${f.min}–${f.max}).`);
        return;
      }
      parsed[f.key] = num;
    }
    if (!motivo.trim()) {
      setError("El motivo de consulta es requerido.");
      return;
    }
    setBusy(true);
    try {
      await createFn({
        citaId,
        patientId,
        motivoConsulta: motivo.trim(),
        ...(parsed as Record<VitalKey, number>),
      });
      toast({ title: "Registro pre-clínico guardado" });
      await refetch();
      onSaved?.();
    } catch (err: any) {
      toast({
        title: "No se pudo guardar",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="overflow-hidden border-outline-variant">
      <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Badge variant="outline" className="mono-label">
            📋 Registro Pre-Clínico
          </Badge>
          <span className="text-xs font-normal text-muted-foreground">
            Ingreso por secretaría
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="pc-motivo">Motivo de consulta</Label>
          <Textarea
            id="pc-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="border-outline-variant bg-surface"
            placeholder="Motivo por el que el paciente acude…"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {VITAL_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`pc-${f.key}`}>{f.label}</Label>
              <Input
                id={`pc-${f.key}`}
                inputMode="decimal"
                value={vitals[f.key] ?? ""}
                onChange={(e) =>
                  setVitals((v) => ({ ...v, [f.key]: e.target.value }))
                }
                className="border-outline-variant bg-surface font-mono"
              />
            </div>
          ))}
        </div>
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
        <Button onClick={handleSubmit} disabled={busy}>
          {busy ? "Guardando…" : "Guardar registro pre-clínico"}
        </Button>
      </CardContent>
    </Card>
  );
}
