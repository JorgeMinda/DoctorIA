import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("wasp/server", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    prisma: {
      medicoPatientAccess: { findUnique: vi.fn() },
    },
  };
});

vi.mock("../../src/clinical/services/audit", () => ({
  createAuditEntry: vi.fn().mockResolvedValue({ id: "audit-1" }),
}));

import { prisma } from "wasp/server";
import { createAuditEntry } from "../../src/clinical/services/audit";
import { manageCitaByMedico } from "../../src/clinical/actions";

const medico = {
  id: "med-1",
  isMedico: true,
  isAdmin: false,
  isPaciente: false,
  isSecretaria: false,
  isActive: true,
};

type CitaEntityMocks = {
  findUnique: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

function makeCitaEntity(): CitaEntityMocks {
  return {
    findUnique: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: "cita-new", status: "SCHEDULED" }),
    update: vi.fn().mockResolvedValue({ id: "cita-1" }),
  };
}

function ctx(user: unknown, Cita: CitaEntityMocks) {
  return { user, entities: { Cita } } as any;
}

const createArgs = {
  action: "CREATE" as const,
  patientId: "pat-1",
  scheduledAt: "2026-08-20T15:00:00.000Z",
  durationMinutes: 30,
  reason: "Dolor de cabeza",
};

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.medicoPatientAccess.findUnique as any).mockResolvedValue({
    id: "acc-1",
  });
});

describe("manageCitaByMedico — CREATE", () => {
  it("crea una cita SCHEDULED con audit para el médico con acceso", async () => {
    const Cita = makeCitaEntity();
    const result = await manageCitaByMedico(createArgs, ctx(medico, Cita));

    expect(result.status).toBe("SCHEDULED");
    expect(Cita.findMany).toHaveBeenCalled();
    expect(Cita.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        patientId: "pat-1",
        medicoId: "med-1",
        status: "SCHEDULED",
        durationMinutes: 30,
        reason: "Dolor de cabeza",
      }),
    });
    expect(createAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "MANAGE_CITA",
        resourceId: "cita-new",
        citaId: "cita-new",
        metadata: expect.objectContaining({ operation: "CREATE" }),
      }),
    );
  });

  it("rechaza con 409 si hay solapamiento con otra cita del médico", async () => {
    const Cita = makeCitaEntity();
    Cita.findMany.mockResolvedValue([
      {
        id: "otra-cita",
        scheduledAt: new Date("2026-08-20T15:10:00.000Z"),
        durationMinutes: 30,
      },
    ]);

    await expect(
      manageCitaByMedico(createArgs, ctx(medico, Cita)),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(Cita.create).not.toHaveBeenCalled();
    expect(createAuditEntry).not.toHaveBeenCalled();
  });

  it("rechaza con 403 si el médico no tiene acceso al paciente (R-10)", async () => {
    (prisma.medicoPatientAccess.findUnique as any).mockResolvedValueOnce(null);
    const Cita = makeCitaEntity();

    await expect(
      manageCitaByMedico(createArgs, ctx(medico, Cita)),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(Cita.create).not.toHaveBeenCalled();
  });

  it("rechaza con 403 a usuarios que no son médicos", async () => {
    const Cita = makeCitaEntity();
    const noMedico = { ...medico, isMedico: false };

    await expect(
      manageCitaByMedico(createArgs, ctx(noMedico, Cita)),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rechaza con 403 a cuentas inactivas", async () => {
    const Cita = makeCitaEntity();
    const inactive = { ...medico, isActive: false };

    await expect(
      manageCitaByMedico(createArgs, ctx(inactive, Cita)),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("valida el esquema: durationMinutes fuera de rango → 400", async () => {
    const Cita = makeCitaEntity();

    await expect(
      manageCitaByMedico(
        { ...createArgs, durationMinutes: 10 },
        ctx(medico, Cita),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(Cita.create).not.toHaveBeenCalled();
  });
});

describe("manageCitaByMedico — UPDATE", () => {
  it("sin citaId → 400", async () => {
    const Cita = makeCitaEntity();
    await expect(
      manageCitaByMedico(
        {
          action: "UPDATE",
          patientId: "pat-1",
          scheduledAt: createArgs.scheduledAt,
        },
        ctx(medico, Cita),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("cita inexistente → 404", async () => {
    const Cita = makeCitaEntity();
    Cita.findUnique.mockResolvedValue(null);

    await expect(
      manageCitaByMedico(
        { ...createArgs, action: "UPDATE", citaId: "nope" },
        ctx(medico, Cita),
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("cita de otro profesional → 403", async () => {
    const Cita = makeCitaEntity();
    Cita.findUnique.mockResolvedValue({
      id: "cita-1",
      medicoId: "otro-medico",
      status: "SCHEDULED",
      patientId: "pat-1",
      scheduledAt: new Date(createArgs.scheduledAt),
    });

    await expect(
      manageCitaByMedico(
        { ...createArgs, action: "UPDATE", citaId: "cita-1" },
        ctx(medico, Cita),
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(Cita.update).not.toHaveBeenCalled();
  });

  it("cita COMPLETED no se puede editar → 400", async () => {
    const Cita = makeCitaEntity();
    Cita.findUnique.mockResolvedValue({
      id: "cita-1",
      medicoId: "med-1",
      status: "COMPLETED",
      patientId: "pat-1",
      scheduledAt: new Date(createArgs.scheduledAt),
    });

    await expect(
      manageCitaByMedico(
        { ...createArgs, action: "UPDATE", citaId: "cita-1" },
        ctx(medico, Cita),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(Cita.update).not.toHaveBeenCalled();
  });

  it("reagenda la propia cita excluyendo su propio id del solapamiento", async () => {
    const Cita = makeCitaEntity();
    Cita.findUnique.mockResolvedValue({
      id: "cita-1",
      medicoId: "med-1",
      status: "SCHEDULED",
      patientId: "pat-1",
      scheduledAt: new Date("2026-08-20T15:00:00.000Z"),
    });
    // La ventana query incluye la propia cita (15:00-15:30) que solapa con el
    // nuevo horario 15:15-15:45: debe excluirse por id y no lanzar 409.
    Cita.findMany.mockResolvedValue([
      {
        id: "cita-1",
        scheduledAt: new Date("2026-08-20T15:00:00.000Z"),
        durationMinutes: 30,
      },
    ]);
    Cita.update.mockResolvedValue({ id: "cita-1", status: "SCHEDULED" });

    const updated = await manageCitaByMedico(
      {
        ...createArgs,
        action: "UPDATE",
        citaId: "cita-1",
        scheduledAt: "2026-08-20T15:15:00.000Z",
      },
      ctx(medico, Cita),
    );

    expect(updated.id).toBe("cita-1");
    expect(Cita.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ medicoId: "med-1" }),
      }),
    );
    expect(Cita.update).toHaveBeenCalledWith({
      where: { id: "cita-1" },
      data: expect.objectContaining({
        scheduledAt: new Date("2026-08-20T15:15:00.000Z"),
        durationMinutes: 30,
      }),
    });
    expect(createAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "MANAGE_CITA",
        metadata: expect.objectContaining({ operation: "UPDATE" }),
      }),
    );
  });
});

describe("manageCitaByMedico — CANCEL", () => {
  const cancelArgs = {
    action: "CANCEL" as const,
    patientId: "pat-1",
    scheduledAt: createArgs.scheduledAt,
    citaId: "cita-1",
  };

  it("cancela la propia cita y audita el estado previo", async () => {
    const Cita = makeCitaEntity();
    Cita.findUnique.mockResolvedValue({
      id: "cita-1",
      medicoId: "med-1",
      status: "IN_PROGRESS",
      patientId: "pat-1",
      scheduledAt: new Date(createArgs.scheduledAt),
    });
    Cita.update.mockResolvedValue({ id: "cita-1", status: "CANCELLED" });

    const result = await manageCitaByMedico(cancelArgs, ctx(medico, Cita));

    expect(result.status).toBe("CANCELLED");
    expect(Cita.update).toHaveBeenCalledWith({
      where: { id: "cita-1" },
      data: { status: "CANCELLED" },
    });
    expect(createAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CANCEL_APPOINTMENT",
        metadata: expect.objectContaining({ previousStatus: "IN_PROGRESS" }),
      }),
    );
  });

  it("cancelar cita de otro profesional → 403", async () => {
    const Cita = makeCitaEntity();
    Cita.findUnique.mockResolvedValue({
      id: "cita-1",
      medicoId: "otro-medico",
      status: "SCHEDULED",
      patientId: "pat-1",
      scheduledAt: new Date(createArgs.scheduledAt),
    });

    await expect(
      manageCitaByMedico(cancelArgs, ctx(medico, Cita)),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(Cita.update).not.toHaveBeenCalled();
  });

  it("sin citaId → 400", async () => {
    const Cita = makeCitaEntity();
    await expect(
      manageCitaByMedico(
        { ...cancelArgs, citaId: undefined },
        ctx(medico, Cita),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
