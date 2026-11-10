export interface PatientCategory {
  id: string;
  label: string;
  keywords: string[];
}

export const PATIENT_ATTENTION_CATEGORIES: PatientCategory[] = [
  { id: "all", label: "Todos", keywords: [] },
  {
    id: "general",
    label: "Atención General",
    keywords: ["general", "familia", "medicina interna", "internista"],
  },
  { id: "odontologia", label: "Odontología", keywords: ["odonto", "dental"] },
  { id: "pediatria", label: "Pediatría", keywords: ["pediatr"] },
  { id: "urgencias", label: "Urgencias", keywords: ["urgenc", "emergenc"] },
  { id: "especialidades", label: "Especialidades", keywords: [] },
];

const CATCH_ALL_ID = "especialidades";

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function matchesCategory(
  specialty: string | null | undefined,
  categoryId: string,
): boolean {
  if (categoryId === "all") return true;

  const category = PATIENT_ATTENTION_CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return true;

  const normalizedSpecialty = normalize(specialty);
  const matched = category.keywords.some((keyword) =>
    normalizedSpecialty.includes(normalize(keyword)),
  );

  if (categoryId === CATCH_ALL_ID) {
    return !PATIENT_ATTENTION_CATEGORIES.some(
      (c) => c.id !== "all" && c.id !== CATCH_ALL_ID && c.keywords.length > 0 &&
        c.keywords.some((keyword) => normalizedSpecialty.includes(normalize(keyword))),
    );
  }

  return matched;
}

export function filterDoctorsByCategory<
  T extends { specialty?: string | null },
>(doctors: T[], categoryId: string): T[] {
  return doctors.filter((d) => matchesCategory(d.specialty, categoryId));
}