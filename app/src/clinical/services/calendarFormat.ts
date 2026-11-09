// Formatos puros del calendario de citas (título por vista + color por estado).
// Extraídos de ClinicalCalendarView para testing unitario (sin render de React).

export type CalendarViewMode = "day" | "week" | "month" | "year" | "list";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function getCalendarHeaderTitle(
  viewMode: CalendarViewMode,
  currentDate: Date,
): string {
  if (viewMode === "day") {
    return `${currentDate.toLocaleDateString("es-ES", { weekday: "long" })}, ${currentDate.getDate()} de ${MONTHS[currentDate.getMonth()]} de ${currentDate.getFullYear()}`;
  }
  if (viewMode === "week") {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay() || 7;
    startOfWeek.setDate(startOfWeek.getDate() - day + 1);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    return `${startOfWeek.getDate()} ${MONTHS[startOfWeek.getMonth()].slice(0, 3)} - ${endOfWeek.getDate()} ${MONTHS[endOfWeek.getMonth()]} ${endOfWeek.getFullYear()}`;
  }
  if (viewMode === "month") {
    return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }
  if (viewMode === "year") {
    return `Año ${currentDate.getFullYear()}`;
  }
  return "Todas las Citas";
}

export function getCitaStatusColor(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30";
    case "IN_PROGRESS":
      return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse hover:bg-cyan-500/30";
    case "CANCELLED":
      return "bg-destructive/20 text-destructive border-destructive/40 opacity-60";
    default:
      return "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30";
  }
}
