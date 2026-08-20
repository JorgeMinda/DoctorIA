import { FileText, Loader2, NotebookPen } from "lucide-react";
import { Button } from "../../client/components/ui/button";
import { Textarea } from "../../client/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../client/components/ui/card";

export function PatientQuickActions({
  noteCount,
  creating,
  generatingEpicrisis,
  newNoteText,
  onNewNoteTextChange,
  onCreateNote,
  onGenerateEpicrisis,
}: {
  noteCount: number;
  creating: boolean;
  generatingEpicrisis: boolean;
  newNoteText: string;
  onNewNoteTextChange: (value: string) => void;
  onCreateNote: () => void;
  onGenerateEpicrisis: () => void;
}) {
  return (
    <Card className="border-outline-variant">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <FileText className="size-4 text-primary" />
          Nueva nota clínica
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          className="min-h-32 border-outline-variant bg-surface"
          placeholder="Escriba la nota en lenguaje natural (campo unificado). La IA asistiva estructurará el contenido en las secciones clínicas al solicitarlo."
          rows={5}
          value={newNoteText}
          onChange={(e) => onNewNoteTextChange(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onCreateNote}
            disabled={creating || !newNoteText.trim()}
          >
            <FileText className="size-4" />
            Crear nota
          </Button>
          <Button
            variant="outline"
            onClick={onGenerateEpicrisis}
            disabled={noteCount === 0 || creating || generatingEpicrisis}
          >
            {generatingEpicrisis ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <NotebookPen className="size-4" />
            )}
            {generatingEpicrisis ? "Generando epicrisis…" : "Generar epicrisis"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
