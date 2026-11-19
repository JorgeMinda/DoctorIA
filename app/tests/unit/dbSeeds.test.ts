import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { seedSyntheticClinicalData } from "../../src/server/scripts/dbSeeds";

describe("seedSyntheticClinicalData - Guardas de protección en producción (Constitution P5)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("omite la ejecución y no toca la base de datos si NODE_ENV='production' y no hay flags de anulación", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_PRODUCTION_SEED;
    delete process.env.RUN_SYNTHETIC_SEED;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const mockPrisma = {
      user: {
        upsert: vi.fn(),
      },
      syntheticPatient: {
        upsert: vi.fn(),
        findMany: vi.fn(),
      },
    } as any;

    await seedSyntheticClinicalData(mockPrisma);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Ejecución de seed sintético omitida en producción"),
    );
    expect(mockPrisma.user.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.syntheticPatient.upsert).not.toHaveBeenCalled();
  });

  it("permite la ejecución en producción si ALLOW_PRODUCTION_SEED='true'", async () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_PRODUCTION_SEED = "true";
    delete process.env.RUN_SYNTHETIC_SEED;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const mockPrisma = {
      user: {
        upsert: vi.fn().mockRejectedValue(new Error("parada_intencional_post_guard")),
      },
    } as any;

    await expect(seedSyntheticClinicalData(mockPrisma)).rejects.toThrow(
      "parada_intencional_post_guard",
    );
    expect(warnSpy).not.toHaveBeenCalled();
    expect(mockPrisma.user.upsert).toHaveBeenCalled();
  });

  it("permite la ejecución en producción si RUN_SYNTHETIC_SEED='true'", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_PRODUCTION_SEED;
    process.env.RUN_SYNTHETIC_SEED = "true";

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const mockPrisma = {
      user: {
        upsert: vi.fn().mockRejectedValue(new Error("parada_intencional_post_guard")),
      },
    } as any;

    await expect(seedSyntheticClinicalData(mockPrisma)).rejects.toThrow(
      "parada_intencional_post_guard",
    );
    expect(warnSpy).not.toHaveBeenCalled();
    expect(mockPrisma.user.upsert).toHaveBeenCalled();
  });

  it("permite la ejecución normal cuando NODE_ENV !== 'production' (desarrollo o test)", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.ALLOW_PRODUCTION_SEED;
    delete process.env.RUN_SYNTHETIC_SEED;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const mockPrisma = {
      user: {
        upsert: vi.fn().mockRejectedValue(new Error("parada_intencional_post_guard")),
      },
    } as any;

    await expect(seedSyntheticClinicalData(mockPrisma)).rejects.toThrow(
      "parada_intencional_post_guard",
    );
    expect(warnSpy).not.toHaveBeenCalled();
    expect(mockPrisma.user.upsert).toHaveBeenCalled();
  });
});
