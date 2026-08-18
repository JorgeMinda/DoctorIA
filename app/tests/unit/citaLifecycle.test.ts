import { describe, expect, it } from "vitest";
import {
  canTransitionCita,
  citaEndsAt,
  hasOngoingCita,
  isCitaOngoing,
  isCitaStatusValid,
  isCitaTerminal,
  nextUpcomingCita,
} from "../../src/clinical/services/citaLifecycle";

const base = {
  scheduledAt: new Date("2026-08-18T10:00:00.000Z"),
  durationMinutes: 30,
  status: "SCHEDULED",
};

describe("isCitaOngoing", () => {
  it("en cita: now dentro de la ventana de una cita SCHEDULED", () => {
    expect(isCitaOngoing(base, new Date("2026-08-18T10:15:00.000Z"))).toBe(
      true,
    );
  });

  it("en cita: IN_PROGRESS dentro de la ventana", () => {
    expect(
      isCitaOngoing(
        { ...base, status: "IN_PROGRESS" },
        new Date("2026-08-18T10:20:00.000Z"),
      ),
    ).toBe(true);
  });

  it("desocupado: antes del inicio", () => {
    expect(isCitaOngoing(base, new Date("2026-08-18T09:59:00.000Z"))).toBe(
      false,
    );
  });

  it("desocupado: al final exacto de la ventana (fin excluido)", () => {
    expect(isCitaOngoing(base, new Date("2026-08-18T10:30:00.000Z"))).toBe(
      false,
    );
  });

  it("desocupado: después del final", () => {
    expect(isCitaOngoing(base, new Date("2026-08-18T11:00:00.000Z"))).toBe(
      false,
    );
  });

  it("desocupado siempre: cita COMPLETED / CANCELLED / NO_SHOW", () => {
    for (const status of ["COMPLETED", "CANCELLED", "NO_SHOW"]) {
      expect(
        isCitaOngoing(
          { ...base, status },
          new Date("2026-08-18T10:10:00.000Z"),
        ),
      ).toBe(false);
    }
  });
});

describe("hasOngoingCita", () => {
  it("true si alguna cita activa está en curso", () => {
    const citas = [
      { ...base, status: "COMPLETED" },
      { ...base, status: "IN_PROGRESS" },
    ];
    expect(hasOngoingCita(citas, new Date("2026-08-18T10:10:00.000Z"))).toBe(
      true,
    );
  });

  it("false si ninguna está en ventana", () => {
    const citas = [{ ...base, status: "SCHEDULED" }];
    expect(hasOngoingCita(citas, new Date("2026-08-18T09:00:00.000Z"))).toBe(
      false,
    );
  });
});

describe("canTransitionCita", () => {
  it("flujo normal SCHEDULED → IN_PROGRESS → COMPLETED", () => {
    expect(canTransitionCita("SCHEDULED", "IN_PROGRESS")).toBe(true);
    expect(canTransitionCita("IN_PROGRESS", "COMPLETED")).toBe(true);
  });

  it("ramas de abandono", () => {
    expect(canTransitionCita("SCHEDULED", "CANCELLED")).toBe(true);
    expect(canTransitionCita("SCHEDULED", "NO_SHOW")).toBe(true);
    expect(canTransitionCita("IN_PROGRESS", "CANCELLED")).toBe(true);
  });

  it("terminales no cambian", () => {
    for (const status of ["COMPLETED", "CANCELLED", "NO_SHOW"]) {
      expect(canTransitionCita(status, "SCHEDULED")).toBe(false);
      expect(canTransitionCita(status, "IN_PROGRESS")).toBe(false);
      expect(canTransitionCita(status, "COMPLETED")).toBe(false);
    }
  });

  it("saltos inválidos", () => {
    expect(canTransitionCita("SCHEDULED", "COMPLETED")).toBe(false);
    expect(canTransitionCita("IN_PROGRESS", "NO_SHOW")).toBe(false);
  });
});

describe("utilidades de estado", () => {
  it("isCitaStatusValid", () => {
    expect(isCitaStatusValid("SCHEDULED")).toBe(true);
    expect(isCitaStatusValid("COMPLETED")).toBe(true);
    expect(isCitaStatusValid("RANDOM")).toBe(false);
  });

  it("isCitaTerminal", () => {
    expect(isCitaTerminal("COMPLETED")).toBe(true);
    expect(isCitaTerminal("CANCELLED")).toBe(true);
    expect(isCitaTerminal("NO_SHOW")).toBe(true);
    expect(isCitaTerminal("SCHEDULED")).toBe(false);
    expect(isCitaTerminal("IN_PROGRESS")).toBe(false);
  });

  it("citaEndsAt suma duración en minutos", () => {
    expect(citaEndsAt(base.scheduledAt, 45).toISOString()).toBe(
      "2026-08-18T10:45:00.000Z",
    );
  });

  it("nextUpcomingCita devuelve la cita no terminal más cercana", () => {
    const citas = [
      { ...base, scheduledAt: new Date("2026-08-18T15:00:00.000Z") },
      {
        ...base,
        scheduledAt: new Date("2026-08-18T12:00:00.000Z"),
        status: "COMPLETED",
      },
      { ...base, scheduledAt: new Date("2026-08-18T11:00:00.000Z") },
    ];
    expect(
      nextUpcomingCita(
        citas,
        new Date("2026-08-18T10:00:00.000Z"),
      ).scheduledAt.toISOString(),
    ).toBe("2026-08-18T11:00:00.000Z");
  });

  it("nextUpcomingCita null si todo es terminal", () => {
    expect(
      nextUpcomingCita(
        [{ ...base, status: "CANCELLED" }],
        new Date("2026-08-18T10:00:00.000Z"),
      ),
    ).toBeNull();
  });
});
