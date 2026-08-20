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

type SummaryCita = {
  status: string;
};

function statusLabel(status: string): string {
  if (status === "CONFIRMED") return "Confirmadas";
  if (status === "REVIEWED") return "En revisión";
  if (status.startsWith("DRAFT")) return "Borradores";
  if (status === "PROGRAMADA") return "Programadas";
  if (status === "COMPLETADA") return "Completadas";
  if (status === "CANCELADA") return "Canceladas";
  return status;
}

function breakdown(statuses: string[]) {
  const order = [
    "CONFIRMED",
    "REVIEWED",
    "DRAFT",
    "PROGRAMADA",
    "COMPLETADA",
    "CANCELADA",
  ];
  const counts = new Map<string, number>();
  for (const s of statuses) {
    const key = s.startsWith("DRAFT") ? "DRAFT" : s;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return order
    .filter((k) => counts.has(k))
    .map((k) => ({ label: statusLabel(k), count: counts.get(k)! }));
}

function CategoryCard({
  title,
  total,
  statuses,
}: {
  title: string;
  total: number;
  statuses: string[];
}) {
  const items = breakdown(statuses);
  return (
    <div className="rounded-lg border border-outline-variant bg-surface p-3">
      <p className="text-2xl font-semibold text-foreground">{total}</p>
      <p className="mono-label mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Sin registros</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {items.map((it) => (
            <span
              key={it.label}
              className="rounded-full border border-outline-variant bg-surface-container px-2 py-0.5 text-[10px] font-medium text-foreground"
            >
              {it.count} {it.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function PatientClinicalSummary({
  notes,
  epicrises,
  citas = [],
}: {
  notes: SummaryNote[];
  epicrises: SummaryEpicrisis[];
  citas?: SummaryCita[];
}) {
  const addendaStatuses = notes.flatMap((n) => (n.childNotes ?? []).map((c) => c.status));

  const noteStatuses = [
    ...notes.map((n) => n.status),
    ...addendaStatuses,
  ];

  return (
    <Card className="border-outline-variant">
      <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
        <CardTitle className="text-base font-semibold">
          Resumen clínico
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        <CategoryCard title="Notas clínicas" total={notes.length} statuses={noteStatuses} />
        <CategoryCard
          title="Adendas"
          total={addendaStatuses.length}
          statuses={addendaStatuses}
        />
        <CategoryCard
          title="Epicrisis"
          total={epicrises.length}
          statuses={epicrises.map((e) => e.status)}
        />
        <CategoryCard
          title="Citas"
          total={citas.length}
          statuses={citas.map((c) => c.status)}
        />
      </CardContent>
    </Card>
  );
}
