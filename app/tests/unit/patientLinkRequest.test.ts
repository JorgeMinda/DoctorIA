import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("wasp/server", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    prisma: {},
  };
});

vi.mock("../../src/clinical/services/audit", () => ({
  createAuditEntry: vi.fn().mockResolvedValue({ id: "audit-1" }),
}));

import { createAuditEntry } from "../../src/clinical/services/audit";
import { requestPatientLink } from "../../src/clinical/actions";

const paciente = {
  id: "user-1",
  isPaciente: true,
  isAdmin: false,
  isMedico: false,
  isSecretaria: false,
  isActive: true,
};

type Entities = {
  SyntheticPatient: { findFirst: ReturnType<typeof vi.fn> };
  PatientLinkRequest: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

function makeEntities(): Entities {
  return {
    SyntheticPatient: { findFirst: vi.fn().mockResolvedValue(null) },
    PatientLinkRequest: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "req-1" }),
    },
  };
}

function ctx(user: unknown, entities: Entities) {
  return { user, entities } as any;
}

const validArgs = { tipoDocumento: "CEDULA", documento: "1710034065" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requestPatientLink (vinculación de cuenta paciente)", () => {
  it("sin sesión → 401", async () => {
    await expect(
      requestPatientLink(validArgs, ctx(null, makeEntities())),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("cuenta inactiva → 403", async () => {
    await expect(
      requestPatientLink(
        validArgs,
        ctx({ ...paciente, isActive: false }, makeEntities()),
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("documento con formato inválido → 400 y no crea solicitud", async () => {
    const entities = makeEntities();
    await expect(
      requestPatientLink(
        { tipoDocumento: "CEDULA", documento: "123" },
        ctx(paciente, entities),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(entities.PatientLinkRequest.create).not.toHaveBeenCalled();
  });

  it("crea solicitud PENDING con vigencia de 7 días y audita si el paciente existe", async () => {
    const entities = makeEntities();
    entities.SyntheticPatient.findFirst
      .mockResolvedValueOnce({ id: "pat-1" }) // búsqueda por documento
      .mockResolvedValueOnce(null); // ya vinculado

    const res = await requestPatientLink(validArgs, ctx(paciente, entities));

    expect(res).toMatchObject({ success: true, status: "PENDING" });
    expect(entities.PatientLinkRequest.create).toHaveBeenCalledTimes(1);
    const data = entities.PatientLinkRequest.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      userId: "user-1",
      patientId: "pat-1",
      status: "PENDING",
      requestedDocument: "1710034065",
      documentType: "CEDULA",
    });
    const daysLeft =
      (data.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysLeft).toBeGreaterThan(6.9);
    expect(daysLeft).toBeLessThan(7.1);
    expect(createAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ADMIN_MANAGE_DATA",
        metadata: expect.objectContaining({
          action: "PATIENT_LINK_REQUESTED",
        }),
      }),
    );
  });

  it("anti-enumeración: respuesta idéntica con y sin paciente coincidente", async () => {
    const found = makeEntities();
    found.SyntheticPatient.findFirst
      .mockResolvedValueOnce({ id: "pat-1" })
      .mockResolvedValueOnce(null);
    const resFound = await requestPatientLink(
      validArgs,
      ctx(paciente, found),
    );

    const notFound = makeEntities();
    notFound.SyntheticPatient.findFirst
      .mockResolvedValueOnce(null) // sin coincidencia
      .mockResolvedValueOnce(null);
    const resNotFound = await requestPatientLink(
      validArgs,
      ctx(paciente, notFound),
    );

    expect(resNotFound).toEqual(resFound);
    expect(resNotFound.message).toBe(resFound.message);
    // Sin paciente no hay auditoría (evita filtrar la búsqueda)
    expect(createAuditEntry).toHaveBeenCalledTimes(1);
    expect(notFound.PatientLinkRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ patientId: null }),
    });
  });

  it("cuenta ya vinculada a otro paciente → 409", async () => {
    const entities = makeEntities();
    entities.SyntheticPatient.findFirst
      .mockResolvedValueOnce(null) // sin coincidencia por documento
      .mockResolvedValueOnce({ id: "pat-x" }); // ya vinculada

    await expect(
      requestPatientLink(validArgs, ctx(paciente, entities)),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(entities.PatientLinkRequest.create).not.toHaveBeenCalled();
  });

  it("solicitud PENDING existente → no duplica y devuelve mensaje de revisión", async () => {
    const entities = makeEntities();
    entities.SyntheticPatient.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    entities.PatientLinkRequest.findFirst.mockResolvedValueOnce({
      id: "req-old",
      status: "PENDING",
    });

    const res = await requestPatientLink(validArgs, ctx(paciente, entities));

    expect(res).toMatchObject({ success: true, status: "PENDING" });
    expect(res.message).toContain("Ya tienes una solicitud");
    expect(entities.PatientLinkRequest.create).not.toHaveBeenCalled();
  });
});
