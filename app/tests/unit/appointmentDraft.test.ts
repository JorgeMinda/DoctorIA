import { describe, expect, it } from "vitest";
import {
  buildDraftPath,
  describeDraft,
  matchByName,
  normalizeName,
  parseAppointmentDraft,
} from "../../src/client/voice/appointmentDraft";

// Fecha fija para tests de día de semana: martes 10-nov-2026 (getDay()=2)
const NOW = new Date(2026, 10, 10, 9, 0, 0);

describe("parseAppointmentDraft", () => {
  it("devuelve null sin intención de agendar", () => {
    expect(parseAppointmentDraft("busca paciente Ana Paredes", NOW)).toBeNull();
    expect(parseAppointmentDraft("dame el resumen de Ana Paredes", NOW)).toBeNull();
    expect(parseAppointmentDraft("abre administración", NOW)).toBeNull();
  });

  it("'agendar cita' sin datos extraíbles → null (cae en ?new=1 genérico)", () => {
    expect(parseAppointmentDraft("agendar cita", NOW)).toBeNull();
    expect(parseAppointmentDraft("nuevo turno", NOW)).toBeNull();
  });

  it("extrae paciente + fecha relativa + hora", () => {
    const d = parseAppointmentDraft(
      "agendar cita para Ana Paredes mañana a las 10:30",
      NOW,
    );
    expect(d).toMatchObject({
      patientName: "Ana Paredes",
      dateISO: "2026-11-11",
      time: "10:30",
    });
    expect(d?.raw).toContain("Ana Paredes");
  });

  it("extrae médico con título + hoy + hora sin minutos", () => {
    const d = parseAppointmentDraft(
      "nueva cita con el doctor Pérez hoy a las 8",
      NOW,
    );
    expect(d).toMatchObject({
      medicoName: "Pérez",
      dateISO: "2026-11-10",
      time: "08:00",
    });
  });

  it("día de la semana → próxima ocurrencia (lunes desde martes)", () => {
    const d = parseAppointmentDraft(
      "agendar cita para Juan Pérez el lunes a las 9",
      NOW,
    );
    expect(d).toMatchObject({
      patientName: "Juan Pérez",
      dateISO: "2026-11-16",
      time: "09:00",
    });
  });

  it("fecha explícita '25 de noviembre'", () => {
    const d = parseAppointmentDraft("crear cita para María el 25 de noviembre", NOW);
    expect(d).toMatchObject({ patientName: "María", dateISO: "2026-11-25" });
  });

  it("'pasado mañana' va después de 'mañana'", () => {
    const d = parseAppointmentDraft("agendar cita para Ana pasado mañana", NOW);
    expect(d?.dateISO).toBe("2026-11-12");
  });

  it("meridiano hablado: 'a las 2 de la tarde' → 14:00", () => {
    const d = parseAppointmentDraft("agendar cita para Ana a las 2 de la tarde", NOW);
    expect(d?.time).toBe("14:00");
  });

  it("fracción hablada: 'a las 10 y media' → 10:30", () => {
    const d = parseAppointmentDraft("agendar cita para Ana a las 10 y media", NOW);
    expect(d?.time).toBe("10:30");
  });

  it("acepta mayúsculas y sin tildes en el disparador", () => {
    const d = parseAppointmentDraft("AGENDAR CITA para Ana Paredes MAÑANA", NOW);
    expect(d).toMatchObject({ patientName: "Ana Paredes", dateISO: "2026-11-11" });
  });

  it("captura identificador del paciente (PAC-001)", () => {
    const d = parseAppointmentDraft("agenda cita para paciente PAC-001 mañana", NOW);
    expect(d?.patientName).toBe("PAC-001");
  });

  it("no confunde 'para el doctor X' con paciente", () => {
    const d = parseAppointmentDraft("nueva cita para el doctor Pérez mañana", NOW);
    expect(d?.medicoName).toBe("Pérez");
    expect(d?.patientName).toBeUndefined();
  });
});

describe("describeDraft / buildDraftPath", () => {
  const draft = {
    raw: "agendar cita para Ana Paredes mañana a las 10:30",
    patientName: "Ana Paredes",
    dateISO: "2026-11-11",
    time: "10:30",
  };

  it("describeDraft resume los campos extraídos", () => {
    expect(describeDraft(draft)).toBe(
      "Pre-reserva: Ana Paredes · 2026-11-11 · 10:30",
    );
  });

  it("buildDraftPath lleva a la agenda con el draft codificado", () => {
    const path = buildDraftPath(draft);
    expect(path.startsWith("/clinical/agenda?new=1&draft=")).toBe(true);
    const encoded = path.split("draft=")[1];
    expect(JSON.parse(decodeURIComponent(encoded))).toEqual(draft);
  });
});

describe("matchByName", () => {
  const patients = [
    { id: "1", firstName: "Ana", lastName: "Paredes", syntheticId: "PAC-001" },
    { id: "2", firstName: "Luis", lastName: "Torres", syntheticId: "PAC-002" },
    { id: "3", firstName: "Ana", lastName: "Paredes", syntheticId: "PAC-003" },
  ];

  it("normaliza tildes y mayúsculas", () => {
    expect(normalizeName("  Ana   PÁREDES ")).toBe("ana paredes");
  });

  it("resuelve cuando el nombre es único", () => {
    const unique = patients.slice(0, 2);
    expect(matchByName(unique, "ana paredes")?.id).toBe("1");
    expect(matchByName(unique, "ANA PAREDES")?.id).toBe("1");
    expect(matchByName(unique, "Luis Torres")?.id).toBe("2");
  });

  it("ambigüedad (dos homónimos) → null: nunca adivinar paciente", () => {
    expect(matchByName(patients, "Ana Paredes")).toBeNull();
  });

  it("acepta syntheticId como nombre", () => {
    const unique = patients.slice(0, 2);
    expect(matchByName(unique, "PAC-002")?.id).toBe("2");
  });

  it("sin coincidencia o nombre vacío → null", () => {
    expect(matchByName(patients, "María López")).toBeNull();
    expect(matchByName(patients, "")).toBeNull();
  });

  it("matchea por fullName de médico", () => {
    const medicos = [{ id: "m1", fullName: "Carlos Mena" }];
    expect(matchByName(medicos, "carlos mena")?.id).toBe("m1");
  });
});
