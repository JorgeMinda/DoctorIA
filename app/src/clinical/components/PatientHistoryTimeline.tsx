import { Link as WaspRouterLink, routes } from "wasp/client/router";
import {
  CalendarDays,
  ChevronRight,
  FileText,
  NotebookPen,
  UserRound,
} from "lucide-react";
import { Button } from "../../client/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../client/components/ui/card";
import { StatusBadge } from "./StatusBadge";

type Person = {
  fullName: string | null;
  username: string | null;
  email: string | null;
};

type HistoryNoteData = {
  id: string;
  status: string;
  noteType: string;
  originalText: string;
  addendumReason: string | null;
  createdAt: Date | string;
  author: Person;
  confirmedBy: Person | null;
  childNotes: {
    id: string;
    status: string;
    noteType: string;
    originalText: string;
    addendumReason: string | null;
    createdAt: Date | string;
    author: Person;
  }[];
};

type HistoryEpicrisisData = {
  id: string;
  status: string;
  noteType: string;
  addendumReason: string | null;
  reasonForAdmission: string | null;
  validatedDiagnoses: string | null;
  responsibleProfessional: string;
  dateTime: Date | string;
  createdAt: Date | string;
  author: Person;
  confirmedBy: Person | null;
};

function personLabel(person: Person | null): string {
  if (!person) return "—";
  return person.fullName ?? person.username ?? person.email ?? "—";
}

function NoteItem({ note }: { note: HistoryNoteData }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <FileText className="size-4 text-primary" />
              {note.noteType === "ADDENDUM" ? "Adenda" : "Nota clínica"}
            </span>
            <StatusBadge status={note.status} />
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              {new Date(note.createdAt).toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3.5" />
              {personLabel(note.author)}
            </span>
            {note.noteType === "ADDENDUM" && note.addendumReason && (
              <span>· Motivo: {note.addendumReason}</span>
            )}
          </div>
        </div>
        <WaspRouterLink
          to={routes.ClinicalNoteRoute.to}
          params={{ noteId: note.id }}
          className="shrink-0"
        >
          <Button variant="outline" size="sm" className="gap-1.5">
            Ver detalle
            <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </WaspRouterLink>
      </div>
      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
        {note.originalText}
      </p>
    </div>
  );
}

function EpicrisisItem({ epicrisis }: { epicrisis: HistoryEpicrisisData }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <NotebookPen className="size-4 text-primary" />
              {epicrisis.noteType === "ADDENDUM"
                ? "Adenda de epicrisis"
                : "Epicrisis"}
            </span>
            <StatusBadge status={epicrisis.status} />
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              {new Date(epicrisis.createdAt).toLocaleString()}
            </span>
            {epicrisis.responsibleProfessional && (
              <span className="inline-flex items-center gap-1">
                <UserRound className="size-3.5" />
                {epicrisis.responsibleProfessional}
              </span>
            )}
            {epicrisis.noteType === "ADDENDUM" && epicrisis.addendumReason && (
              <span>· Motivo: {epicrisis.addendumReason}</span>
            )}
          </div>
        </div>
        <WaspRouterLink
          to={routes.ClinicalEpicrisisRoute.to}
          params={{ epicrisisId: epicrisis.id }}
          className="shrink-0"
        >
          <Button variant="outline" size="sm" className="gap-1.5">
            Ver detalle
            <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </WaspRouterLink>
      </div>
      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
        {epicrisis.reasonForAdmission ||
          epicrisis.validatedDiagnoses ||
          "Epicrisis sin texto de resumen."}
      </p>
    </div>
  );
}

export function PatientHistoryTimeline({
  notes,
  epicrises,
}: {
  notes: HistoryNoteData[];
  epicrises: HistoryEpicrisisData[];
}) {
  const items: { kind: "note" | "epicrisis"; at: number; key: string }[] = [
    ...notes.map((n) => ({
      kind: "note" as const,
      at: new Date(n.createdAt).getTime(),
      key: n.id,
    })),
    ...epicrises.map((e) => ({
      kind: "epicrisis" as const,
      at: new Date(e.createdAt).getTime(),
      key: e.id,
    })),
  ].sort((a, b) => b.at - a.at);

  const hasContent = notes.length > 0 || epicrises.length > 0;

  return (
    <Card className="overflow-hidden border-outline-variant">
      <CardHeader className="border-b border-outline-variant/50 bg-surface-container/60">
        <CardTitle className="text-base font-semibold">
          Historia clínica
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!hasContent && (
          <div className="p-6 text-sm text-muted-foreground">
            El paciente aún no tiene atenciones registradas.
          </div>
        )}
        {hasContent && (
          <div className="divide-y divide-outline-variant/40">
            {items.map(({ kind, key }) => (
              <div
                key={key}
                className="group px-6 py-4 transition-colors hover:bg-accent/40"
              >
                {kind === "note" ? (
                  <NoteItem note={notes.find((n) => n.id === key)!} />
                ) : (
                  <EpicrisisItem
                    epicrisis={epicrises.find((e) => e.id === key)!}
                  />
                )}
                {kind === "note" &&
                  notes
                    .find((n) => n.id === key)!
                    .childNotes.map((child) => (
                      <div
                        key={child.id}
                        className="mt-4 border-l-2 border-outline-variant/60 pl-4"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            Adenda
                          </span>
                          <StatusBadge status={child.status} />
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="size-3.5" />
                            {new Date(child.createdAt).toLocaleString()}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <UserRound className="size-3.5" />
                            {personLabel(child.author)}
                          </span>
                          {child.addendumReason && (
                            <span>· Motivo: {child.addendumReason}</span>
                          )}
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                          {child.originalText}
                        </p>
                      </div>
                    ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
