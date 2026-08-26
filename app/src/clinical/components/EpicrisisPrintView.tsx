import { useQuery } from "wasp/client/operations";
import { getEpicrisisForPrint } from "wasp/client/operations";
import { Button } from "../../client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../client/components/ui/dialog";
import { Badge } from "../../client/components/ui/badge";

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground print:text-black/60">
        {label}
      </p>
      <p className="whitespace-pre-wrap text-sm print:text-black">
        {value}
      </p>
    </div>
  );
}

export function EpicrisisPrintView({
  epicrisisId,
  open,
  onOpenChange,
}: {
  epicrisisId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data, isLoading, error } = useQuery(getEpicrisisForPrint, {
    epicrisisId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl print:max-w-full">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="outline" className="mono-label">
              🖨 Epicrisis
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-auto print:max-h-none print:overflow-visible">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          )}
          {error && (
            <p className="text-sm text-destructive">{error.message}</p>
          )}
          {data && (
            <div className="space-y-4 rounded-lg border border-outline-variant bg-white p-6 text-black print:border-0 print:p-0">
              <div className="flex items-center justify-between border-b border-black/10 pb-3">
                <div>
                  <p className="text-lg font-semibold">
                    EPICRISIS CLÍNICA
                  </p>
                  <p className="font-mono text-xs">
                    {data.patient.syntheticId} — {data.patient.firstName}{" "}
                    {data.patient.lastName}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p>{new Date(data.dateTime).toLocaleString()}</p>
                  <p className="uppercase">{data.noteType}</p>
                </div>
              </div>

              <Field label="Identificación" value={data.patientIdentification} />
              <Field label="Motivo de ingreso" value={data.reasonForAdmission} />
              <Field label="Antecedentes relevantes" value={data.relevantHistory} />
              <Field
                label="Resumen de evolución"
                value={data.evolutionSummary}
              />
              <Field
                label="Procedimientos y resultados"
                value={data.proceduresResults}
              />
              <Field
                label="Diagnósticos validados"
                value={data.validatedDiagnoses}
              />
              <Field
                label="Estado al alta"
                value={data.conditionAtDischarge}
              />
              <Field
                label="Indicaciones y seguimiento"
                value={data.followUpInstructions}
              />

              <div className="border-t border-black/10 pt-3 text-right text-sm">
                <p className="font-semibold">
                  {data.responsibleProfessional}
                </p>
                <p className="text-xs uppercase text-muted-foreground print:text-black/60">
                  Profesional responsable
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={() => window.print()}>Imprimir</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
