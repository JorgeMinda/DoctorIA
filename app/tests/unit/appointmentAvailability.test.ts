// Tests unitarios del servicio de disponibilidad (Fase B3).
// Lógica pura: conflictos por solapamiento, generación de slots 24h y
// liberación del hueco al cancelar.

import { describe, expect, it } from "vitest";

import {
  BLOCKING_CITA_STATUSES,
  buildDaySlots,
  filterFreeSlots,
  hasConflict,
  type Interval,
} from "../../src/clinical/services/appointmentAvailability";

const iv = (startMs: number, minutes: number): Interval => ({
  startMs,
  endMs: startMs + minutes * 60_000,
});

describe("hasConflict", () => {
  const base = new Date("2026-08-25T13:00:00Z").getTime();

  it("detecta solapamiento total y parcial", () => {
    const busy = [iv(base, 30)];
    expect(hasConflict(busy, base + 5 * 60_000, base + 20 * 60_000)).toBe(true);
    expect(hasConflict(busy, base - 10 * 60_000, base + 5 * 60_000)).toBe(true);
    expect(hasConflict(busy, base + 29 * 60_000, base + 59 * 60_000)).toBe(true);
  });

  it("no marca conflicto cuando el intervalo termina exactamente al empezar otro", () => {
    const busy = [iv(base, 30)];
    // inicio incluido / fin excluido: 13:30 no pisa la cita de 13:00-13:30
    expect(hasConflict(busy, base + 30 * 60_000, base + 60 * 60_000)).toBe(false);
  });

  it("libera el hueco cuando la cita que lo ocupaba fue CANCELLED", () => {
    // El servicio solo considera bloqueantes SCHEDULED/IN_PROGRESS.
    expect(BLOCKING_CITA_STATUSES.has("CANCELLED")).toBe(false);
    expect(BLOCKING_CITA_STATUSES.has("COMPLETED")).toBe(false);
    expect(BLOCKING_CITA_STATUSES.has("NO_SHOW")).toBe(false);
    expect(BLOCKING_CITA_STATUSES.has("NOT_STARTED")).toBe(false);
    expect(BLOCKING_CITA_STATUSES.has("SCHEDULED")).toBe(true);
    expect(BLOCKING_CITA_STATUSES.has("IN_PROGRESS")).toBe(true);
  });
});

describe("buildDaySlots", () => {
  it("genera 48 slots cada 30 minutos cubriendo las 24 horas", () => {
    const slots = buildDaySlots(30);
    expect(slots.length).toBe(48);
    expect(slots[0]).toBe("00:00");
    expect(slots[slots.length - 1]).toBe("23:30");
  });
});

describe("filterFreeSlots", () => {
  const day = "2026-08-25";
  const now = new Date("2026-08-25T00:00:00Z").getTime();

  it("excluye slots pasados", () => {
    const free = filterFreeSlots(["00:00", "23:30"], day, [], 30, now + 12 * 3_600_000);
    expect(free).toEqual(["23:30"]);
  });

  it("excluye slots ocupados por una cita activa", () => {
    const busyStart = new Date(`${day}T14:00:00`).getTime();
    const busy: Interval[] = [iv(busyStart, 30)];
    const free = filterFreeSlots(
      ["13:30", "14:00", "14:30"],
      day,
      busy,
      30,
      now,
    );
    expect(free).toEqual(["13:30", "14:30"]);
  });

  it("respeta la duración de la nueva cita (solape parcial cuenta)", () => {
    const busyStart = new Date(`${day}T14:00:00`).getTime();
    const busy: Interval[] = [iv(busyStart, 30)];
    // cita nueva de 60 min a las 13:30 pisa 14:00 → inválido
    const free = filterFreeSlots(["13:30"], day, busy, 60, now);
    expect(free).toEqual([]);
  });
});
