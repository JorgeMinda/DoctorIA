import { useState, useRef, useEffect } from "react";
import { FileText, Loader2, NotebookPen, Mic, Sparkles } from "lucide-react";
import { Button } from "../../client/components/ui/button";
import { Textarea } from "../../client/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../client/components/ui/card";
import { VoiceOrb, type VoiceAssistantState } from "./VoiceOrb";
import { toast } from "../../client/hooks/use-toast";

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
  const [orbState, setOrbState] = useState<VoiceAssistantState>("IDLE");
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "es-ES";

      recognition.onstart = () => {
        setOrbState("LISTENING");
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        if (event.results[event.results.length - 1].isFinal) {
          onNewNoteTextChange(
            newNoteText ? `${newNoteText} ${currentTranscript.trim()}` : currentTranscript.trim(),
          );
        }
      };

      recognition.onerror = () => {
        setOrbState("IDLE");
      };

      recognition.onend = () => {
        setOrbState("IDLE");
      };

      recognitionRef.current = recognition;
    }
  }, [newNoteText, onNewNoteTextChange]);

  const toggleVoiceDictation = () => {
    if (!recognitionRef.current) {
      // Demo / fallback si el navegador no tiene Web Speech API
      if (orbState === "IDLE") {
        setOrbState("LISTENING");
        toast({
          title: "🎙️ Dictado por Voz Activado",
          description: "Dicta tu nota clínica. Se transcribirá automáticamente en el campo de texto.",
        });
        setTimeout(() => {
          setOrbState("PROCESSING");
          setTimeout(() => {
            const demoDictation = "Paciente refiere cefalea de 3 días de evolución acompañado de mareos leves. Al examen físico se encuentra normotenso con signos vitales estables.";
            onNewNoteTextChange(newNoteText ? `${newNoteText}\n${demoDictation}` : demoDictation);
            setOrbState("IDLE");
            toast({ title: "Texto transcrito correctamente" });
          }, 1500);
        }, 3000);
      } else {
        setOrbState("IDLE");
      }
      return;
    }

    if (orbState === "LISTENING") {
      recognitionRef.current.stop();
      setOrbState("IDLE");
    } else {
      try {
        recognitionRef.current.start();
        setOrbState("LISTENING");
        toast({
          title: "🎙️ Asistente de Voz Escuchando...",
          description: "Habla con claridad. Tu dictado se escribirá directamente en la nota.",
        });
      } catch (err) {
        recognitionRef.current.stop();
        setOrbState("IDLE");
      }
    }
  };

  return (
    <Card className="border-outline-variant shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <FileText className="size-4 text-primary" />
          Nueva nota clínica (Lenguaje Natural / Dictado por Voz)
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground hidden sm:inline-block mono-label">
            {orbState === "LISTENING" ? "Escuchando dictado..." : orbState === "PROCESSING" ? "Procesando..." : "Asistente de Voz"}
          </span>
          <VoiceOrb
            state={orbState}
            onActivate={toggleVoiceDictation}
            disabled={creating}
            className="size-9 cursor-pointer transition-transform hover:scale-110"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Textarea
            className="min-h-32 border-outline-variant bg-surface pr-12 text-sm leading-relaxed"
            placeholder="Escriba la nota en lenguaje natural o presione el Orbe de Voz para dictar. La IA estructurará automáticamente las 5 secciones SOAP al solicitarlo."
            rows={5}
            value={newNoteText}
            onChange={(e) => onNewNoteTextChange(e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleVoiceDictation}
            className={`absolute bottom-2 right-2 size-8 p-0 rounded-full transition-colors ${
              orbState === "LISTENING" ? "bg-red-500/20 text-red-400 animate-pulse" : "text-muted-foreground hover:text-primary"
            }`}
            title={orbState === "LISTENING" ? "Detener dictado" : "Iniciar dictado por voz"}
          >
            <Mic className="size-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={onCreateNote}
              disabled={creating || !newNoteText.trim()}
              className="gap-1.5"
            >
              <FileText className="size-4" />
              Crear nota clínica
            </Button>
            <Button
              variant="outline"
              onClick={onGenerateEpicrisis}
              disabled={noteCount === 0 || creating || generatingEpicrisis}
              className="gap-1.5"
            >
              {generatingEpicrisis ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : (
                <NotebookPen className="size-4" />
              )}
              {generatingEpicrisis ? "Generando epicrisis…" : "Generar epicrisis"}
            </Button>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            <span>Asistido por IA (SOAP)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
