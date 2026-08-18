// Agenda de citas: máquina de estados y utilidades de disponibilidad.
// Estados: SCHEDULED → IN_PROGRESS → COMPLETED (compleción), ramas CANCELLED / NO_SHOW.
// "En cita" = `now` dentro de la ventana [scheduledAt, scheduledAt + duration) de una cita activa.

export const CITA_STATES = {
  SCHEDULED: "SCHEDULED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  NO_SHOW: "NO_SHOW",
} as const;

export type CitaStatus = (typeof CITA_STATES)[keyof typeof CITA_STATES];

export const CITA_ACTIVE_STATES: ReadonlySet<string> = new Set<CitaStatus>([
  CITA_STATES.SCHEDULED,
  CITA_STATES.IN_PROGRESS,
]);

const CITA_TRANSITIONS: Record<CitaStatus, CitaStatus[]> = {
  SCHEDULED: [
    CITA_STATES.IN_PROGRESS,
    CITA_STATES.CANCELLED,
    CITA_STATES.NO_SHOW,
  ],
  IN_PROGRESS: [CITA_STATES.COMPLETED, CITA_STATES.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function canTransitionCita(status: string, next: string): boolean {
  return (CITA_TRANSITIONS[status as CitaStatus] ?? []).includes(
    next as CitaStatus,
  );
}

export function isCitaStatusValid(status: string): boolean {
  return status in CITA_STATES;
}

export function isCitaTerminal(status: string): boolean {
  return (
    status === CITA_STATES.COMPLETED ||
    status === CITA_STATES.CANCELLED ||
    status === CITA_STATES.NO_SHOW
  );
}

// Venta de la cita: inicio incluido, fin excluido.
export function citaEndsAt(scheduledAt: Date, durationMinutes: number): Date {
  return new Date(new Date(scheduledAt).getTime() + durationMinutes * 60_000);
}

export interface CitaWindow {
  scheduledAt: Date;
  durationMinutes: number;
  status: string;
}

// "en cita": ventana temporal activa con una cita no finalizada.
export function isCitaOngoing(cita: CitaWindow, now: Date): boolean {
  if (!CITA_ACTIVE_STATES.has(cita.status)) {
    return false;
  }
  const start = new Date(cita.scheduledAt).getTime();
  const end = citaEndsAt(cita.scheduledAt, cita.durationMinutes).getTime();
  return start <= now.getTime() && now.getTime() < end;
}

export function hasOngoingCita(citas: CitaWindow[], now: Date): boolean {
  return citas.some((cita) => isCitaOngoing(cita, now));
}

// Cita "próxima" = la activa no finalizada más cercana (futura o en curso).
export function nextUpcomingCita(
  citas: CitaWindow[],
  now: Date,
): CitaWindow | null {
  const candidates = citas
    .filter((cita) => !isCitaTerminal(cita.status))
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );
  return candidates[0] ?? null;
}
