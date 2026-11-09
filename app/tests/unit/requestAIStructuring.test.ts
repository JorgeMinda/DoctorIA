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

vi.mock("../../src/clinical/services/aiService", () => ({
  structureClinicalText: vi.fn(),
  generateEpicrisisFromHistory: vi.fn(),
  generateAddendumDraft: vi.fn(),
  AIInvalidResponseError: class AIInvalidResponseError extends Error {},
}));

import { prisma } from "wasp/server";
import {
  AIInvalidResponseError,
  structureClinicalText,
} from "../../src/clinical/services/aiService";
import { createAuditEntry } from "../../src/clinical/services/audit";
import { requestAIStructuring } from "../../src/clinical/actions";

const medico = {
  id: "med-1",
  isMedico: true,
  isAdmin: false,
  isPaciente: false,
  isSecretaria: false,
  isActive: true,
};

const baseNote = {
  id: "note-1",
  authorId: "med-1",
  patientId: "pat-1",
  status: "DRAFT_MANUAL",
  originalText: "Paciente con dolor abdominal desde hace 3 días.",
  updatedAt: new Date("2026-08-20T10:00:00.000Z"),
};

function makeNoteEntity(overrides: {
  note?: Record<string, unknown>;
  update?: ReturnType<typeof vi.fn>;
}) {
  return {
    findUnique: vi.fn().mockResolvedValue(overrides.note ?? baseNote),
    update:
      overrides.update ??
      vi.fn().mockResolvedValue({ ...baseNote, status: "DRAFT_AI_ASSISTED" }),
  };
}

function ctx(note: Record<string, unknown>, ClinicalNote: unknown) {
  return { user: medico, entities: { ClinicalNote } } as any;
}

const args = {
  noteId: "note-1",
  expectedUpdatedAt: "2026-08-20T10:00:00.000Z",
};

const aiResult = {
  sections: {
    motivoConsulta: "Dolor abdominal",
    notaClinica: "Nota clínica IA",
    examenFisico: "Examen físico IA",
    valoracionClinica: "Valoración IA",
    planIndicaciones: "Plan IA",
  },
  unclassifiedContent: "Contenido extra IA",
};

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.medicoPatientAccess.findUnique as any).mockResolvedValue({
    id: "acc-1",
  });
  (structureClinicalText as any).mockResolvedValue(aiResult);
});

describe("requestAIStructuring", () => {
  it("éxito: estructura, aplica el CAS update y audita", async () => {
    const ClinicalNote = makeNoteEntity({});

    const result: any = await requestAIStructuring(
      args,
      ctx(baseNote, ClinicalNote),
    );

    expect(structureClinicalText).toHaveBeenCalledWith({
      text: baseNote.originalText,
      mode: "NOTE",
    });
    expect(ClinicalNote.update).toHaveBeenCalledWith({
      where: {
        id: "note-1",
        updatedAt: new Date("2026-08-20T10:00:00.000Z"),
      },
      data: expect.objectContaining({
        status: "DRAFT_AI_ASSISTED",
        motivoConsulta: "Dolor abdominal",
        unclassifiedContent: "Contenido extra IA",
      }),
    });
    expect(result.status).toBe("DRAFT_AI_ASSISTED");
    expect(createAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "REQUEST_AI_STRUCTURING",
        metadata: expect.objectContaining({ status: "DRAFT_AI_ASSISTED" }),
      }),
    );
  });

  it("fail-fast: updatedAt distinto → 409 sin gastar la llamada IA", async () => {
    const ClinicalNote = makeNoteEntity({
      note: { ...baseNote, updatedAt: new Date("2026-08-20T11:00:00.000Z") },
    });

    await expect(
      requestAIStructuring(args, ctx(baseNote, ClinicalNote)),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(structureClinicalText).not.toHaveBeenCalled();
    expect(ClinicalNote.update).not.toHaveBeenCalled();
  });

  it("conflicto P2025: devuelve CONFLICT con el aiDraft en vez de lanzar 409", async () => {
    const update = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("Record to update not found."), {
          code: "P2025",
        }),
      );
    const ClinicalNote = makeNoteEntity({ update });

    const result: any = await requestAIStructuring(
      args,
      ctx(baseNote, ClinicalNote),
    );

    expect(result.status).toBe("CONFLICT");
    expect(result.aiDraft).toEqual({
      motivoConsulta: "Dolor abdominal",
      notaClinica: "Nota clínica IA",
      examenFisico: "Examen físico IA",
      valoracionClinica: "Valoración IA",
      planIndicaciones: "Plan IA",
      unclassifiedContent: "Contenido extra IA",
    });
    expect(result.message).toContain("modificado mientras la IA procesaba");
    expect(createAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "REQUEST_AI_STRUCTURING",
        metadata: expect.objectContaining({ status: "CONFLICT" }),
      }),
    );
  });

  it("respuesta IA inválida → 502 y la nota no se modifica", async () => {
    (structureClinicalText as any).mockRejectedValue(
      new AIInvalidResponseError("sección inesperada"),
    );
    const ClinicalNote = makeNoteEntity({});

    await expect(
      requestAIStructuring(args, ctx(baseNote, ClinicalNote)),
    ).rejects.toMatchObject({ statusCode: 502 });
    expect(ClinicalNote.update).not.toHaveBeenCalled();
  });

  it("error genérico de red/timeout → 504", async () => {
    (structureClinicalText as any).mockRejectedValue(
      new Error("socket hang up"),
    );
    const ClinicalNote = makeNoteEntity({});

    await expect(
      requestAIStructuring(args, ctx(baseNote, ClinicalNote)),
    ).rejects.toMatchObject({ statusCode: 504 });
    expect(ClinicalNote.update).not.toHaveBeenCalled();
  });

  it("nota que no está en DRAFT_MANUAL → 409", async () => {
    const ClinicalNote = makeNoteEntity({
      note: { ...baseNote, status: "DRAFT_AI_ASSISTED" },
    });

    await expect(
      requestAIStructuring(args, ctx(baseNote, ClinicalNote)),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(structureClinicalText).not.toHaveBeenCalled();
  });

  it("solo el autor puede estructurar → 403", async () => {
    const ClinicalNote = makeNoteEntity({
      note: { ...baseNote, authorId: "otro-medico" },
    });

    await expect(
      requestAIStructuring(args, ctx(baseNote, ClinicalNote)),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(structureClinicalText).not.toHaveBeenCalled();
  });
});
