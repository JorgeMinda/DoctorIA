// Disponibilidad de agenda (Fase B3): lógica centralizada de huecos libres y
// conflictos. Estados que BLOQUEAN un slot: SCHEDULED e IN_PROGRESS.
// CANCELLED libera el hueco; COMPLETED / NO_SHOW / NOT_STARTED son históricos.

import { HttpError } from "wasp/server";

export const BLOCKING_CITA_STATUSES: ReadonlySet<string> = new Set([
  "SCHEDULED",
  "IN_PROGRESS",
]);

export interface Interval {
  id?: string;
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

// Convierte citas bloqueantes en intervalos [start, end).
export function citasToIntervals(
  citas: { id?: string; scheduledAt: Date | string; durationMinutes: number }[],
): Interval[] {
  return citas.map((c) => {
    const startMs = new Date(c.scheduledAt).getTime();
    return { id: c.id, startMs, endMs: startMs + c.durationMinutes * 60_000 };
  });
}

// Intervalos ocupados de un médico en un día (solo estados bloqueantes).
// dateISO = "YYYY-MM-DD" (misma zona que se usa para mostrar los slots).
export async function getOccupiedSlots(args: {
  citaDelegate: any;
  medicoId: string;
  dateISO: string;
}): Promise<Interval[]> {
  const dayStart = new Date(`${args.dateISO}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const citas = await args.citaDelegate.findMany({
    where: {
      medicoId: args.medicoId,
      status: { in: [...BLOCKING_CITA_STATUSES] },
      scheduledAt: { gte: dayStart, lt: dayEnd },
    },
    select: { id: true, scheduledAt: true, durationMinutes: true },
  });
  return citasToIntervals(citas);
}

// Lanza HttpError(409) si el nuevo intervalo solapa con uno ocupado.
// excludeCitaId permite ignorar la propia cita al reagendar.
export async function validateNoOverlap(args: {
  citaDelegate: any;
  medicoId: string;
  scheduledAt: Date | string;
  durationMinutes: number;
  excludeCitaId?: string;
}): Promise<void> {
  const dateISO = new Date(args.scheduledAt).toISOString().slice(0, 10);
  const busy = await getOccupiedSlots({
    citaDelegate: args.citaDelegate,
    medicoId: args.medicoId,
    dateISO,
  });
  const startMs = new Date(args.scheduledAt).getTime();
  const endMs = startMs + args.durationMinutes * 60_000;
  const conflict = busy.some(
    (iv) =>
      iv.id !== args.excludeCitaId &&
      iv.startMs < endMs &&
      iv.endMs > startMs,
  );
  if (conflict) {
    throw new HttpError(409, "El médico ya tiene una cita en ese horario");
  }
}
