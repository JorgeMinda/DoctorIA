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

// Calcula el timestamp UTC en milisegundos de un slot local ("HH:mm") en una fecha local ("YYYY-MM-DD")
// dado el timezoneOffset del cliente (en minutos, ej. +300 para UTC-5).
export function getSlotStartMs(
  dateISO: string,
  hhmm: string,
  timezoneOffset = 0,
): number {
  const [yearStr, monthStr, dayStr] = dateISO.split("-");
  const [hourStr, minStr] = hhmm.split(":");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const min = parseInt(minStr, 10);

  // Date.UTC da los ms asumiendo que esa hora es UTC.
  // timezoneOffset (de new Date().getTimezoneOffset()) es (UTC - Local) en minutos.
  // Por tanto: LocalTime + timezoneOffset * 60_000 = UTCTime real.
  return Date.UTC(year, month, day, hour, min, 0, 0) + timezoneOffset * 60_000;
}

// Filtra slots: descarta pasados (relativos a nowMs) y los que choquen con
// intervalos ocupados, alineando exactamente con la zona horaria del cliente.
export function filterFreeSlots(
  slots: string[],
  dateISO: string,
  busy: Interval[],
  durationMinutes: number,
  nowMs: number,
  timezoneOffset = 0,
): string[] {
  return slots.filter((hhmm) => {
    const startMs = getSlotStartMs(dateISO, hhmm, timezoneOffset);
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

// Intervalos ocupados de un médico en un día local (solo estados bloqueantes).
export async function getOccupiedSlots(args: {
  citaDelegate: any;
  medicoId: string;
  dateISO: string;
  timezoneOffset?: number;
}): Promise<Interval[]> {
  const offset = args.timezoneOffset ?? 0;
  const dayStartMs = getSlotStartMs(args.dateISO, "00:00", offset);
  const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
  const dayStart = new Date(dayStartMs);
  const dayEnd = new Date(dayEndMs);
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
  const startMs = new Date(args.scheduledAt).getTime();
  const endMs = startMs + args.durationMinutes * 60_000;
  // Búsqueda en ventana de seguridad de ±24h alrededor del timestamp de la cita
  const windowStart = new Date(startMs - 24 * 60 * 60 * 1000);
  const windowEnd = new Date(endMs + 24 * 60 * 60 * 1000);
  const citas = await args.citaDelegate.findMany({
    where: {
      medicoId: args.medicoId,
      status: { in: [...BLOCKING_CITA_STATUSES] },
      scheduledAt: { gte: windowStart, lt: windowEnd },
    },
    select: { id: true, scheduledAt: true, durationMinutes: true },
  });
  const busy = citasToIntervals(citas);
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
