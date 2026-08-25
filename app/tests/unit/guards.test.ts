// Tests unitarios de guards RBAC (Fase B2): 3 roles mutuamente excluyentes,
// combinaciones inválidas y rechazo de cuentas inactivas (R2).

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

import {
  ensureAdmin,
  ensureAuthenticated,
  ensureClinicalStaff,
  ensureMedico,
  ensureRole,
  ensureSecretaria,
  getActiveClinicalRole,
} from "../../src/clinical/services/guards";

const medicoUser = { id: "u1", isMedico: true, isAdmin: false };
const adminUser = { id: "u2", isMedico: false, isAdmin: true };
const plainUser = { id: "u3", isMedico: false, isAdmin: false };
const secretariaUser = { id: "u5", isMedico: false, isAdmin: false, isSecretaria: true };
const invalidAdminMedico = { id: "u4", isMedico: true, isAdmin: true };
const invalidMedicoSecretaria = { id: "u6", isMedico: true, isAdmin: false, isSecretaria: true };
const invalidAllRoles = { id: "u7", isMedico: true, isAdmin: true, isSecretaria: true };
const medicoInactivo = { id: "u8", isMedico: true, isAdmin: false, isActive: false };
const secretariaInactiva = { id: "u9", isMedico: false, isAdmin: false, isSecretaria: true, isActive: false };

function expectHttpError(fn: () => void, status: number) {
  try {
    fn();
    throw new Error("expected thrown error");
  } catch (err: any) {
    if (err?.message === "expected thrown error") {
      throw err;
    }
    expect(err.statusCode).toBe(status);
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getActiveClinicalRole", () => {
  it("resuelve el rol único activo", () => {
    expect(getActiveClinicalRole(medicoUser as any)).toBe("medico");
    expect(getActiveClinicalRole(adminUser as any)).toBe("admin");
    expect(getActiveClinicalRole(secretariaUser as any)).toBe("secretaria");
  });

  it("devuelve null sin sesión, sin roles o con combinaciones inválidas", () => {
    expect(getActiveClinicalRole(null)).toBeNull();
    expect(getActiveClinicalRole(plainUser as any)).toBeNull();
    expect(getActiveClinicalRole(invalidAdminMedico as any)).toBeNull();
    expect(getActiveClinicalRole(invalidAllRoles as any)).toBeNull();
  });
});

describe("ensureMedico", () => {
  it("acepta médico habilitado (isMedico=true, resto false)", () => {
    const user = ensureMedico(medicoUser as any);
    expect(user.id).toBe("u1");
  });

  it("rechaza usuario no autenticado (401)", () => {
    expectHttpError(() => ensureMedico(null as any), 401);
  });

  it("rechaza rol inválido admin+médico (403)", () => {
    expectHttpError(() => ensureMedico(invalidAdminMedico as any), 403);
  });

  it("rechaza combinación médico+secretaria (403)", () => {
    expectHttpError(() => ensureMedico(invalidMedicoSecretaria as any), 403);
  });

  it("rechaza admin (403)", () => {
    expectHttpError(() => ensureMedico(adminUser as any), 403);
  });

  it("rechaza secretaria (403)", () => {
    expectHttpError(() => ensureMedico(secretariaUser as any), 403);
  });

  it("rechaza cuenta inactiva (403) aunque sea médico", () => {
    expectHttpError(() => ensureMedico(medicoInactivo as any), 403);
  });
});

describe("ensureAdmin", () => {
  it("acepta administrador (isAdmin=true, resto false)", () => {
    const user = ensureAdmin(adminUser as any);
    expect(user.id).toBe("u2");
  });

  it("rechaza no autenticado (401)", () => {
    expectHttpError(() => ensureAdmin(null as any), 401);
  });

  it("rechaza médico (403)", () => {
    expectHttpError(() => ensureAdmin(medicoUser as any), 403);
  });

  it("rechaza secretaria (403)", () => {
    expectHttpError(() => ensureAdmin(secretariaUser as any), 403);
  });

  it("rechaza rol inválido admin+médico (403)", () => {
    expectHttpError(() => ensureAdmin(invalidAdminMedico as any), 403);
  });

  it("rechaza los tres flags a la vez (403)", () => {
    expectHttpError(() => ensureAdmin(invalidAllRoles as any), 403);
  });
});

describe("ensureSecretaria", () => {
  it("acepta secretaria habilitada", () => {
    const user = ensureSecretaria(secretariaUser as any);
    expect(user.id).toBe("u5");
  });

  it("rechaza no autenticado (401)", () => {
    expectHttpError(() => ensureSecretaria(null as any), 401);
  });

  it("rechaza médico (403)", () => {
    expectHttpError(() => ensureSecretaria(medicoUser as any), 403);
  });

  it("rechaza admin (403)", () => {
    expectHttpError(() => ensureSecretaria(adminUser as any), 403);
  });

  it("rechaza combinación médico+secretaria (403)", () => {
    expectHttpError(() => ensureSecretaria(invalidMedicoSecretaria as any), 403);
  });

  it("rechaza cuenta inactiva (403)", () => {
    expectHttpError(() => ensureSecretaria(secretariaInactiva as any), 403);
  });
});

describe("ensureClinicalStaff", () => {
  it("acepta médico y secretaria", () => {
    expect(ensureClinicalStaff(medicoUser as any).id).toBe("u1");
    expect(ensureClinicalStaff(secretariaUser as any).id).toBe("u5");
  });

  it("rechaza admin (403)", () => {
    expectHttpError(() => ensureClinicalStaff(adminUser as any), 403);
  });

  it("rechaza no autenticado (401)", () => {
    expectHttpError(() => ensureClinicalStaff(null as any), 401);
  });

  it("rechaza inactivo (403)", () => {
    expectHttpError(() => ensureClinicalStaff(medicoInactivo as any), 403);
  });
});

describe("ensureRole", () => {
  it("acepta cualquiera de los roles permitidos", () => {
    expect(ensureRole(adminUser as any, "admin", "medico").id).toBe("u2");
    expect(ensureRole(medicoUser as any, "admin", "medico").id).toBe("u1");
    expect(ensureRole(secretariaUser as any, "secretaria").id).toBe("u5");
  });

  it("rechaza rol fuera de la lista (403)", () => {
    expectHttpError(() => ensureRole(plainUser as any, "medico"), 403);
    expectHttpError(() => ensureRole(secretariaUser as any, "medico"), 403);
  });

  it("rechaza inactivo incluso con rol permitido (403)", () => {
    expectHttpError(
      () => ensureRole(medicoInactivo as any, "medico", "secretaria"),
      403,
    );
  });
});

describe("ensureAuthenticated", () => {
  it("acepta cualquier usuario autenticado", () => {
    expect(ensureAuthenticated(plainUser as any).id).toBe("u3");
  });

  it("acepta admin", () => {
    expect(ensureAuthenticated(adminUser as any).id).toBe("u2");
  });

  it("rechaza no autenticado (401)", () => {
    expectHttpError(() => ensureAuthenticated(null as any), 401);
  });
});
