import { CheckCircle2, Sparkles } from "lucide-react";
import { HighlightedFeature } from "./components/HighlightedFeature";

export function AIReady() {
  return (
    <HighlightedFeature
      name="Epicrisis asistida por IA"
      description="Genera el borrador de la epicrisis a partir de las notas clínicas del paciente. El médico valida cada campo y confirma cuando está lista."
      highlightedComponent={<EpicrisisMockup />}
      direction="row-reverse"
    />
  );
}

function EpicrisisMockup() {
  const fields = [
    { label: "Motivo de ingreso", value: "Dolor torácico atípico" },
    { label: "Antecedentes", value: "Hipertensión controlada" },
    { label: "Evolución", value: "Estable, sin recurrencia" },
    { label: "Condición al egreso", value: "Estable" },
  ];
  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl">
      <div className="mb-4 flex items-center gap-2 text-primary">
        <Sparkles className="size-4" />
        <span className="text-sm font-semibold">Borrador de epicrisis</span>
      </div>
      <div className="space-y-3">
        {fields.map((field) => (
          <div key={field.label} className="rounded-lg bg-muted/40 p-3">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              {field.label}
            </p>
            <p className="text-foreground text-sm">{field.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Listo para revisión médica
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
          <CheckCircle2 className="size-4" />
          Confirmar
        </span>
      </div>
    </div>
  );
}
