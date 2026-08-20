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
}

export function SectionEditor({ draft, onChange }: SectionEditorProps) {
  const { sections, sectionsNotApplicable } = draft;

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
        return (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-semibold">{SECTION_LABELS[key]}</label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isNa}
                  onChange={(e) => {
                    const next = { ...sectionsNotApplicable };
                    if (e.target.checked) {
                      next[key] = "";
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
                className="border-outline-variant bg-surface"
                rows={3}
                value={sections[key] ?? ""}
                onChange={(e) => update(key, e.target.value)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
