import { useState } from "react";
import { useAction } from "wasp/client/operations";
import { createVitalSignAction } from "wasp/client/operations";
import { toast } from "../../client/hooks/use-toast";
import { Button } from "../../client/components/ui/button";
import { Input } from "../../client/components/ui/input";
import { Label } from "../../client/components/ui/label";
import { Badge } from "../../client/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../client/components/ui/card";

type VitalField = {
  key: string;
  label: string;
  min: number;
  max: number;
  step?: number;
};

const fields: VitalField[] = [
  { key: "systolicBP", label: "TA sistólica (mmHg)", min: 50, max: 300 },
  { key: "diastolicBP", label: "TA diastólica (mmHg)", min: 20, max: 200 },
  { key: "heartRate", label: "Frec. cardíaca (lpm)", min: 20, max: 300 },
  { key: "temperature", label: "Temperatura (°C)", min: 30, max: 45, step: 0.1 },
  { key: "respiratoryRate", label: "Frec. respiratoria (rpm)", min: 4, max: 80 },
  { key: "oxygenSaturation", label: "Sat. O₂ (%)", min: 40, max: 100 },
  { key: "weight", label: "Peso (kg)", min: 0.1, max: 500, step: 0.1 },
  { key: "height", label: "Talla (cm)", min: 0.1, max: 260, step: 0.1 },
];

type FieldKey = string;

export function VitalSignsForm({
  patientId,
  citaId,
}: {
  patientId: string;
  citaId?: string;
}) {
  const [values, setValues] = useState<Record<FieldKey, string>>({
    systolicBP: "",
    diastolicBP: "",
    heartRate: "",
    temperature: "",
    respiratoryRate: "",
    oxygenSaturation: "",
    weight: "",
    height: "",
  });
  const [saving, setSaving] = useState(false);

  const createFn = useAction(createVitalSignAction);

  const set = (k: FieldKey, v: string) =>
    setValues((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    const payload: any = { patientId };
    if (citaId) payload.citaId = citaId;
    for (const f of fields) {
      const raw = values[f.key];
      if (raw === "") {
        toast({
          title: "Campo incompleto",
          description: `${f.label} es obligatorio.`,
          variant: "destructive",
        });
        return;
      }
      const num = Number(raw);
      if (Number.isNaN(num) || num < f.min || num > f.max) {
        toast({
          title: "Valor fuera de rango",
          description: `${f.label} debe estar entre ${f.min} y ${f.max}.`,
          variant: "destructive",
        });
        return;
      }
      payload[f.key] = num;
    }
    setSaving(true);
    try {
      await createFn(payload);
      toast({ title: "Signos vitales registrados" });
      setValues({
        systolicBP: "",
        diastolicBP: "",
        heartRate: "",
        temperature: "",
        respiratoryRate: "",
        oxygenSaturation: "",
        weight: "",
        height: "",
      });
    } catch (err: any) {
      toast({
        title: "No se pudo registrar",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-outline-variant bg-surface">
      <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Badge variant="outline" className="font-mono">
            📊 Registro Pre-Clínico
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`vs-${f.key}`} className="text-xs">
                {f.label}
              </Label>
              <Input
                id={`vs-${f.key}`}
                type="number"
                step={f.step ?? 1}
                inputMode="decimal"
                value={values[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                className="border-outline-variant bg-surface font-mono"
              />
            </div>
          ))}
        </div>
        <Button onClick={handleSubmit} disabled={saving} className="w-full sm:w-auto">
          {saving ? "Registrando…" : "Registrar signos vitales"}
        </Button>
      </CardContent>
    </Card>
  );
}
