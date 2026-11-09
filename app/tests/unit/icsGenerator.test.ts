import { describe, expect, it } from "vitest";
import { generateIcsFile } from "../../src/shared/utils/icsGenerator";

const start = new Date("2026-08-18T10:00:00.000Z");
const end = new Date("2026-08-18T10:30:00.000Z");

describe("generateIcsFile (exportación de portal)", () => {
  it("genera una estructura iCalendar válida (RFC 5545 básica)", () => {
    const ics = generateIcsFile({
      summary: "Consulta: Juan Pérez",
      startTime: start,
      endTime: end,
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//DoctorIA//Cita Clinica//ES");
    expect(ics).toContain("CALSCALE:GREGORIAN");
    expect(ics).toContain("METHOD:PUBLISH");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).toContain("UID:");
    expect(ics).toContain("@doctoria.app");
    expect(ics).toContain("DTSTAMP:");
  });

  it("formatea DTSTART/DTEND en UTC compacto (YYYYMMDDTHHMMSSZ)", () => {
    const ics = generateIcsFile({
      summary: "x",
      startTime: start,
      endTime: end,
    });
    expect(ics).toContain("DTSTART:20260818T100000Z");
    expect(ics).toContain("DTEND:20260818T103000Z");
  });

  it("usa CRLF como separador de líneas (RFC 5545)", () => {
    const ics = generateIcsFile({
      summary: "x",
      startTime: start,
      endTime: end,
    });
    const lines = ics.split("\r\n");
    expect(lines.length).toBeGreaterThan(10);
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it("elimina los saltos de línea del SUMMARY", () => {
    const ics = generateIcsFile({
      summary: "Hola\nMundo\r\nAdiós",
      startTime: start,
      endTime: end,
    });
    expect(ics).toContain("SUMMARY:Hola Mundo Adiós");
  });

  it("convierte los saltos de línea del DESCRIPTION en \\n de ICS", () => {
    const ics = generateIcsFile({
      summary: "x",
      description: "Motivo: dolor\nNota: control",
      startTime: start,
      endTime: end,
    });
    expect(ics).toContain("DESCRIPTION:Motivo: dolor\\nNota: control");
  });

  it("LOCATION por defecto y LOCATION personalizado", () => {
    const def = generateIcsFile({
      summary: "x",
      startTime: start,
      endTime: end,
    });
    expect(def).toContain("LOCATION:Consulta Médica DoctorIA");

    const custom = generateIcsFile({
      summary: "x",
      location: "Consultorio 3",
      startTime: start,
      endTime: end,
    });
    expect(custom).toContain("LOCATION:Consultorio 3");
  });

  it("incluye ORGANIZER solo si se provee", () => {
    const withOrg = generateIcsFile({
      summary: "x",
      organizer: "Dra. House",
      startTime: start,
      endTime: end,
    });
    expect(withOrg).toContain(
      "ORGANIZER;CN=Dra. House:mailto:noreply@doctoria.app",
    );

    const without = generateIcsFile({
      summary: "x",
      startTime: start,
      endTime: end,
    });
    expect(without).not.toContain("ORGANIZER");
  });

  it("genera un UID único por archivo", () => {
    const a = generateIcsFile({ summary: "x", startTime: start, endTime: end });
    const b = generateIcsFile({ summary: "x", startTime: start, endTime: end });
    const uidA = a.split("\r\n").find((l) => l.startsWith("UID:"));
    const uidB = b.split("\r\n").find((l) => l.startsWith("UID:"));
    expect(uidA).toBeTruthy();
    expect(uidA).not.toBe(uidB);
  });
});
