import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("wasp/server", () => ({
  HttpError: class HttpError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

vi.mock("../../src/clinical/services/audit", () => ({
  createAuditEntry: vi.fn().mockResolvedValue({ id: "audit-1" }),
}));

import { getActiveDoctorsForPatient } from "../../src/patient/queries";
import { requestPatientAppointment } from "../../src/patient/actions";

const pacienteUser = {
  id: "user-paciente-1",
  isPaciente: true,
  isAdmin: false,
  isMedico: false,
  isSecretaria: false,
  isActive: true,
};

const nonPacienteUser = {
  id: "user-other-1",
  isPaciente: false,
  isAdmin: false,
  isMedico: true,
  isActive: true,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("getActiveDoctorsForPatient query", () => {
  it("permite a un paciente consultar la lista de médicos activos", async () => {
    const mockFindMany = vi.fn().mockResolvedValue([
      { id: "doc-1", fullName: "Dr. Gregory House", specialty: "Diagnóstico", email: "house@clinic.test" },
      { id: "doc-2", fullName: "Dra. Allison Cameron", specialty: "Inmunología", email: "cameron@clinic.test" },
    ]);

    const context = {
      user: pacienteUser,
      entities: {
        User: { findMany: mockFindMany },
      },
    };

    const result = await getActiveDoctorsForPatient({}, context);
    expect(result).toHaveLength(2);
    expect(result[0].fullName).toBe("Dr. Gregory House");
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { isMedico: true, isAdmin: false, isActive: true },
      select: { id: true, fullName: true, specialty: true, email: true },
      orderBy: { fullName: "asc" },
    });
  });

  it("rechaza si no hay usuario autenticado", async () => {
    const context = {
      user: null,
      entities: { User: { findMany: vi.fn() } },
    };

    await expect(getActiveDoctorsForPatient({}, context)).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});

describe("requestPatientAppointment action", () => {
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Mañana
  const medicoId = "e5b8d000-0000-0000-0000-000000000001";

  it("crea exitosamente una cita con estado SCHEDULED para el paciente", async () => {
    const mockPatient = {
      id: "patient-rec-1",
      userId: pacienteUser.id,
      syntheticId: "PAC-001",
    };

    const mockMedico = {
      id: medicoId,
      fullName: "Dr. House",
      isMedico: true,
      isActive: true,
      isAdmin: false,
    };

    const mockCreatedCita = {
      id: "cita-123",
      medicoId,
      patientId: mockPatient.id,
      scheduledAt: futureDate,
      durationMinutes: 30,
      status: "SCHEDULED",
      reason: "Chequeo preventivo",
      medico: {
        id: medicoId,
        fullName: "Dr. House",
        specialty: "Medicina Interna",
        email: "house@clinic.test",
      },
    };

    const context = {
      user: pacienteUser,
      entities: {
        SyntheticPatient: {
          findFirst: vi.fn().mockResolvedValue(mockPatient),
        },
        User: {
          findFirst: vi.fn().mockResolvedValue(mockMedico),
        },
        Cita: {
          findMany: vi.fn().mockResolvedValue([]), // sin solapamiento
          create: vi.fn().mockResolvedValue(mockCreatedCita),
        },
      },
    };

    const res = await requestPatientAppointment(
      {
        medicoId,
        scheduledAt: futureDate.toISOString(),
        durationMinutes: 30,
        reason: "Chequeo preventivo",
      },
      context
    );

    expect(res.success).toBe(true);
    expect(res.cita.status).toBe("SCHEDULED");
    expect(res.cita.id).toBe("cita-123");
    expect(context.entities.Cita.create).toHaveBeenCalled();
  });

  it("rechaza si el usuario no tiene rol de paciente", async () => {
    const context = {
      user: nonPacienteUser,
      entities: {},
    };

    await expect(
      requestPatientAppointment(
        {
          medicoId,
          scheduledAt: futureDate.toISOString(),
        },
        context
      )
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("rechaza si la fecha es en el pasado", async () => {
    const pastDate = new Date(Date.now() - 3600000); // 1 hora atrás

    const context = {
      user: pacienteUser,
      entities: {
        SyntheticPatient: {
          findFirst: vi.fn().mockResolvedValue({ id: "p1", userId: pacienteUser.id }),
        },
      },
    };

    await expect(
      requestPatientAppointment(
        {
          medicoId,
          scheduledAt: pastDate.toISOString(),
        },
        context
      )
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("rechaza si el médico no existe o está inactivo", async () => {
    const context = {
      user: pacienteUser,
      entities: {
        SyntheticPatient: {
          findFirst: vi.fn().mockResolvedValue({ id: "p1", userId: pacienteUser.id }),
        },
        User: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    };

    await expect(
      requestPatientAppointment(
        {
          medicoId,
          scheduledAt: futureDate.toISOString(),
        },
        context
      )
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("rechaza con 409 si el horario del médico ya está ocupado", async () => {
    const mockPatient = {
      id: "patient-rec-1",
      userId: pacienteUser.id,
      syntheticId: "PAC-001",
    };

    const mockMedico = {
      id: medicoId,
      fullName: "Dr. House",
      isMedico: true,
      isActive: true,
      isAdmin: false,
    };

    const context = {
      user: pacienteUser,
      entities: {
        SyntheticPatient: {
          findFirst: vi.fn().mockResolvedValue(mockPatient),
        },
        User: {
          findFirst: vi.fn().mockResolvedValue(mockMedico),
        },
        Cita: {
          // Devuelve cita existente en el mismo horario
          findMany: vi.fn().mockResolvedValue([
            {
              id: "existing-cita",
              scheduledAt: futureDate,
              durationMinutes: 30,
              status: "SCHEDULED",
            },
          ]),
        },
      },
    };

    await expect(
      requestPatientAppointment(
        {
          medicoId,
          scheduledAt: futureDate.toISOString(),
          durationMinutes: 30,
        },
        context
      )
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});
