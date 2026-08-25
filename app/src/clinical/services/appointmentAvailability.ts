// Disponibilidad de agenda (Fase B3): lógica centralizada de huecos libres y
// conflictos. Estados que BLOQUEAN un slot: SCHEDULED e IN_PROGRESS.
// CANCELLED libera el hueco; COMPLETED / NO_SHOW / NOT_STARTED son históricos.

export const BLOCKING_CITA_STATUSES: ReadonlySet<string> = new Set([
  "SCHEDULED",
  "IN_PROGRESS",
]);

export interface Interval {
  startMs: number;
  endMs: number;
}

// Conflicto = solapamiento de intervalos [start, end) (inicio incluido, fin excluido).
export function hasConflict(
  intervals: Interval[],
  startMs: number,
  endMs: number,
): boolean {
  return intervals.some((iv) => iv.startMs < endMs && iv.endMs > startMs);
}

// Slots del día completo (24h): "HH:mm" cada slotMinutes desde las 00:00.
export function buildDaySlots(slotMinutes = 30): string[] {
  const slots: string[] = [];
  const total = Math.floor((24 * 60) / slotMinutes);
  for (let m = 0; m < total; m++) {
    const minutes = m * slotMinutes;
    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mm = String(minutes % 60).padStart(2, "0");
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}

// Filtra slots: descarta pasados (relativos a nowMs) y los que choquen con
// intervalos ocupados. dateISO = "YYYY-MM-DD" en la misma zona horaria con la
// que se muestran los slots.
export function filterFreeSlots(
  slots: string[],
  dateISO: string,
  busy: Interval[],
  durationMinutes: number,
  nowMs: number,
): string[] {
  return slots.filter((hhmm) => {
    const startMs = new Date(`${dateISO}T${hhmm}:00`).getTime();
    if (Number.isNaN(startMs)) return false;
    if (startMs <= nowMs) return false;
    return !hasConflict(busy, startMs, startMs + durationMinutes * 60_000);
  });
}
