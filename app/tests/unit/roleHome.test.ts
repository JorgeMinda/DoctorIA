import { describe, expect, it } from "vitest";
import { getRoleHomePath } from "../../src/client/roleHome";

describe("getRoleHomePath", () => {
  it("sin sesión → /login", () => {
    expect(getRoleHomePath(null)).toBe("/login");
  });

  it("médico → asistente de voz (única entrada por CTA)", () => {
    expect(getRoleHomePath("medico")).toBe("/clinical/voice");
  });

  it("admin → pacientes (nunca voice: RoleGuard lo rebotaría)", () => {
    expect(getRoleHomePath("admin")).toBe("/clinical/patients");
  });

  it("secretaria → pacientes", () => {
    expect(getRoleHomePath("secretaria")).toBe("/clinical/patients");
  });

  it("paciente → portal del paciente", () => {
    expect(getRoleHomePath("paciente")).toBe("/patient/dashboard");
  });
});
