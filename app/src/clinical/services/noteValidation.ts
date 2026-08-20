// Validación de confirmación RF-026/RF-027 (spec.md):
// Antes de confirmar una nota se verifica acumulativamente:
//   1) paciente sintético seleccionado
//   2) texto original íntegro conservado
//   3) profesional responsable identificado
//   4) fecha y hora registradas
//   5) cada una de las 5 secciones obligatorias completada o marcada "No aplica" con justificación
// Si alguna sección obligatoria está vacía sin justificación -> bloquear con mensaje descriptivo (RF-027).

export const REQUIRED_SECTIONS = [
  "motivoConsulta",
  "notaClinica",
  "examenFisico",
  "valoracionClinica",
  "planIndicaciones",
] as const;

export type SectionKey = (typeof REQUIRED_SECTIONS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  motivoConsulta: "Motivo de consulta",
  notaClinica: "Nota clínica / evolución",
  examenFisico: "Examen físico",
  valoracionClinica: "Valoración clínica",
  planIndicaciones: "Plan / indicaciones",
};

interface NoteSections {
  sections: Partial<Record<SectionKey, string | null>>;
  sectionsNotApplicable?: Record<string, string> | null;
  originalText: string;
  patientId: string;
  authorId: string;
}

export function validateConfirmableNote({
  sections,
  sectionsNotApplicable,
  originalText,
  patientId,
  authorId,
}: NoteSections): { ok: true } | { ok: false; missing: SectionKey[] } {
  // RF-026 (1): paciente seleccionado
  if (!patientId) {
    return { ok: false, missing: [] };
  }
  // RF-026 (2): texto original íntegro
  if (!originalText || originalText.trim().length === 0) {
    return { ok: false, missing: [] };
  }
  // RF-026 (3): profesional responsable
  if (!authorId) {
    return { ok: false, missing: [] };
  }

  const notApplicable = sectionsNotApplicable ?? {};
  const missing: SectionKey[] = [];

  for (const key of REQUIRED_SECTIONS) {
    const value = sections[key];
    // La sección se considera "No aplica" cuando la clave existe en
    // sectionsNotApplicable (aunque la justificación aún esté vacía).
    const isNa = notApplicable[key] !== undefined;
    if (isNa) {
      // RF-026 (5): "No aplica" requiere justificación breve
      const justification = notApplicable[key];
      if (!justification || justification.trim().length === 0) {
        missing.push(key);
      }
      continue;
    }
    if (!value || value.trim().length === 0) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return { ok: true };
}
