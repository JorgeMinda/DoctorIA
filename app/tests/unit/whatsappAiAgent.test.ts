// Tests unitarios del Agente de WhatsApp IA (DoctorIA)

import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  normalizePhoneNumber,
  sendWhatsAppMessage,
} from "../../src/whatsapp/services/whatsappGateway";
import {
  classifyIntentWithAI,
  processIncomingWhatsAppMessage,
  findOrCreatePatientByPhone,
} from "../../src/whatsapp/services/whatsappAiAgent";

describe("WhatsApp Gateway - normalizePhoneNumber", () => {
  it("limpia caracteres no numéricos", () => {
    expect(normalizePhoneNumber("+593 99 123 4567")).toBe("593991234567");
    expect(normalizePhoneNumber("+593-99-123-4567")).toBe("593991234567");
    expect(normalizePhoneNumber("(593) 991234567")).toBe("593991234567");
  });

  it("convierte números locales que inician con 0 a formato país (593)", () => {
    expect(normalizePhoneNumber("0991234567")).toBe("593991234567");
  });

  it("retorna string vacío si el número no es válido", () => {
    expect(normalizePhoneNumber("")).toBe("");
  });
});

describe("WhatsApp AI Agent - classifyIntentWithAI", () => {
  it("clasifica saludos amigables", async () => {
    const res = await classifyIntentWithAI("Hola buenas tardes");
    expect(res.intent).toBe("GREETING");
  });

  it("clasifica confirmaciones directas de cita (número 1 o palabra confirmo)", async () => {
    const res1 = await classifyIntentWithAI("1");
    expect(res1.intent).toBe("CONFIRM");

    const res2 = await classifyIntentWithAI("Sí, confirmo mi asistencia a la cita");
    expect(res2.intent).toBe("CONFIRM");
  });

  it("clasifica cancelaciones directas (número 2 o palabra cancelo)", async () => {
    const res1 = await classifyIntentWithAI("2");
    expect(res1.intent).toBe("CANCEL");

    const res2 = await classifyIntentWithAI("Deseo cancelar mi cita por favor no podré ir");
    expect(res2.intent).toBe("CANCEL");
  });

  it("clasifica consulta de disponibilidad de turnos", async () => {
    const res = await classifyIntentWithAI("Qué turnos u horarios tienen disponibles?");
    expect(res.intent).toBe("AVAILABILITY");
  });

  it("clasifica solicitud de agendamiento", async () => {
    const res = await classifyIntentWithAI("Quiero agendar una cita médica");
    expect(res.intent).toBe("BOOK");
  });

  it("clasifica consultas informativas sobre el consultorio", async () => {
    const res = await classifyIntentWithAI("Cuál es la dirección del centro?");
    expect(res.intent).toBe("INFO");
  });
});

describe("WhatsApp AI Agent - processIncomingWhatsAppMessage", () => {
  let mockEntities: any;

  beforeEach(() => {
    mockEntities = {
      SyntheticPatient: {
        findFirst: vi.fn(),
        count: vi.fn().mockResolvedValue(10),
        create: vi.fn().mockImplementation((args) =>
          Promise.resolve({
            id: "pat-123",
            firstName: args.data.firstName,
            lastName: args.data.lastName,
            phone: args.data.phone,
          }),
        ),
      },
      User: {
        findFirst: vi.fn().mockResolvedValue({
          id: "doc-123",
          fullName: "Dr. Gregory House",
          isMedico: true,
          isActive: true,
        }),
      },
      Cita: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation((args) =>
          Promise.resolve({
            id: "cita-999",
            medicoId: args.data.medicoId,
            patientId: args.data.patientId,
            scheduledAt: args.data.scheduledAt,
            status: args.data.status,
          }),
        ),
        update: vi.fn().mockImplementation((args) =>
          Promise.resolve({
            id: args.where.id,
            status: args.data.status,
          }),
        ),
      },
      AuditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-1" }),
      },
    };
  });

  it("responde al saludo inicial", async () => {
    const res = await processIncomingWhatsAppMessage(mockEntities, {
      from: "593991234567",
      text: "Hola buenas tardes",
      name: "Carlos Mendoza",
    });

    expect(res.handled).toBe(true);
    expect(res.intent).toBe("GREETING");
    expect(res.replyText).toContain("Asistente Virtual de DoctorIA");
  });

  it("confirma la cita agendada de un paciente", async () => {
    mockEntities.SyntheticPatient.findFirst.mockResolvedValue({
      id: "pat-123",
      firstName: "Carlos",
      lastName: "Mendoza",
      phone: "+593991234567",
    });

    mockEntities.Cita.findFirst.mockResolvedValue({
      id: "cita-100",
      patientId: "pat-123",
      medicoId: "doc-123",
      status: "SCHEDULED",
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      medico: { fullName: "Dr. Gregory House" },
    });

    const res = await processIncomingWhatsAppMessage(mockEntities, {
      from: "593991234567",
      text: "1",
    });

    expect(res.handled).toBe(true);
    expect(res.intent).toBe("CONFIRM");
    expect(mockEntities.Cita.update).toHaveBeenCalledWith({
      where: { id: "cita-100" },
      data: { status: "CONFIRMED" },
    });
    expect(res.replyText).toContain("Cita Confirmada");
  });

  it("cancela la cita y libera el slot cuando el paciente responde '2'", async () => {
    mockEntities.SyntheticPatient.findFirst.mockResolvedValue({
      id: "pat-123",
      firstName: "Carlos",
      lastName: "Mendoza",
      phone: "+593991234567",
    });

    mockEntities.Cita.findFirst.mockResolvedValue({
      id: "cita-100",
      patientId: "pat-123",
      medicoId: "doc-123",
      status: "SCHEDULED",
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      medico: { fullName: "Dr. Gregory House" },
    });

    const res = await processIncomingWhatsAppMessage(mockEntities, {
      from: "593991234567",
      text: "2",
    });

    expect(res.handled).toBe(true);
    expect(res.intent).toBe("CANCEL");
    expect(mockEntities.Cita.update).toHaveBeenCalledWith({
      where: { id: "cita-100" },
      data: { status: "CANCELLED" },
    });
    expect(res.replyText).toContain("ha sido cancelada");
  });
});
