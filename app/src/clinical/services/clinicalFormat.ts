export function patientAge(birthDate: Date): number {
  const diff = Date.now() - new Date(birthDate).getTime();
  return Math.max(0, Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000)));
}

export function sexLabel(sex: string): string {
  if (sex === "M") return "Masculino";
  if (sex === "F") return "Femenino";
  return "Otro";
}

/**
 * Extrae términos diagnósticos sugeridos a partir de textos clínicos
 * (por ejemplo de valoracionClinica, motivoConsulta o validatedDiagnoses).
 * Asistivo (Human-in-the-loop): No toma decisiones, solo normaliza términos
 * para facilitar la búsqueda en el catálogo internacional CIE-11.
 */
export function extractSuggestedDiagnoses(
  ...texts: (string | null | undefined)[]
): string[] {
  const suggestions: string[] = [];
  const seen = new Set<string>();

  for (const text of texts) {
    if (!text || typeof text !== "string") continue;

    const lines = text
      .split(/[\n;\r]+/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      const cleaned = line
        .replace(/^(\d+[\.\)]|\-|\*|•|[a-zA-Z]\))\s*/, "")
        .replace(/^Diagn[oó]stico(s)?(\s*presuntivo|\s*definitivo)?:\s*/i, "")
        .replace(/^Impresi[oó]n diagn[oó]stica:\s*/i, "")
        .replace(/^Juicio cl[íi]nico:\s*/i, "")
        .trim();

      // Descartar si coincide con encabezados o indicaciones no diagnósticas
      if (
        /^(Tratamiento|Plan|Recomendaci|Control|Reposo|Signos|Dieta|Medicaci)/i.test(
          cleaned,
        )
      ) {
        continue;
      }

      if (cleaned.length >= 3 && cleaned.length <= 60) {
        const lower = cleaned.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          suggestions.push(cleaned);
        }
      }
    }
  }

  return suggestions.slice(0, 4);
}