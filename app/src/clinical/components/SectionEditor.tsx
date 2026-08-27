import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "../../client/components/ui/button";
import { Textarea } from "../../client/components/ui/textarea";
import { Input } from "../../client/components/ui/input";
import { REQUIRED_SECTIONS, SECTION_LABELS, type SectionKey } from "../services/noteValidation";

export interface SectionDraft {
  sections: Partial<Record<SectionKey, string>>;
  sectionsNotApplicable: Record<string, string>;
}

interface SectionEditorProps {
  draft: SectionDraft;
  onChange: (draft: SectionDraft) => void;
  disabled?: boolean;
}

export function SectionEditor({ draft, onChange, disabled = false }: SectionEditorProps) {
  const { sections, sectionsNotApplicable } = draft;
  const [activeRecordingKey, setActiveRecordingKey] = useState<SectionKey | null>(null);
  const recognitionRef = useRef<any>(null);

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setActiveRecordingKey(null);
  };

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  const toggleRecording = (key: SectionKey) => {
    if (activeRecordingKey === key) {
      stopRecording();
      return;
    }

    stopRecording();

    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("El reconocimiento de voz no está disponible en este navegador.");
      return;
    }

    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "es-ES";
    rec.continuous = true;
    rec.interimResults = false;

    rec.onresult = (e: any) => {
      let speech = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          speech += e.results[i][0].transcript + " ";
        }
      }
      if (speech.trim()) {
        const currentVal = sections[key] ?? "";
        const nextVal = currentVal ? `${currentVal.trim()} ${speech.trim()}` : speech.trim();
        update(key, nextVal);
      }
    };

    rec.onerror = () => {
      stopRecording();
    };

    rec.onend = () => {
      if (activeRecordingKey === key) {
        setActiveRecordingKey(null);
        recognitionRef.current = null;
      }
    };

    rec.start();
    setActiveRecordingKey(key);
  };

  const update = (
    key: SectionKey,
    value: string,
    nextNotApplicable: Record<string, string> = sectionsNotApplicable,
  ) => {
    onChange({ sections: { ...sections, [key]: value }, sectionsNotApplicable: nextNotApplicable });
  };

  return (
    <div className="space-y-4">
      {REQUIRED_SECTIONS.map((key) => {
        const isNa = sectionsNotApplicable[key] !== undefined;
        const isRecording = activeRecordingKey === key;
        return (
          <div key={key}>
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold">{SECTION_LABELS[key]}</label>
                {!isNa && !disabled && (
                  <Button
                    type="button"
                    variant={isRecording ? "destructive" : "ghost"}
                    size="sm"
                    onClick={() => toggleRecording(key)}
                    className={`h-6 gap-1 px-2 text-[11px] ${
                      isRecording
                        ? "animate-pulse font-medium text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title={isRecording ? "Detener grabación de voz" : "Dictar esta sección con voz"}
                  >
                    {isRecording ? (
                      <>
                        <MicOff className="size-3" />
                        <span>Grabando voz…</span>
                      </>
                    ) : (
                      <>
                        <Mic className="size-3" />
                        <span>Dictar</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={isNa}
                  onChange={(e) => {
                    const next = { ...sectionsNotApplicable };
                    if (e.target.checked) {
                      next[key] = "";
                      if (activeRecordingKey === key) stopRecording();
                    } else {
                      delete next[key];
                    }
                    update(key, sections[key] ?? "", next);
                  }}
                />
                No aplica
              </label>
            </div>
            {isNa ? (
              <Input
                className="border-outline-variant bg-surface"
                placeholder="Justificación de por qué no aplica esta sección"
                value={sectionsNotApplicable[key] ?? ""}
                onChange={(e) => {
                  const next = { ...sectionsNotApplicable, [key]: e.target.value };
                  update(key, sections[key] ?? "", next);
                }}
              />
            ) : (
              <Textarea
                className={`border-outline-variant bg-surface transition-colors ${
                  isRecording ? "border-primary ring-1 ring-primary/40" : ""
                }`}
                rows={3}
                disabled={disabled}
                value={sections[key] ?? ""}
                onChange={(e) => update(key, e.target.value)}
                placeholder={isRecording ? "Escuchando dictado médico…" : undefined}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
