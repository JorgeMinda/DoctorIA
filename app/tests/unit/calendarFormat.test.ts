import { describe, expect, it } from "vitest";
import {
  getCalendarHeaderTitle,
  getCitaStatusColor,
} from "../../src/clinical/services/calendarFormat";

describe("getCalendarHeaderTitle", () => {
  it("vista día: fecha larga en español", () => {
    const title = getCalendarHeaderTitle("day", new Date(2026, 10, 8));
    expect(title).toContain("8 de Noviembre de 2026");
    expect(title).toMatch(/^[a-záéíóú]+,/);
  });

  it("vista semana: lunes a domingo de la semana (día intermedio)", () => {
    // Miércoles 4-nov-2026 → semana 2-nov..8-nov
    expect(getCalendarHeaderTitle("week", new Date(2026, 10, 4))).toBe(
      "2 Nov - 8 Noviembre 2026",
    );
  });

  it("vista semana: domingo cae en el inicio de semana (getDay() || 7)", () => {
    // Domingo 8-nov-2026 → misma semana que arranca 2-nov
    expect(getCalendarHeaderTitle("week", new Date(2026, 10, 8))).toBe(
      "2 Nov - 8 Noviembre 2026",
    );
  });

  it("vista semana: rango que cruza de mes", () => {
    // Miércoles 2-dic-2026 → semana 30-nov..6-dic
    expect(getCalendarHeaderTitle("week", new Date(2026, 11, 2))).toBe(
      "30 Nov - 6 Diciembre 2026",
    );
  });

  it("vista mes: nombre completo + año", () => {
    expect(getCalendarHeaderTitle("month", new Date(2026, 10, 8))).toBe(
      "Noviembre 2026",
    );
  });

  it("vista año", () => {
    expect(getCalendarHeaderTitle("year", new Date(2026, 0, 15))).toBe(
      "Año 2026",
    );
  });

  it("lista: título por defecto", () => {
    expect(getCalendarHeaderTitle("list", new Date(2026, 10, 8))).toBe(
      "Todas las Citas",
    );
  });
});

describe("getCitaStatusColor", () => {
  it("colores distintos por estado (sin colisiones entre variantes)", () => {
    const colors = ["COMPLETED", "IN_PROGRESS", "CANCELLED", "SCHEDULED"].map(
      getCitaStatusColor,
    );
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("estados conocidos y default con las clases esperadas", () => {
    expect(getCitaStatusColor("COMPLETED")).toContain("emerald");
    expect(getCitaStatusColor("IN_PROGRESS")).toContain("animate-pulse");
    expect(getCitaStatusColor("CANCELLED")).toContain("opacity-60");
    expect(getCitaStatusColor("SCHEDULED")).toContain("amber");
    expect(getCitaStatusColor("ESTADO_DESCONOCIDO")).toContain("amber");
  });

  it("NO_SHOW y NOT_STARTED usan el color default (ámbar)", () => {
    expect(getCitaStatusColor("NO_SHOW")).toBe(getCitaStatusColor("SCHEDULED"));
    expect(getCitaStatusColor("NOT_STARTED")).toBe(
      getCitaStatusColor("SCHEDULED"),
    );
  });

  it("CANCELLED usa la variante destructive del design system", () => {
    expect(getCitaStatusColor("CANCELLED")).toContain("bg-destructive/20");
  });
});
