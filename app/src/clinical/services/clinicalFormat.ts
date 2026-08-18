export function patientAge(birthDate: Date): number {
  const diff = Date.now() - new Date(birthDate).getTime();
  return Math.max(0, Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000)));
}

export function sexLabel(sex: string): string {
  if (sex === "M") return "Masculino";
  if (sex === "F") return "Femenino";
  return "Otro";
}