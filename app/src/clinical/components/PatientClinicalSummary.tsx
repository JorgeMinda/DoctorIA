import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../client/components/ui/card";

type SummaryNote = {
  status: string;
  noteType: string;
  childNotes?: { status: string }[];
};

type SummaryEpicrisis = {
  status: string;
};

function tile(className: string, value: number, label: string) {
  return (
    <div
      className={`rounded-lg border border-outline-variant bg-surface px-3 py-2 text-center ${className}`}
    >
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="mono-label text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

export function PatientClinicalSummary({
  notes,
  epicrises,
}: {
  notes: SummaryNote[];
  epicrises: SummaryEpicrisis[];
}) {
  const addendaCount = notes.reduce(
    (acc, note) => acc + (note.childNotes?.length ?? 0),
    0,
  );
  const allStatuses = [
    ...notes,
    ...notes.flatMap((n) => n.childNotes ?? []),
    ...epicrises,
  ].map((n) => n.status);

  const confirmed = allStatuses.filter((s) => s === "CONFIRMED").length;
  const reviewed = allStatuses.filter((s) => s === "REVIEWED").length;
  const drafts = allStatuses.filter((s) => s.startsWith("DRAFT")).length;

  return (
    <Card className="border-outline-variant">
      <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
        <CardTitle className="text-base font-semibold">
          Resumen clínico
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
        {tile("", notes.length, "Atenciones")}
        {tile("", addendaCount, "Adendas")}
        {tile("", confirmed, "Confirmadas")}
        {tile("", reviewed, "En revisión")}
        {tile("", drafts, "Borradores")}
        {tile("", epicrises.length, "Epicrisis")}
      </CardContent>
    </Card>
  );
}
