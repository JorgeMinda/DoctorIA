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

import { ensureAdmin, ensureAuthenticated, ensureMedico } from "../../src/clinical/services/guards";

const medicoUser = { id: "u1", isMedico: true, isAdmin: false };
const adminUser = { id: "u2", isMedico: false, isAdmin: true };
const plainUser = { id: "u3", isMedico: false, isAdmin: false };
const invalidUser = { id: "u4", isMedico: true, isAdmin: true };

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

describe("ensureMedico", () => {
  it("acepta médico habilitado (isMedico=true, isAdmin=false)", () => {
    const user = ensureMedico(medicoUser as any);
    expect(user.id).toBe("u1");
  });

  it("rechaza usuario no autenticado (401)", () => {
    expectHttpError(() => ensureMedico(null as any), 401);
  });

  it("rechaza rol inválido admin+médico (403)", () => {
    expectHttpError(() => ensureMedico(invalidUser as any), 403);
  });

  it("rechaza admin (403)", () => {
    expectHttpError(() => ensureMedico(adminUser as any), 403);
  });
});

describe("ensureAdmin", () => {
  it("acepta administrador (isAdmin=true, isMedico=false)", () => {
    const user = ensureAdmin(adminUser as any);
    expect(user.id).toBe("u2");
  });

  it("rechaza no autenticado (401)", () => {
    expectHttpError(() => ensureAdmin(null as any), 401);
  });

  it("rechaza médico (403)", () => {
    expectHttpError(() => ensureAdmin(medicoUser as any), 403);
  });

  it("rechaza rol inválido admin+médico (403)", () => {
    expectHttpError(() => ensureAdmin(invalidUser as any), 403);
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