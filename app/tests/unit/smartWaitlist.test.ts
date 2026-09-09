// Tests unitarios para el servicio de Lista de Espera Inteligente (DoctorIA)

import { describe, expect, it, vi } from "vitest";
import {
  registerPatientInWaitlist,
  getActiveWaitlistEntries,
  notifyWaitlistOnSlotFreed,
} from "../../src/whatsapp/services/smartWaitlistService";

describe("Smart Waitlist Service", () => {
  it("permite registrar un paciente en la lista de espera", () => {
    const entry = registerPatientInWaitlist({
      patientId: "pat-99",
      patientName: "María Andrade",
      phone: "+593998765432",
      medicoId: "doc-123",
      preferredDateISO: "2026-09-10",
    });

    expect(entry.id).toBeDefined();
    expect(entry.status).toBe("WAITING");
    expect(entry.patientName).toBe("María Andrade");

    const active = getActiveWaitlistEntries();
    expect(active.some((e) => e.patientId === "pat-99")).toBe(true);
  });

  it("notifica al paciente de lista de espera cuando un turno se libera por cancelación", async () => {
    registerPatientInWaitlist({
      patientId: "pat-200",
      patientName: "Juan Delgado",
      phone: "+593991122334",
      medicoId: "doc-777",
      preferredDateISO: "2026-09-12",
    });

    const mockEntities = {
      Cita: {
        findFirst: vi.fn(),
      },
      AuditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-wl-1" }),
      },
    };

    const result = await notifyWaitlistOnSlotFreed({
      entities: mockEntities,
      medicoId: "doc-777",
      freedScheduledAt: new Date("2026-09-12T15:00:00.000Z"),
      doctorName: "Dr. Gregory House",
    });

    expect(result.notifiedCount).toBe(1);
    expect(result.candidate?.patientName).toBe("Juan Delgado");
    expect(result.candidate?.status).toBe("OFFERED");
  });
});
