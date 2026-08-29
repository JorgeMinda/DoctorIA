// Acciones (Actions) del mÃ³dulo clÃ­nico.
// contracts/clinical-operations.md Â§2, Â§3, Â§5.

import { HttpError, prisma } from "wasp/server";
import {
  createProviderId,
  createUser,
  sanitizeAndSerializeProviderData,
} from "wasp/server/auth";
import {
  type ClinicalNote,
  type Cita,
  type Epicrisis,
  type MedicoPatientAccess,
  type SyntheticPatient,
  type User,
  type VitalSign,
} from "wasp/entities";
import type {
  AdminCreateMedicoUser,
  AdminUpdateMedicoUser,
  AdminDeleteMedicoUser,
  CreateClinicalNote,
  UpdateClinicalNoteDraft,
  RequestAIStructuring,
  GenerateAddendumDraftAction,
  ConfirmClinicalNote,
  CreateNoteAddendum,
  GenerateEpicrisisDraft,
  UpdateEpicrisisDraft,
  ConfirmEpicrisis,
  CreateEpicrisisAddendum,
  ManageSyntheticPatients,
  ManageCita,
  ManageMedicoPatientAccess,
  UpdateCitaStatus,
  CreateNoteFromVoice,
  DeleteClinicalNote,
  RecordEpicrisisExport,
  CreateVitalSignAction,
  CreatePreClinicalRecord,
} from "wasp/server/operations";
import * as z from "zod";
import type { CitaStatus, PreClinicalRecord } from "@prisma/client";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import {
  ensureMedico,
  ensureAdmin,
  ensureRole,
  ensureSecretaria,
  ensureClinicalStaff,
  getActiveClinicalRole,
} from "./services/guards";
import { assertMedicoPatientAccess } from "./services/patientAccess";
import { createAuditEntry, type AuditAction } from "./services/audit";
import { vitalSignInputSchema, validateVitalSignRanges } from "./services/vitalSigns";
import { validateNoOverlap } from "./services/appointmentAvailability";
import {
  structureClinicalText,
  generateEpicrisisFromHistory,
  generateAddendumDraft,
  AIInvalidResponseError,
} from "./services/aiService";
import {
  validateConfirmableNote,
  SECTION_LABELS,
} from "./services/noteValidation";
import { canTransitionCita, isCitaStatusValid } from "./services/citaLifecycle";
import {
  buildVoiceError,
  buildVoiceSummary,
  parseVoiceCommand,
  resolvePatientByName,
  resolvePatientMatches,
  type VoiceAssistantResponse,
  type VoicePatientMatch,
} from "./services/voiceAssistant";

// ---------------------------------------------------------------------------
// createClinicalNote
// ---------------------------------------------------------------------------

const createClinicalNoteInputSchema = z.object({
  patientId: z.string().min(1),
  originalText: z.string().min(1),
});

type CreateClinicalNoteInput = z.infer<typeof createClinicalNoteInputSchema>;

export const createClinicalNote: CreateClinicalNote<
  CreateClinicalNoteInput,
  ClinicalNote
> = async (rawArgs, context) => {
  const user = ensureMedico(context.user);

  const { patientId, originalText } = ensureArgsSchemaOrThrowHttpError(
    createClinicalNoteInputSchema,
    rawArgs,
  );

  await assertMedicoPatientAccess(user.id, patientId);

  const patient = await context.entities.SyntheticPatient.findUnique({
    where: { id: patientId },
  });
  if (!patient) {
    throw new HttpError(404, "Paciente no encontrado");
  }

  const note = await context.entities.ClinicalNote.create({
    data: {
      patientId,
      authorId: user.id,
      originalText,
      status: "DRAFT_MANUAL",
      noteType: "ORIGINAL",
    },
  });

  await createAuditEntry({
    userId: user.id,
    action: "CREATE_NOTE",
    resourceType: "NOTE",
    resourceId: note.id,
    patientId,
    clinicalNoteId: note.id,
  });

  return note;
};

// ---------------------------------------------------------------------------
// updateClinicalNoteDraft
// ---------------------------------------------------------------------------

const updateClinicalNoteDraftInputSchema = z.object({
  noteId: z.string().min(1),
  motivoConsulta: z.string().optional(),
  notaClinica: z.string().optional(),
  examenFisico: z.string().optional(),
  valoracionClinica: z.string().optional(),
  planIndicaciones: z.string().optional(),
  sectionsNotApplicable: z.record(z.string(), z.string()).optional(),
});

type UpdateClinicalNoteDraftInput = z.infer<
  typeof updateClinicalNoteDraftInputSchema
>;

export const updateClinicalNoteDraft: UpdateClinicalNoteDraft<
  UpdateClinicalNoteDraftInput,
  ClinicalNote
> = async (rawArgs, context) => {
  const user = ensureMedico(context.user);

  const args = ensureArgsSchemaOrThrowHttpError(
    updateClinicalNoteDraftInputSchema,
    rawArgs,
  );

  const note = await context.entities.ClinicalNote.findUnique({
    where: { id: args.noteId },
  });
  if (!note) {
    throw new HttpError(404, "Nota no encontrada");
  }
  if (note.authorId !== user.id) {
    throw new HttpError(403, "Solo el autor puede editar esta nota");
  }
  await assertMedicoPatientAccess(user.id, note.patientId);

  if (note.status === "CONFIRMED") {
    throw new HttpError(
      409,
      "Registro confirmado: solo se permite crear adenda",
    );
  }

  // originalText NUNCA se modifica vÃ­a esta operaciÃ³n (RNF-004)
  const newStatus =
    note.status === "DRAFT_AI_ASSISTED" ? "REVIEWED" : note.status;

  const updated = await context.entities.ClinicalNote.update({
    where: { id: note.id },
    data: {
      motivoConsulta: args.motivoConsulta ?? undefined,
      notaClinica: args.notaClinica ?? undefined,
      examenFisico: args.examenFisico ?? undefined,
      valoracionClinica: args.valoracionClinica ?? undefined,
      planIndicaciones: args.planIndicaciones ?? undefined,
      sectionsNotApplicable: args.sectionsNotApplicable ?? undefined,
      status: newStatus,
    },
  });

  await createAuditEntry({
    userId: user.id,
    action: newStatus === "REVIEWED" ? "REVIEW_NOTE" : "EDIT_DRAFT",
    resourceType: "NOTE",
    resourceId: note.id,
    patientId: note.patientId,
    clinicalNoteId: note.id,
    metadata: { status: newStatus },
  });

  return updated;
};

// ---------------------------------------------------------------------------
// requestAIStructuring
// ---------------------------------------------------------------------------

const requestAIStructuringInputSchema = z.object({
  noteId: z.string().min(1),
  // Token de concurrencia (CAS): updatedAt de la nota vista por el cliente (ISO).
  expectedUpdatedAt: z.string().min(1),
});

type RequestAIStructuringInput = z.infer<
  typeof requestAIStructuringInputSchema
>;

// Mapea errores del servicio de IA a HttpError controlados (FASE 8):
// - AIInvalidResponseError -> 502 (respuesta estructuralmente invÃ¡lida, nada se guardÃ³)
// - resto (timeout/red/429) -> 504 (servicio no disponible)
function mapAIServiceError(err: unknown): never {
  if (err instanceof AIInvalidResponseError) {
    throw new HttpError(
      502,
      "El asistente de IA devolviÃ³ una respuesta no vÃ¡lida. No se modificÃ³ el documento; intenta nuevamente.",
    );
  }
  throw new HttpError(
    504,
    err instanceof Error && err.message
      ? err.message
      : "El servicio de IA no estÃ¡ disponible",
  );
}

export const requestAIStructuring: RequestAIStructuring<
  RequestAIStructuringInput,
  ClinicalNote
> = async (rawArgs, context) => {
  const user = ensureMedico(context.user);

  const { noteId, expectedUpdatedAt } = ensureArgsSchemaOrThrowHttpError(
    requestAIStructuringInputSchema,
    rawArgs,
  );

  const note = await context.entities.ClinicalNote.findUnique({
    where: { id: noteId },
  });
  if (!note) {
    throw new HttpError(404, "Nota no encontrada");
  }
  if (note.authorId !== user.id) {
    throw new HttpError(403, "Solo el autor puede estructurar esta nota");
  }
  await assertMedicoPatientAccess(user.id, note.patientId);

  if (note.status !== "DRAFT_MANUAL") {
    throw new HttpError(
      409,
      "Solo las notas en estado Borrador manual pueden estructurarse",
    );
  }

  // Fail-fast: si el cliente vio una versiÃ³n vieja, no gastamos la llamada IA.
  if (note.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new HttpError(
      409,
      "El documento fue modificado mientras la IA procesaba. Recarga para ver los cambios.",
    );
  }

  let result;
  try {
    result = await structureClinicalText({
      text: note.originalText,
      mode: "NOTE",
    });
  } catch (err) {
    // RNF-008: falla de IA -> la nota permanece en DRAFT_MANUAL, texto intacto
    mapAIServiceError(err);
  }

  // CAS update (Fase 7): si nadie tocÃ³ la nota durante la generaciÃ³n,
  // updatedAt coincide y el write aplica; si no, Prisma lanza P2025.
  let updated: ClinicalNote;
  try {
    updated = await context.entities.ClinicalNote.update({
      where: { id: note.id, updatedAt: new Date(expectedUpdatedAt) },
      data: {
        status: "DRAFT_AI_ASSISTED",
        aiAssisted: true,
        motivoConsulta: result.sections.motivoConsulta ?? undefined,
        notaClinica: result.sections.notaClinica ?? undefined,
        examenFisico: result.sections.examenFisico ?? undefined,
        valoracionClinica: result.sections.valoracionClinica ?? undefined,
        planIndicaciones: result.sections.planIndicaciones ?? undefined,
        unclassifiedContent: result.unclassifiedContent ?? undefined,
      },
    });
  } catch (err: any) {
    if (err?.code === "P2025") {
      throw new HttpError(
        409,
        "El documento fue modificado mientras la IA procesaba. Recarga para ver los cambios.",
      );
    }
    throw err;
  }

  await createAuditEntry({
    userId: user.id,
    action: "REQUEST_AI_STRUCTURING",
    resourceType: "NOTE",
    resourceId: note.id,
    patientId: note.patientId,
    clinicalNoteId: note.id,
    metadata: { source: "AI", status: "DRAFT_AI_ASSISTED" },
  });

  return updated;
};

// ---------------------------------------------------------------------------
// confirmClinicalNote
// ---------------------------------------------------------------------------

const confirmClinicalNoteInputSchema = z.object({
  noteId: z.string().min(1),
});

type ConfirmClinicalNoteInput = z.infer<typeof confirmClinicalNoteInputSchema>;

export const confirmClinicalNote: ConfirmClinicalNote<
  ConfirmClinicalNoteInput,
  ClinicalNote
> = async (rawArgs, context) => {
  const user = ensureMedico(context.user);

  const { noteId } = ensureArgsSchemaOrThrowHttpError(
    confirmClinicalNoteInputSchema,
    rawArgs,
  );

  const note = await context.entities.ClinicalNote.findUnique({
    where: { id: noteId },
  });
  if (!note) {
    throw new HttpError(404, "Nota no encontrada");
  }
  await assertMedicoPatientAccess(user.id, note.patientId);

  if (note.status === "CONFIRMED") {
    throw new HttpError(409, "La nota ya estÃ¡ confirmada");
  }

  // RF-026: verificaciÃ³n acumulativa
  const validation = validateConfirmableNote({
    sections: {
      motivoConsulta: note.motivoConsulta,
      notaClinica: note.notaClinica,
      examenFisico: note.examenFisico,
      valoracionClinica: note.valoracionClinica,
      planIndicaciones: note.planIndicaciones,
    },
    sectionsNotApplicable:
      (note.sectionsNotApplicable as Record<string, string> | null) ??
      undefined,
    originalText: note.originalText,
    patientId: note.patientId,
    authorId: note.authorId,
  });

  if (!validation.ok) {
    // RF-027: bloquear con mensaje descriptivo
    const labels = validation.missing.map((k) => SECTION_LABELS[k]);
    throw new HttpError(
      422,
      `Secciones obligatorias incompletas: ${labels.join(
        ", ",
      )}. ComplÃ©telas o mÃ¡rquelas como "No aplica".`,
    );
  }

  const confirmed = await context.entities.ClinicalNote.update({
    where: { id: note.id },
    data: {
      status: "CONFIRMED",
      confirmedById: user.id,
      confirmedAt: new Date(),
    },
  });

  await createAuditEntry({
    userId: user.id,
    action: "CONFIRM_NOTE",
    resourceType: "NOTE",
    resourceId: note.id,
    patientId: note.patientId,
    clinicalNoteId: note.id,
    metadata: { status: "CONFIRMED" },
  });

  return confirmed;
};

// ---------------------------------------------------------------------------
// createNoteAddendum
// ---------------------------------------------------------------------------

const createNoteAddendumInputSchema = z.object({
  parentNoteId: z.string().min(1),
  originalText: z.string().min(1),
  addendumReason: z.string().min(1),
});

type CreateNoteAddendumInput = z.infer<typeof createNoteAddendumInputSchema>;

export const createNoteAddendum: CreateNoteAddendum<
  CreateNoteAddendumInput,
  ClinicalNote
> = async (rawArgs, context) => {
  const user = ensureMedico(context.user);

  const { parentNoteId, originalText, addendumReason } =
    ensureArgsSchemaOrThrowHttpError(createNoteAddendumInputSchema, rawArgs);

  const parent = await context.entities.ClinicalNote.findUnique({
    where: { id: parentNoteId },
  });
  if (!parent) {
    throw new HttpError(404, "Nota original no encontrada");
  }
  if (parent.status !== "CONFIRMED") {
    throw new HttpError(
      409,
      "Solo se pueden crear adendas sobre notas confirmadas",
    );
  }
  await assertMedicoPatientAccess(user.id, parent.patientId);

  const addendum = await context.entities.ClinicalNote.create({
    data: {
      patientId: parent.patientId,
      authorId: user.id,
      originalText,
      status: "DRAFT_MANUAL",
      noteType: "ADDENDUM",
      parentNoteId: parent.id,
      addendumReason,
    },
  });

  await createAuditEntry({
    userId: user.id,
    action: "CREATE_ADDENDUM",
    resourceType: "NOTE",
    resourceId: addendum.id,
    patientId: parent.patientId,
    clinicalNoteId: addendum.id,
    metadata: { parentNoteId: parent.id, noteType: "ADDENDUM" },
  });

  return addendum;
};

// ---------------------------------------------------------------------------
// generateAddendumDraft (IA asistiva, Fase 3): borrador de adenda de nota
// a partir del documento confirmado + instrucciÃ³n del profesional.
// Exclusivamente asistivo: crea SIEMPRE un DRAFT_AI_ASSISTED editable.
// ---------------------------------------------------------------------------

const generateAddendumDraftInputSchema = z.object({
  parentNoteId: z.string().min(1),
  instruction: z.string().min(1).max(4000),
  // Token CAS sobre el padre confirmado visto por el cliente (ISO).
  expectedUpdatedAt: z.string().min(1),
});

type GenerateAddendumDraftInput = z.infer<
  typeof generateAddendumDraftInputSchema
>;

export const generateAddendumDraftAction: GenerateAddendumDraftAction<
  GenerateAddendumDraftInput,
  ClinicalNote
> = async (rawArgs, context) => {
  const user = ensureMedico(context.user);

  const { parentNoteId, instruction, expectedUpdatedAt } =
    ensureArgsSchemaOrThrowHttpError(generateAddendumDraftInputSchema, rawArgs);

  const parent = await context.entities.ClinicalNote.findUnique({
    where: { id: parentNoteId },
  });
  if (!parent) {
    throw new HttpError(404, "Nota original no encontrada");
  }
  if (parent.status !== "CONFIRMED") {
    throw new HttpError(
      409,
      "Solo se pueden crear adendas sobre notas confirmadas",
    );
  }
  await assertMedicoPatientAccess(user.id, parent.patientId);

  // Fail-fast si el padre cambiÃ³ desde que el cliente lo consultÃ³.
  if (parent.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new HttpError(
      409,
      "El documento fue modificado mientras la IA procesaba. Recarga para ver los cambios.",
    );
  }

  let result;
  try {
    result = await generateAddendumDraft(parent.originalText, instruction);
  } catch (err) {
    mapAIServiceError(err);
  }

  const addendum = await context.entities.ClinicalNote.create({
    data: {
      patientId: parent.patientId,
      authorId: user.id,
      // RNF-004: se preserva la instrucciÃ³n del profesional como texto fuente
      // inmutable de la adenda; las secciones IA quedan como borrador editable.
      originalText: instruction,
      status: "DRAFT_AI_ASSISTED",
      aiAssisted: true,
      noteType: "ADDENDUM",
      parentNoteId: parent.id,
      addendumReason: instruction,
      motivoConsulta: result.sections.motivoConsulta ?? undefined,
      notaClinica: result.sections.notaClinica ?? undefined,
      examenFisico: result.sections.examenFisico ?? undefined,
      valoracionClinica: result.sections.valoracionClinica ?? undefined,
      planIndicaciones: result.sections.planIndicaciones ?? undefined,
      unclassifiedContent: result.unclassifiedContent ?? undefined,
    },
  });

  await createAuditEntry({
    userId: user.id,
    action: "CREATE_ADDENDUM",
    resourceType: "NOTE",
    resourceId: addendum.id,
    patientId: parent.patientId,
    clinicalNoteId: addendum.id,
    metadata: {
      source: "AI",
      status: "DRAFT_AI_ASSISTED",
      parentNoteId: parent.id,
      noteType: "ADDENDUM",
    },
  });

  return addendum;
};

// ---------------------------------------------------------------------------
// generateEpicrisisDraft
// ---------------------------------------------------------------------------

const generateEpicrisisDraftInputSchema = z.object({
  patientId: z.string().min(1),
});

type GenerateEpicrisisDraftInput = z.infer<
  typeof generateEpicrisisDraftInputSchema
>;

export const generateEpicrisisDraft: GenerateEpicrisisDraft<
  GenerateEpicrisisDraftInput,
  Epicrisis
> = async (rawArgs, context) => {
  const user = ensureMedico(context.user);

  const { patientId } = ensureArgsSchemaOrThrowHttpError(
    generateEpicrisisDraftInputSchema,
    rawArgs,
  );

  await assertMedicoPatientAccess(user.id, patientId);

  // ValidaciÃ³n: el paciente debe tener al menos una nota CONFIRMED
  const confirmedNotes = await context.entities.ClinicalNote.findMany({
    where: { patientId, status: "CONFIRMED" },
    orderBy: { createdAt: "desc" },
  });
  if (confirmedNotes.length === 0) {
    throw new HttpError(
      422,
      "El paciente debe tener al menos una nota confirmada para generar una epicrisis",
    );
  }

  let result;
  try {
    result = await generateEpicrisisFromHistory(
      confirmedNotes.map((n) => n.originalText),
    );
  } catch (err) {
    mapAIServiceError(err);
  }

  const patient = await context.entities.SyntheticPatient.findUnique({
    where: { id: patientId },
  });

  const epicrisis = await context.entities.Epicrisis.create({
    data: {
      patientId,
      authorId: user.id,
      status: "DRAFT_AI_ASSISTED",
      noteType: "ORIGINAL",
      aiAssisted: true,
      patientIdentification: `${patient?.syntheticId ?? ""} - ${
        patient?.firstName ?? ""
      } ${patient?.lastName ?? ""}`.trim(),
      reasonForAdmission: result.elements.reasonForAdmission ?? undefined,
      relevantHistory: result.elements.relevantHistory ?? undefined,
      evolutionSummary: result.elements.evolutionSummary ?? undefined,
      proceduresResults: result.elements.proceduresResults ?? undefined,
      validatedDiagnoses: result.elements.validatedDiagnoses ?? undefined,
      conditionAtDischarge: result.elements.conditionAtDischarge ?? undefined,
      followUpInstructions: result.elements.followUpInstructions ?? undefined,
      responsibleProfessional:
        user.fullName ?? user.username ?? user.email ?? "",
      dateTime: new Date(),
    },
  });

  await createAuditEntry({
    userId: user.id,
    action: "GENERATE_EPICRISIS",
    resourceType: "EPICRISIS",
    resourceId: epicrisis.id,
    patientId,
    epicrisisId: epicrisis.id,
    metadata: { source: "AI", status: "DRAFT_AI_ASSISTED" },
  });

  return epicrisis;
};

// ---------------------------------------------------------------------------
// updateEpicrisisDraft
// ---------------------------------------------------------------------------

const updateEpicrisisDraftInputSchema = z.object({
  epicrisisId: z.string().min(1),
  reasonForAdmission: z.string().optional(),
  relevantHistory: z.string().optional(),
  evolutionSummary: z.string().optional(),
  proceduresResults: z.string().optional(),
  validatedDiagnoses: z.string().optional(),
  conditionAtDischarge: z.string().optional(),
  followUpInstructions: z.string().optional(),
});

type UpdateEpicrisisDraftInput = z.infer<
  typeof updateEpicrisisDraftInputSchema
>;

export const updateEpicrisisDraft: UpdateEpicrisisDraft<
  UpdateEpicrisisDraftInput,
  Epicrisis
> = async (rawArgs, context) => {
  const user = ensureMedico(context.user);

  const args = ensureArgsSchemaOrThrowHttpError(
    updateEpicrisisDraftInputSchema,
    rawArgs,
  );

  const epicrisis = await context.entities.Epicrisis.findUnique({
    where: { id: args.epicrisisId },
  });
  if (!epicrisis) {
    throw new HttpError(404, "Epicrisis no encontrada");
  }
  if (epicrisis.authorId !== user.id) {
    throw new HttpError(403, "Solo el autor puede editar esta epicrisis");
  }
  await assertMedicoPatientAccess(user.id, epicrisis.patientId);

  if (epicrisis.status === "CONFIRMED") {
    throw new HttpError(
      409,
      "Registro confirmado: solo se permite crear adenda",
    );
  }

  const newStatus =
    epicrisis.status === "DRAFT_AI_ASSISTED" ? "REVIEWED" : epicrisis.status;

  const updated = await context.entities.Epicrisis.update({
    where: { id: epicrisis.id },
    data: {
      reasonForAdmission: args.reasonForAdmission ?? undefined,
      relevantHistory: args.relevantHistory ?? undefined,
      evolutionSummary: args.evolutionSummary ?? undefined,
      proceduresResults: args.proceduresResults ?? undefined,
      validatedDiagnoses: args.validatedDiagnoses ?? undefined,
      conditionAtDischarge: args.conditionAtDischarge ?? undefined,
      followUpInstructions: args.followUpInstructions ?? undefined,
      status: newStatus,
    },
  });

  await createAuditEntry({
    userId: user.id,
    action: "REVIEW_EPICRISIS",
    resourceType: "EPICRISIS",
    resourceId: epicrisis.id,
    patientId: epicrisis.patientId,
    epicrisisId: epicrisis.id,
    metadata: { status: newStatus },
  });

  return updated;
};

// ---------------------------------------------------------------------------
// confirmEpicrisis
// ---------------------------------------------------------------------------

const confirmEpicrisisInputSchema = z.object({
  epicrisisId: z.string().min(1),
});

type ConfirmEpicrisisInput = z.infer<typeof confirmEpicrisisInputSchema>;

export const confirmEpicrisis: ConfirmEpicrisis<
  ConfirmEpicrisisInput,
  Epicrisis
> = async (rawArgs, context) => {
  const user = ensureMedico(context.user);

  const { epicrisisId } = ensureArgsSchemaOrThrowHttpError(
    confirmEpicrisisInputSchema,
    rawArgs,
  );

  const epicrisis = await context.entities.Epicrisis.findUnique({
    where: { id: epicrisisId },
  });
  if (!epicrisis) {
    throw new HttpError(404, "Epicrisis no encontrada");
  }
  await assertMedicoPatientAccess(user.id, epicrisis.patientId);

  if (epicrisis.status === "CONFIRMED") {
    throw new HttpError(409, "La epicrisis ya estÃ¡ confirmada");
  }
  if (
    epicrisis.status !== "DRAFT_AI_ASSISTED" &&
    epicrisis.status !== "REVIEWED"
  ) {
    throw new HttpError(409, "Estado invÃ¡lido para confirmar");
  }

  // ValidaciÃ³n RF-018: elementos obligatorios
  const missing: string[] = [];
  if (!epicrisis.patientIdentification)
    missing.push("IdentificaciÃ³n del paciente");
  if (!epicrisis.responsibleProfessional)
    missing.push("Profesional responsable");
  if (!epicrisis.dateTime) missing.push("Fecha y hora");

  if (missing.length > 0) {
    throw new HttpError(
      422,
      `Elementos obligatorios incompletos: ${missing.join(", ")}`,
    );
  }

  const confirmed = await context.entities.Epicrisis.update({
    where: { id: epicrisis.id },
    data: {
      status: "CONFIRMED",
      confirmedById: user.id,
      confirmedAt: new Date(),
    },
  });

  await createAuditEntry({
    userId: user.id,
    action: "CONFIRM_EPICRISIS",
    resourceType: "EPICRISIS",
    resourceId: epicrisis.id,
    patientId: epicrisis.patientId,
    epicrisisId: epicrisis.id,
    metadata: { status: "CONFIRMED" },
  });

  return confirmed;
};

// ---------------------------------------------------------------------------
// createEpicrisisAddendum
// ---------------------------------------------------------------------------

const createEpicrisisAddendumInputSchema = z.object({
  parentEpicrisisId: z.string().min(1),
  addendumReason: z.string().min(1),
  patientIdentification: z.string().min(1),
  reasonForAdmission: z.string().optional(),
  relevantHistory: z.string().optional(),
  evolutionSummary: z.string().optional(),
  proceduresResults: z.string().optional(),
  validatedDiagnoses: z.string().optional(),
  conditionAtDischarge: z.string().optional(),
  followUpInstructions: z.string().optional(),
});

type CreateEpicrisisAddendumInput = z.infer<
  typeof createEpicrisisAddendumInputSchema
>;

export const createEpicrisisAddendum: CreateEpicrisisAddendum<
  CreateEpicrisisAddendumInput,
  Epicrisis
> = async (rawArgs, context) => {
  const user = ensureMedico(context.user);

  const args = ensureArgsSchemaOrThrowHttpError(
    createEpicrisisAddendumInputSchema,
    rawArgs,
  );

  const parent = await context.entities.Epicrisis.findUnique({
    where: { id: args.parentEpicrisisId },
  });
  if (!parent) {
    throw new HttpError(404, "Epicrisis original no encontrada");
  }
  if (parent.status !== "CONFIRMED") {
    throw new HttpError(
      409,
      "Solo se pueden crear adendas sobre epicrisis confirmadas",
    );
  }
  await assertMedicoPatientAccess(user.id, parent.patientId);

  const addendum = await context.entities.Epicrisis.create({
    data: {
      patientId: parent.patientId,
      authorId: user.id,
      status: "DRAFT_AI_ASSISTED",
      noteType: "ADDENDUM",
      parentEpicrisisId: parent.id,
      addendumReason: args.addendumReason,
      patientIdentification: args.patientIdentification,
      reasonForAdmission: args.reasonForAdmission ?? undefined,
      relevantHistory: args.relevantHistory ?? undefined,
      evolutionSummary: args.evolutionSummary ?? undefined,
      proceduresResults: args.proceduresResults ?? undefined,
      validatedDiagnoses: args.validatedDiagnoses ?? undefined,
      conditionAtDischarge: args.conditionAtDischarge ?? undefined,
      followUpInstructions: args.followUpInstructions ?? undefined,
      responsibleProfessional:
        user.fullName ?? user.username ?? user.email ?? "",
      dateTime: new Date(),
    },
  });

  await createAuditEntry({
    userId: user.id,
    action: "CREATE_ADDENDUM",
    resourceType: "EPICRISIS",
    resourceId: addendum.id,
    patientId: parent.patientId,
    epicrisisId: addendum.id,
    metadata: { parentEpicrisisId: parent.id, noteType: "ADDENDUM" },
  });

  return addendum;
};

// ---------------------------------------------------------------------------
// manageSyntheticPatients (Admin)
// ---------------------------------------------------------------------------

const manageSyntheticPatientsInputSchema = z.object({
  action: z.enum(["CREATE", "UPDATE", "DELETE", "SET_ACTIVE"]),
  data: z
    .object({
      syntheticId: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      birthDate: z
        .union([z.date(), z.string(), z.number()])
        .pipe(z.coerce.date())
        .optional(),
      sex: z.string().optional(),
      documento: z.string().nullable().optional(),
      medicalHistory: z.string().nullable().optional(),
      allergies: z.string().nullable().optional(),
      nationality: z.string().nullable().optional(),
      heightCm: z.coerce.number().min(1).max(300).nullable().optional(),
      weightKg: z.coerce.number().min(1).max(500).nullable().optional(),
      ethnicity: z.string().nullable().optional(),
      bloodType: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      emergencyName: z.string().max(200).nullable().optional(),
      emergencyPhone: z.string().nullable().optional(),
      insurance: z.string().nullable().optional(),
    })
    .optional()
    .default({}),
  patientId: z.string().optional(),
  // Solo para SET_ACTIVE (R3: reactivar/desactivar es exclusivo de admin).
  isActive: z.boolean().optional(),
});

type ManageSyntheticPatientsInput = z.infer<
  typeof manageSyntheticPatientsInputSchema
>;

export const manageSyntheticPatients: ManageSyntheticPatients<
  ManageSyntheticPatientsInput,
  SyntheticPatient | { success: true }
> = async (rawArgs, context) => {
  // Secretaria puede crear/editar/desactivar pacientes; SET_ACTIVE (reactivar)
  // es exclusivo de admin (R3).
  const user = ensureRole(context.user, "admin", "secretaria");

  const args = ensureArgsSchemaOrThrowHttpError(
    manageSyntheticPatientsInputSchema,
    rawArgs,
  );

  const { action, data, patientId, isActive } = args;

  if (action === "SET_ACTIVE") {
    if (getActiveClinicalRole(user) !== "admin") {
      throw new HttpError(403, "Solo un administrador puede reactivar pacientes");
    }
    if (!patientId || typeof isActive !== "boolean") {
      throw new HttpError(400, "patientId e isActive son requeridos");
    }
    const updated = await context.entities.SyntheticPatient.update({
      where: { id: patientId },
      data: { isActive },
    });
    await createAuditEntry({
      userId: user.id,
      action: "ADMIN_MANAGE_DATA",
      resourceType: "PATIENT",
      resourceId: updated.id,
      patientId: updated.id,
      metadata: {
        adminAction: isActive ? "ACTIVATE_PATIENT" : "DEACTIVATE_PATIENT",
      },
    });
    return updated;
  }

  if (action === "CREATE") {
    if (!data.firstName || !data.lastName || !data.birthDate || !data.sex) {
      throw new HttpError(400, "Campos obligatorios incompletos");
    }

    let syntheticId = data.syntheticId?.trim();
    if (syntheticId) {
      if (!/^PAC-\d{1,6}$/.test(syntheticId)) {
        throw new HttpError(
          400,
          "El identificador sintÃ©tico debe tener el formato PAC-NNN",
        );
      }
      const existing = await context.entities.SyntheticPatient.findUnique({
        where: { syntheticId },
      });
      if (existing) {
        throw new HttpError(
          409,
          "Ya existe un paciente con ese identificador sintÃ©tico",
        );
      }
    } else {
      const existing = await context.entities.SyntheticPatient.findMany({
        where: { syntheticId: { startsWith: "PAC-" } },
        select: { syntheticId: true },
      });
      const nums = existing.map((e: { syntheticId: string }) => {
        const m = /^PAC-(\d+)$/.exec(e.syntheticId);
        return m ? parseInt(m[1], 10) : 0;
      });
      const nextNum = (nums.length ? Math.max(...nums) : 0) + 1;
      syntheticId = "PAC-" + String(nextNum).padStart(3, "0");
    }

    const patient = await context.entities.SyntheticPatient.create({
      data: {
        syntheticId,
        firstName: data.firstName,
        lastName: data.lastName,
        birthDate: data.birthDate,
        sex: data.sex,
        documento: data.documento ?? undefined,
        medicalHistory: data.medicalHistory ?? undefined,
        allergies: data.allergies ?? undefined,
        nationality: data.nationality ?? undefined,
        heightCm: data.heightCm ?? undefined,
        weightKg: data.weightKg ?? undefined,
        ethnicity: data.ethnicity ?? undefined,
        bloodType: data.bloodType ?? undefined,
        address: data.address ?? undefined,
        phone: data.phone ?? undefined,
        emergencyName: data.emergencyName ?? undefined,
        emergencyPhone: data.emergencyPhone ?? undefined,
        insurance: data.insurance ?? undefined,
      },
    });
    await createAuditEntry({
      userId: user.id,
      action: "ADMIN_MANAGE_DATA",
      resourceType: "PATIENT",
      resourceId: patient.id,
      patientId: patient.id,
      metadata: { adminAction: "CREATE" },
    });
    return patient;
  }

  if (!patientId) {
    throw new HttpError(400, "patientId es requerido");
  }

  if (action === "UPDATE") {
    const patient = await context.entities.SyntheticPatient.update({
      where: { id: patientId },
      data: {
        syntheticId: data.syntheticId ?? undefined,
        firstName: data.firstName ?? undefined,
        lastName: data.lastName ?? undefined,
        birthDate: data.birthDate ?? undefined,
        sex: data.sex ?? undefined,
        documento: data.documento ?? undefined,
        medicalHistory: data.medicalHistory ?? undefined,
        allergies: data.allergies ?? undefined,
        nationality: data.nationality ?? undefined,
        heightCm: data.heightCm ?? undefined,
        weightKg: data.weightKg ?? undefined,
        ethnicity: data.ethnicity ?? undefined,
        bloodType: data.bloodType ?? undefined,
        address: data.address ?? undefined,
        phone: data.phone ?? undefined,
        emergencyName: data.emergencyName ?? undefined,
        emergencyPhone: data.emergencyPhone ?? undefined,
        insurance: data.insurance ?? undefined,
      },
    });
    await createAuditEntry({
      userId: user.id,
      action: "ADMIN_MANAGE_DATA",
      resourceType: "PATIENT",
      resourceId: patient.id,
      patientId: patient.id,
      metadata: { adminAction: "UPDATE" },
    });
    return patient;
  }

  // DELETE hÃ­brido (R4): con historial clÃ­nico/citas el paciente se
  // DESACTIVA (isActive=false) preservando su historia; sin historial se
  // elimina fÃ­sicamente junto a sus referencias.
  const [notesCount, epicrisesCount, citasCount] = await Promise.all([
    context.entities.ClinicalNote.count({ where: { patientId } }),
    context.entities.Epicrisis.count({ where: { patientId } }),
    context.entities.Cita.count({ where: { patientId } }),
  ]);
  const hasHistory = notesCount + epicrisesCount + citasCount > 0;

  if (hasHistory) {
    const deactivated = await context.entities.SyntheticPatient.update({
      where: { id: patientId },
      data: { isActive: false },
    });
    await createAuditEntry({
      userId: user.id,
      action: "ADMIN_MANAGE_DATA",
      resourceType: "PATIENT",
      resourceId: patientId,
      patientId,
      metadata: {
        adminAction: "DEACTIVATE_PATIENT",
        softDeleted: "true",
        notas: String(notesCount),
        epicrises: String(epicrisesCount),
        citas: String(citasCount),
      },
    });
    return deactivated;
  }

  await context.entities.MedicoPatientAccess.deleteMany({
    where: { patientId },
  });
  await context.entities.AuditLog.deleteMany({ where: { patientId } });
  const deleted = await context.entities.SyntheticPatient.delete({
    where: { id: patientId },
  });
  await createAuditEntry({
    userId: user.id,
    action: "ADMIN_MANAGE_DATA",
    resourceType: "PATIENT",
    resourceId: patientId,
    patientId,
    metadata: { adminAction: "DELETE" },
  });
  return deleted;
};

// ---------------------------------------------------------------------------
// manageMedicoPatientAccess (Admin)
// ---------------------------------------------------------------------------

const manageMedicoPatientAccessInputSchema = z.object({
  action: z.enum(["GRANT", "REVOKE"]),
  medicoId: z.string().min(1),
  patientId: z.string().min(1),
});

type ManageMedicoPatientAccessInput = z.infer<
  typeof manageMedicoPatientAccessInputSchema
>;

export const manageMedicoPatientAccess: ManageMedicoPatientAccess<
  ManageMedicoPatientAccessInput,
  MedicoPatientAccess | { success: true }
> = async (rawArgs, context) => {
  // Secretaria gestiona asignaciones como parte de la administraciÃ³n de agenda.
  const user = ensureRole(context.user, "admin", "secretaria");

  const { action, medicoId, patientId } = ensureArgsSchemaOrThrowHttpError(
    manageMedicoPatientAccessInputSchema,
    rawArgs,
  );

  const medico = await context.entities.User.findUnique({
    where: { id: medicoId },
  });
  if (
    !medico ||
    getActiveClinicalRole(medico as any) !== "medico" ||
    medico.isActive === false
  ) {
    throw new HttpError(
      400,
      "medicoId debe referenciar un mÃ©dico activo habilitado",
    );
  }

  const patient = await context.entities.SyntheticPatient.findUnique({
    where: { id: patientId },
  });
  if (!patient) {
    throw new HttpError(404, "Paciente no encontrado");
  }

  if (action === "GRANT") {
    const existing = await context.entities.MedicoPatientAccess.findUnique({
      where: { medicoId_patientId: { medicoId, patientId } },
    });
    if (existing) {
      throw new HttpError(409, "El mÃ©dico ya tiene acceso a este paciente");
    }
    const access = await context.entities.MedicoPatientAccess.create({
      data: { medicoId, patientId, grantedById: user.id },
    });
    await createAuditEntry({
      userId: user.id,
      action: "ASSIGN_PATIENT_TO_MEDICO",
      resourceType: "PATIENT",
      resourceId: patientId,
      patientId,
      metadata: { accessAction: "GRANT", medicoId },
    });
    return access;
  }

  // REVOKE
  const existing = await context.entities.MedicoPatientAccess.findUnique({
    where: { medicoId_patientId: { medicoId, patientId } },
  });
  if (!existing) {
    throw new HttpError(409, "El mÃ©dico no tiene acceso a este paciente");
  }
  await context.entities.MedicoPatientAccess.delete({
    where: { id: existing.id },
  });
  await createAuditEntry({
    userId: user.id,
    action: "ASSIGN_PATIENT_TO_MEDICO",
    resourceType: "PATIENT",
    resourceId: patientId,
    patientId,
    metadata: { accessAction: "REVOKE", medicoId },
  });
  return { success: true };
};

// ---------------------------------------------------------------------------
// adminCreateMedicoUser (Admin) - alta de usuario con rol MÃ©dico
// ---------------------------------------------------------------------------

const adminCreateMedicoUserInputSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, "La contraseÃ±a debe tener al menos 8 caracteres")
    .regex(/[A-Z]/, "La contraseÃ±a debe incluir al menos una mayÃºscula")
    .regex(/[0-9]/, "La contraseÃ±a debe incluir al menos un nÃºmero"),
  fullName: z.string().min(1).optional(),
  specialty: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  // B3: el admin puede crear también personal de secretaría.
  role: z.enum(["medico", "secretaria"]).optional(),
});

type AdminCreateMedicoUserInput = z.infer<
  typeof adminCreateMedicoUserInputSchema
>;

export const adminCreateMedicoUser: AdminCreateMedicoUser<
  AdminCreateMedicoUserInput,
  User
> = async (rawArgs, context) => {
  const user = ensureAdmin(context.user);

  const { email, password, fullName, specialty, username, role: roleArg } =
    ensureArgsSchemaOrThrowHttpError(adminCreateMedicoUserInputSchema, rawArgs);
  const role = roleArg ?? "medico";

  const existingUser = await context.entities.User.findUnique({
    where: { email },
  });
  if (existingUser) {
    if (!existingUser.isActive) {
      // El usuario existía previamente pero estaba inactivo: lo reactivamos con el rol solicitado
      const updated = await context.entities.User.update({
        where: { id: existingUser.id },
        data: {
          fullName: fullName ?? existingUser.fullName,
          specialty: role === "medico" ? specialty ?? existingUser.specialty : null,
          isMedico: role === "medico",
          isAdmin: false,
          isSecretaria: role === "secretaria",
          isActive: true,
        },
      });

      await createAuditEntry({
        userId: user.id,
        action: "ADMIN_MANAGE_USER",
        resourceType: "USER",
        resourceId: updated.id,
        metadata: {
          adminAction: `REACTIVATE_${role.toUpperCase()}`,
          email,
        },
      });

      return updated;
    }
    throw new HttpError(409, "Ya existe un usuario activo con ese correo");
  }

  const serializedProviderData =
    await sanitizeAndSerializeProviderData<"email">({
      hashedPassword: password,
      isEmailVerified: true,
      emailVerificationSentAt: null,
      passwordResetSentAt: null,
    });

  const created = await createUser(
    createProviderId("email", email),
    serializedProviderData,
    {
      email,
      username: username ?? email.split("@")[0].toLowerCase(),
      fullName: fullName ?? null,
      specialty: role === "medico" ? specialty ?? null : null,
      isMedico: role === "medico",
      isAdmin: false,
      isSecretaria: role === "secretaria",
      isActive: true,
    },
  );

  await createAuditEntry({
    userId: user.id,
    action: "ADMIN_MANAGE_USER",
    resourceType: "USER",
    resourceId: created.id,
    metadata: {
      adminAction: `CREATE_${role.toUpperCase()}`,
      email,
    },
  });

  return created;
};

// ---------------------------------------------------------------------------
// createVitalSign (Secretaría o Médico) - registro de signos vitales (Fase B3)
// Sin contenido narrativo; los valores NUNCA van al AuditLog.
// ---------------------------------------------------------------------------

const createVitalSignInputSchema = vitalSignInputSchema;

type CreateVitalSignInput = z.infer<typeof createVitalSignInputSchema>;

export const createVitalSignAction: CreateVitalSignAction<
  CreateVitalSignInput,
  VitalSign
> = async (rawArgs, context) => {
  // Médico o secretaria (kickoff Semana 6). Admin NO registra signos.
  const user = ensureClinicalStaff(context.user);

  const args = ensureArgsSchemaOrThrowHttpError(
    createVitalSignInputSchema,
    rawArgs,
  );
  validateVitalSignRanges(args);
  const { patientId, citaId } = args;

  const patient = await context.entities.SyntheticPatient.findUnique({
    where: { id: patientId },
    select: { id: true, isActive: true },
  });
  if (!patient) {
    throw new HttpError(404, "Paciente no encontrado");
  }
  if (patient.isActive === false) {
    throw new HttpError(409, "El paciente está inactivo");
  }

  // El médico solo registra sobre pacientes autorizados; la secretaría
  // gestiona toda la agenda (R1 restringe notas clínicas, no vitales).
  const role = getActiveClinicalRole(user);
  if (role === "medico") {
    await assertMedicoPatientAccess(user.id, patientId);
  }

  if (citaId) {
    const cita = await context.entities.Cita.findUnique({
      where: { id: citaId },
      select: { id: true, patientId: true },
    });
    if (!cita) {
      throw new HttpError(404, "Cita no encontrada");
    }
    if (cita.patientId !== patientId) {
      throw new HttpError(
        400,
        "La cita indicada no pertenece a este paciente",
      );
    }
  }

  const created = await context.entities.VitalSign.create({
    data: {
      patientId,
      citaId: citaId ?? undefined,
      recordedById: user.id,
      systolicBP: args.systolicBP,
      diastolicBP: args.diastolicBP,
      heartRate: args.heartRate,
      temperature: args.temperature,
      respiratoryRate: args.respiratoryRate,
      oxygenSaturation: args.oxygenSaturation,
      weight: args.weight,
      height: args.height,
    },
  });

  await createAuditEntry({
    userId: user.id,
    action: "REGISTER_VITAL_SIGNS",
    resourceType: "PATIENT",
    resourceId: created.id,
    patientId,
    metadata: { registeredByRole: role ?? "" , ...(citaId ? { citaId } : {}) },
  });

  return created;
};

// ---------------------------------------------------------------------------
// adminUpdateMedicoUser (Admin) - ediciÃ³n de campos permitidos del perfil mÃ©dico
// ---------------------------------------------------------------------------

const adminUpdateMedicoUserInputSchema = z.object({
  id: z.string().min(1),
  fullName: z.string().min(1).optional(),
  specialty: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

type AdminUpdateMedicoUserInput = z.infer<
  typeof adminUpdateMedicoUserInputSchema
>;

// createPreClinicalRecord (Secretaria) - Registro pre-clínico ligado 1:1 a la cita.
// ESTRICTO: solo citas SCHEDULED, un registro por cita, sin contenido clínico.
const preClinicalRecordInputSchema = vitalSignInputSchema.extend({
  citaId: z.string().min(1),
  motivoConsulta: z.string().min(1).max(500),
});

type CreatePreClinicalRecordInput = z.infer<typeof preClinicalRecordInputSchema>;

export const createPreClinicalRecord: CreatePreClinicalRecord<
  CreatePreClinicalRecordInput,
  PreClinicalRecord
> = async (rawArgs, context) => {
  const user = ensureSecretaria(context.user);

  const args = ensureArgsSchemaOrThrowHttpError(
    preClinicalRecordInputSchema,
    rawArgs,
  );
  validateVitalSignRanges(args);

    const cita = await context.entities.Cita.findUnique({
      where: { id: args.citaId },
      select: {
        id: true,
        status: true,
        patientId: true,
        medicoId: true,
        medico: { select: { fullName: true } },
      },
    });
  if (!cita) {
    throw new HttpError(404, "Cita no encontrada");
  }
  if (cita.status !== "SCHEDULED") {
    throw new HttpError(
      409,
      "El registro pre-clínico solo se permite en citas agendadas (SCHEDULED)",
    );
  }
  if (cita.patientId !== args.patientId) {
    throw new HttpError(
      400,
      "La cita indicada no pertenece a este paciente",
    );
  }

  const patient = await context.entities.SyntheticPatient.findUnique({
    where: { id: args.patientId },
    select: { id: true, isActive: true },
  });
  if (!patient) {
    throw new HttpError(404, "Paciente no encontrado");
  }
  if (patient.isActive === false) {
    throw new HttpError(409, "El paciente está inactivo");
  }

  const existing = await context.entities.PreClinicalRecord.findUnique({
    where: { citaId: args.citaId },
  });
  if (existing) {
    throw new HttpError(
      409,
      "Ya existe un registro pre-clínico para esta cita",
    );
  }

  const created = await context.entities.PreClinicalRecord.create({
    data: {
      citaId: args.citaId,
      patientId: args.patientId,
      recordedById: user.id,
      motivoConsulta: args.motivoConsulta,
      systolicBP: args.systolicBP,
      diastolicBP: args.diastolicBP,
      heartRate: args.heartRate,
      temperature: args.temperature,
      respiratoryRate: args.respiratoryRate,
      oxygenSaturation: args.oxygenSaturation,
      weight: args.weight,
      height: args.height,
    },
  });

  await createAuditEntry({
    userId: user.id,
    action: "REGISTER_PRE_CLINICAL_DATA",
    resourceType: "CITA",
    resourceId: created.id,
    patientId: created.patientId,
    citaId: created.citaId,
    metadata: {
      registeredByRole: "secretaria",
      doctorName: cita.medico?.fullName ?? null,
    },
  });

  return created;
};

// updatePreClinicalRecord (Secretaria) - Edición completa del registro pre-clínico (exclusivo para rol secretaria).
const updatePreClinicalRecordInputSchema = vitalSignInputSchema.extend({
  citaId: z.string().min(1),
  motivoConsulta: z.string().min(1).max(500),
});

type UpdatePreClinicalRecordInput = z.infer<typeof updatePreClinicalRecordInputSchema>;

export const updatePreClinicalRecord: any = async (
  rawArgs: any,
  context: any,
) => {
  const user = ensureSecretaria(context.user);

  const args = ensureArgsSchemaOrThrowHttpError(
    updatePreClinicalRecordInputSchema,
    rawArgs,
  );
  validateVitalSignRanges(args);

  const existing = await context.entities.PreClinicalRecord.findUnique({
    where: { citaId: args.citaId },
    include: {
      cita: {
        select: {
          id: true,
          status: true,
          medico: { select: { fullName: true } },
        },
      },
    },
  });

  if (!existing) {
    throw new HttpError(404, "Registro pre-clínico no encontrado");
  }

  const updated = await context.entities.PreClinicalRecord.update({
    where: { id: existing.id },
    data: {
      motivoConsulta: args.motivoConsulta,
      systolicBP: args.systolicBP,
      diastolicBP: args.diastolicBP,
      heartRate: args.heartRate,
      temperature: args.temperature,
      respiratoryRate: args.respiratoryRate,
      oxygenSaturation: args.oxygenSaturation,
      weight: args.weight,
      height: args.height,
    },
  });

  await createAuditEntry({
    userId: user.id,
    action: "REGISTER_PRE_CLINICAL_DATA",
    resourceType: "CITA",
    resourceId: updated.id,
    patientId: updated.patientId,
    citaId: updated.citaId,
    metadata: {
      updatedByRole: "secretaria",
      adminAction: "UPDATE_PRE_CLINICAL_RECORD",
      doctorName: existing.cita?.medico?.fullName ?? null,
    },
  });

  return updated;
};

// createEmergencyAssignment (Secretaria / Admin) - Cita y asignación de emergencia express
const createEmergencyAssignmentInputSchema = z.object({
  firstName: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().min(1, "El apellido es requerido"),
  sex: z.string().min(1, "El sexo es requerido"),
  birthDate: z.coerce.date().optional(),
  documento: z.string().max(20).nullable().optional(),
  motivoConsulta: z.string().max(500).optional(),
  medicoId: z.string().optional(),
});

type CreateEmergencyAssignmentInput = z.infer<
  typeof createEmergencyAssignmentInputSchema
>;

export const createEmergencyAssignment: any = async (
  rawArgs: any,
  context: any,
) => {
  const user = ensureRole(context.user, "secretaria", "admin");

  const args = ensureArgsSchemaOrThrowHttpError(
    createEmergencyAssignmentInputSchema,
    rawArgs,
  );

  // 1. Resolver médico asignado
  let medicoId = args.medicoId;
  if (!medicoId) {
    const medicos = await context.entities.User.findMany({
      where: { isMedico: true, isActive: true },
      take: 10,
    });
    if (medicos.length === 0) {
      throw new HttpError(
        409,
        "No hay médicos activos disponibles en el sistema para la emergencia",
      );
    }
    medicoId = medicos[0].id;
  } else {
    const m = await context.entities.User.findUnique({ where: { id: medicoId } });
    if (!m || !m.isMedico || !m.isActive) {
      throw new HttpError(404, "El médico seleccionado no está activo o disponible");
    }
  }

  // 2. Generar identificador sintético PAC-NNN
  const existingPatients = await context.entities.SyntheticPatient.findMany({
    where: { syntheticId: { startsWith: "PAC-" } },
    select: { syntheticId: true },
  });
  const nums = existingPatients.map((e: { syntheticId: string }) => {
    const match = /^PAC-(\d+)$/.exec(e.syntheticId);
    return match ? parseInt(match[1], 10) : 0;
  });
  const nextNum = (nums.length ? Math.max(...nums) : 0) + 1;
  const syntheticId = "PAC-" + String(nextNum).padStart(3, "0");

  const birthDate = args.birthDate ?? new Date("1990-01-01T00:00:00.000Z");

  // 3. Crear Paciente Sintético Express
  const patient = await context.entities.SyntheticPatient.create({
    data: {
      syntheticId,
      firstName: args.firstName.trim(),
      lastName: args.lastName.trim(),
      sex: args.sex,
      birthDate,
      documento: args.documento?.trim()
        ? args.documento.trim().slice(0, 10)
        : null,
      medicalHistory: "Ingreso por Cita de Emergencia.",
    },
  });

  // 4. Asignación inmediata MedicoPatientAccess
  await context.entities.MedicoPatientAccess.upsert({
    where: {
      medicoId_patientId: {
        medicoId,
        patientId: patient.id,
      },
    },
    create: {
      medicoId,
      patientId: patient.id,
      grantedById: user.id,
    },
    update: {},
  });

  // 5. Crear Cita Inmediata (SCHEDULED)
  const scheduledAt = new Date();
  const cita = await context.entities.Cita.create({
    data: {
      patientId: patient.id,
      medicoId,
      scheduledAt,
      durationMinutes: 30,
      status: "SCHEDULED",
      reason: args.motivoConsulta?.trim() || "🚨 Atención de Emergencia",
    },
    include: {
      medico: { select: { id: true, fullName: true, email: true } },
      patient: {
        select: { id: true, firstName: true, lastName: true, syntheticId: true },
      },
    },
  });

  // 6. Registro en Auditoría (RNF-002)
  await createAuditEntry({
    userId: user.id,
    action: "ADMIN_MANAGE_DATA",
    resourceType: "CITA",
    resourceId: cita.id,
    patientId: patient.id,
    citaId: cita.id,
    metadata: {
      adminAction: "CREATE_EMERGENCY_ASSIGNMENT",
      medicoId,
      patientId: patient.id,
      syntheticId,
    },
  });

  return { patient, cita };
};

export const adminUpdateMedicoUser: AdminUpdateMedicoUser<
  AdminUpdateMedicoUserInput,
  User
> = async (rawArgs, context) => {
  const user = ensureAdmin(context.user);

  const { id, fullName, specialty, isActive } = ensureArgsSchemaOrThrowHttpError(
    adminUpdateMedicoUserInputSchema,
    rawArgs,
  );

  const target = await context.entities.User.findUnique({ where: { id } });
  if (!target) {
    throw new HttpError(404, "Usuario no encontrado");
  }
  if (target.isAdmin) {
    throw new HttpError(
      400,
      "No se pueden modificar perfiles de usuarios con rol Administrador desde esta sección",
    );
  }

  const updated = await context.entities.User.update({
    where: { id },
    data: {
      fullName: fullName ?? target.fullName,
      specialty: specialty ?? target.specialty,
      ...(typeof isActive === "boolean"
        ? {
            isActive,
            isMedico: isActive ? true : target.isMedico,
          }
        : {}),
    },
  });

  await createAuditEntry({
    userId: user.id,
    action: "ADMIN_MANAGE_USER",
    resourceType: "USER",
    resourceId: id,
    metadata: {
      adminAction:
        typeof isActive === "boolean" && isActive
          ? "REACTIVATE_MEDICO"
          : "UPDATE_MEDICO",
      email: target.email ?? "",
    },
  });

  return updated;
};

// ---------------------------------------------------------------------------
// adminDeleteMedicoUser (Admin) - eliminaciÃ³n de cuenta de mÃ©dico
// Limpia las referencias en cascada antes de borrar el User (FK restrict).
// ---------------------------------------------------------------------------

const adminDeleteMedicoUserInputSchema = z.object({
  id: z.string().min(1),
});

type AdminDeleteMedicoUserInput = z.infer<
  typeof adminDeleteMedicoUserInputSchema
>;

export const adminDeleteMedicoUser: AdminDeleteMedicoUser<
  AdminDeleteMedicoUserInput,
  { success: true }
> = async (rawArgs, context) => {
  const user = ensureAdmin(context.user);

  const { id } = ensureArgsSchemaOrThrowHttpError(
    adminDeleteMedicoUserInputSchema,
    rawArgs,
  );

  if (id === user.id) {
    throw new HttpError(400, "No puedes eliminar tu propia cuenta");
  }

  const target = await context.entities.User.findUnique({ where: { id } });
  if (!target) {
    throw new HttpError(404, "Usuario no encontrado");
  }
  if (!target.isMedico || target.isAdmin) {
    throw new HttpError(
      400,
      "Solo se pueden eliminar cuentas con rol MÃ©dico",
    );
  }

  // Eliminar accesos paciente-médico activos asociados
  await context.entities.MedicoPatientAccess.deleteMany({
    where: { medicoId: id },
  });

  // R4 (soft delete): Se desactiva y se retira el rol médico para preservar notas, epicrisis y auditoría.
  const deactivated = await context.entities.User.update({
    where: { id },
    data: { isActive: false, isMedico: false },
  });

  await createAuditEntry({
    userId: user.id,
    action: "ADMIN_MANAGE_USER",
    resourceType: "USER",
    resourceId: id,
    metadata: {
      adminAction: "DELETE_MEDICO",
      email: deactivated.email ?? "",
    },
  });

  return { success: true };
};

// ---------------------------------------------------------------------------
// manageCita (Admin) - CRUD de citas de agenda
// ---------------------------------------------------------------------------

const manageCitaInputSchema = z.object({
  action: z.enum(["CREATE", "UPDATE", "DELETE"]),
  citaId: z.string().optional(),
  data: z
    .object({
      medicoId: z.string().min(1).optional(),
      patientId: z.string().min(1).optional(),
      scheduledAt: z.coerce.date().optional(),
      durationMinutes: z.number().int().min(5).max(240).optional(),
      status: z.string().optional(),
      reason: z.string().max(500).nullable().optional(),
    })
    .optional(),
});

type ManageCitaInput = z.infer<typeof manageCitaInputSchema>;

const CITA_STATUS_OPTIONS = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

async function resolveMedicoName(
  context: any,
  medicoId: string | null | undefined,
): Promise<string | null> {
  if (!medicoId) return null;
  const m = await context.entities.User.findUnique({
    where: { id: medicoId },
    select: { fullName: true },
  });
  return m?.fullName ?? null;
}

export const manageCita: ManageCita<ManageCitaInput, Cita> = async (
  rawArgs,
  context,
) => {
  // Secretaria administra la agenda junto al admin (crear/reprogramar/cancelar).
  const user = ensureRole(context.user, "admin", "secretaria");

  const { action, citaId, data } = ensureArgsSchemaOrThrowHttpError(
    manageCitaInputSchema,
    rawArgs,
  );

  if (data?.medicoId) {
    const medico = await context.entities.User.findUnique({
      where: { id: data.medicoId },
    });
    if (!medico || !medico.isMedico || medico.isAdmin) {
      throw new HttpError(
        400,
        "medicoId debe referenciar un usuario con isMedico=true",
      );
    }
  }

  if (data?.patientId) {
    const patient = await context.entities.SyntheticPatient.findUnique({
      where: { id: data.patientId },
    });
    if (!patient) {
      throw new HttpError(404, "Paciente no encontrado");
    }
  }

  // El médico asignado a la cita DEBE tener acceso activo al paciente
  // (MedicoPatientAccess). La secretaria no puede asociar médicos arbitrarios.
  if (data?.medicoId && data?.patientId) {
    const hasAccess = await context.entities.MedicoPatientAccess.findUnique({
      where: {
        medicoId_patientId: {
          medicoId: data.medicoId,
          patientId: data.patientId,
        },
      },
    });
    if (!hasAccess) {
      throw new HttpError(
        403,
        "El médico seleccionado no tiene acceso activo a este paciente",
      );
    }
  }

  if (action === "CREATE") {
    if (!data?.medicoId || !data.patientId || !data.scheduledAt) {
      throw new HttpError(
        400,
        "medicoId, patientId y scheduledAt son obligatorios",
      );
    }
    if (data.scheduledAt.getTime() <= Date.now()) {
      throw new HttpError(
        400,
        "La fecha y hora de la cita no puede ser en el pasado",
      );
    }
    const status = data.status ?? "SCHEDULED";
    if (!isCitaStatusValid(status)) {
      throw new HttpError(400, "Estado de cita invÃ¡lido");
    }
    const citaStatus = status as CitaStatus;
    const startMs = data.scheduledAt.getTime();
    const durMin = data.durationMinutes ?? 30;
    // Disponibilidad centralizada (Fase B3): solo SCHEDULED/IN_PROGRESS bloquean.
    await validateNoOverlap({
      citaDelegate: context.entities.Cita,
      medicoId: data.medicoId,
      scheduledAt: data.scheduledAt,
      durationMinutes: durMin,
    });
    const cita = await context.entities.Cita.create({
      data: {
        medicoId: data.medicoId,
        patientId: data.patientId,
        scheduledAt: data.scheduledAt,
        durationMinutes: data.durationMinutes ?? 30,
        status: citaStatus,
        reason: data.reason ?? undefined,
        secretaryId: user.id,
      },
    });
    await createAuditEntry({
      userId: user.id,
      action: "MANAGE_CITA",
      resourceType: "CITA",
      resourceId: cita.id,
      patientId: cita.patientId,
      citaId: cita.id,
      metadata: {
        action: "CREATE",
        status: cita.status,
        doctorName: await resolveMedicoName(context, cita.medicoId),
      },
    });
    return cita;
  }

  if (!citaId) {
    throw new HttpError(400, "citaId es requerido");
  }

  const existing = await context.entities.Cita.findUnique({
    where: { id: citaId },
  });
  if (!existing) {
    throw new HttpError(404, "Cita no encontrada");
  }

  if (action === "UPDATE") {
    if (
      data?.scheduledAt &&
      data.scheduledAt.getTime() <= Date.now()
    ) {
      throw new HttpError(
        400,
        "La fecha y hora de la cita no puede ser en el pasado",
      );
    }
    const targetStatus = data?.status ?? existing.status;
    if (!isCitaStatusValid(targetStatus)) {
      throw new HttpError(400, "Estado de cita invÃ¡lido");
    }
    if (
      targetStatus !== existing.status &&
      !canTransitionCita(existing.status, targetStatus)
    ) {
      throw new HttpError(
        409,
        `TransiciÃ³n no permitida: ${existing.status} â†’ ${targetStatus}`,
      );
    }
    // B1: el enum exige validaciÃ³n explÃ­cita tambiÃ©n en UPDATE administrativo.
    const nextStatus =
      data?.status === undefined
        ? undefined
        : isCitaStatusValid(data.status)
          ? (data.status as CitaStatus)
          : undefined;
    if (data?.status !== undefined && nextStatus === undefined) {
      throw new HttpError(400, "Estado de cita invÃ¡lido");
    }
    // Si se reprograma (horario o duración), revalidar solapamiento contra el
    // médico afectado, ignorando la propia cita.
    if (data?.scheduledAt || data?.durationMinutes !== undefined) {
      await validateNoOverlap({
        citaDelegate: context.entities.Cita,
        medicoId: data?.medicoId ?? existing.medicoId,
        scheduledAt: data?.scheduledAt ?? existing.scheduledAt,
        durationMinutes: data?.durationMinutes ?? existing.durationMinutes,
        excludeCitaId: citaId,
      });
    }

    // Si se reasigna médico o paciente, verificar acceso activo.
    if (data?.medicoId || data?.patientId) {
      const targetMedicoId = data.medicoId ?? existing.medicoId;
      const targetPatientId = data.patientId ?? existing.patientId;
      const hasAccess = await context.entities.MedicoPatientAccess.findUnique({
        where: {
          medicoId_patientId: {
            medicoId: targetMedicoId,
            patientId: targetPatientId,
          },
        },
      });
      if (!hasAccess) {
        throw new HttpError(
          403,
          "El médico seleccionado no tiene acceso activo a este paciente",
        );
      }
    }

    const updated = await context.entities.Cita.update({
      where: { id: citaId },
      data: {
        medicoId: data?.medicoId ?? undefined,
        patientId: data?.patientId ?? undefined,
        scheduledAt: data?.scheduledAt ?? undefined,
        durationMinutes: data?.durationMinutes ?? undefined,
        status: nextStatus,
        reason: data?.reason ?? undefined,
      },
    });
    await createAuditEntry({
      userId: user.id,
      action: "MANAGE_CITA",
      resourceType: "CITA",
      resourceId: updated.id,
      patientId: updated.patientId,
      citaId: updated.id,
      metadata: {
        action: "UPDATE",
        status: updated.status,
        previousStatus: existing.status,
        doctorName: await resolveMedicoName(context, updated.medicoId),
      },
    });
    return updated;
  }

  // DELETE: nunca borrar citas completadas (trazabilidad).
  if (existing.status === "COMPLETED") {
    throw new HttpError(409, "No se puede eliminar una cita completada");
  }

  // Desvincular referencias foráneas para evitar error 500 de clave foránea
  await context.entities.AuditLog.updateMany({
    where: { citaId },
    data: { citaId: null },
  });
  await context.entities.VitalSign.updateMany({
    where: { citaId },
    data: { citaId: null },
  });
  await context.entities.PreClinicalRecord.deleteMany({
    where: { citaId },
  });

  await context.entities.Cita.delete({ where: { id: citaId } });
  await createAuditEntry({
    userId: user.id,
    action: "MANAGE_CITA",
    resourceType: "CITA",
    resourceId: citaId,
    patientId: existing.patientId,
    citaId: null,
    metadata: {
      action: "DELETE",
      status: existing.status,
      doctorName: await resolveMedicoName(context, existing.medicoId),
    },
  });
  return existing;
};

// ---------------------------------------------------------------------------
// updateCitaStatus (MÃ©dico de la cita o Admin) - transiciÃ³n de estado
// ---------------------------------------------------------------------------

const updateCitaStatusInputSchema = z.object({
  citaId: z.string().min(1),
  status: z.string().min(1),
});

type UpdateCitaStatusInput = z.infer<typeof updateCitaStatusInputSchema>;

export const updateCitaStatus: UpdateCitaStatus<
  UpdateCitaStatusInput,
  Cita
> = async (rawArgs, context) => {
  // R2: getActiveClinicalRole + chequeo manual de inactividad (roles con
  // permisos diferenciados por estado destino, no un ensureRole simple).
  const authUser = context.user;
  if (!authUser) {
    throw new HttpError(401, "Debe iniciar sesión");
  }
  if ((authUser as any).isActive === false) {
    throw new HttpError(403, "Usuario inactivo. Contacte al administrador.");
  }
  const role = getActiveClinicalRole(authUser);
  if (!role) {
    throw new HttpError(403, "Rol inválido");
  }

  const { citaId, status } = ensureArgsSchemaOrThrowHttpError(
    updateCitaStatusInputSchema,
    rawArgs,
  );

  if (!isCitaStatusValid(status)) {
    throw new HttpError(400, "Estado de cita inválido");
  }

  const cita = await context.entities.Cita.findUnique({
    where: { id: citaId },
  });
  if (!cita) {
    throw new HttpError(404, "Cita no encontrada");
  }

  const isOwnerMedico =
    role === "medico" && cita.medicoId === authUser.id;
  if (!isOwnerMedico && role === "medico") {
    throw new HttpError(403, "Solo puede operar sobre sus propias citas");
  }

  // Matriz por rol: la secretaria solo maneja estados administrativos.
  const SECRETARIA_TARGETS = [
    "CANCELLED",
    "NO_SHOW",
    "NOT_STARTED",
    "IN_PROGRESS",
  ];
  if (
    role === "secretaria" &&
    !SECRETARIA_TARGETS.includes(status)
  ) {
    throw new HttpError(
      403,
      "La secretaría solo puede cancelar citas o marcar NO_SHOW / NO iniciadas",
    );
  }

  if (status !== cita.status && !canTransitionCita(cita.status, status)) {
    throw new HttpError(
      409,
      `Transición no permitida: ${cita.status} → ${status}`,
    );
  }

  // Validaciones temporales (kickoff Semana 6)
  const nowMs = Date.now();
  if (status === "NO_SHOW" && cita.scheduledAt.getTime() > nowMs) {
    throw new HttpError(
      400,
      "No se puede marcar NO_SHOW antes de la hora de la cita",
    );
  }
  if (status === "NOT_STARTED" && cita.scheduledAt.getTime() > nowMs) {
    throw new HttpError(
      400,
      "Solo una cita vencida puede marcarse como no iniciada",
    );
  }
  if (
    status === "IN_PROGRESS" &&
    cita.scheduledAt.getTime() > nowMs + 5 * 60_000
  ) {
    throw new HttpError(409, "La cita aún no comienza");
  }

  const updated = await context.entities.Cita.update({
    where: { id: citaId },
    data: { status: status as CitaStatus },
  });

  // Auditoría semántica por transición
  const auditActionByStatus: Record<string, AuditAction> = {
    IN_PROGRESS: "START_APPOINTMENT",
    CANCELLED: "CANCEL_APPOINTMENT",
    NO_SHOW: "MARK_NO_SHOW",
  };
  await createAuditEntry({
    userId: authUser.id,
    action: auditActionByStatus[updated.status] ?? "MANAGE_CITA",
    resourceType: "CITA",
    resourceId: updated.id,
    patientId: updated.patientId,
    citaId: updated.id,
    metadata: {
      action: "STATUS",
      phase: role.toUpperCase(),
      status: updated.status,
      previousStatus: cita.status,
      doctorName: await resolveMedicoName(context, cita.medicoId),
    },
  });

  return updated;
};

// ---------------------------------------------------------------------------
// createNoteFromVoice (MÃ©dico) - creaciÃ³n de notas por voz
// ---------------------------------------------------------------------------

const createNoteFromVoiceInputSchema = z.object({
  query: z.string().min(1),
});

type CreateNoteFromVoiceInput = z.infer<typeof createNoteFromVoiceInputSchema>;

type CreateNoteFromVoiceOutput =
  | VoiceAssistantResponse
  | {
      actionType: "NOTE_CREATED";
      noteId: string;
      patientId: string;
      patientName: string;
      syntheticId: string;
    };

const toVoicePatientMatch = (patient: SyntheticPatient): VoicePatientMatch => ({
  id: patient.id,
  syntheticId: patient.syntheticId,
  firstName: patient.firstName,
  lastName: patient.lastName,
  birthDate: patient.birthDate,
  sex: patient.sex,
  medicalHistory: patient.medicalHistory,
  allergies: patient.allergies,
});

export const createNoteFromVoice: CreateNoteFromVoice<
  CreateNoteFromVoiceInput,
  CreateNoteFromVoiceOutput
> = async (rawArgs, context) => {
  const user = ensureMedico(context.user);

  const { query } = ensureArgsSchemaOrThrowHttpError(
    createNoteFromVoiceInputSchema,
    rawArgs,
  );

  const command = parseVoiceCommand(query);

  // Solo pacientes autorizados para este mÃ©dico.
  const authorizedPatients = await context.entities.SyntheticPatient.findMany({
    where: { authorizedMedicos: { some: { medicoId: user.id } } },
  });

  const patients = authorizedPatients.map(toVoicePatientMatch);

  if (command.intent === "RETRIEVE") {
    const match = resolvePatientByName(patients, command.patientQuery);

    await createAuditEntry({
      userId: user.id,
      action: "VOICE_ASSISTANT_QUERY",
      resourceType: "PATIENT",
      resourceId: match?.id ?? null,
      patientId: match?.id ?? null,
      metadata: {
        queryLength: String(query.length),
        matched: String(!!match),
      },
    });

    if (!match) {
      return buildVoiceError(query, "NOT_FOUND");
    }
    return buildVoiceSummary(query, match);
  }

  // intent === 'CREATE_NOTE'
  if (!command.patientQuery) {
    throw new HttpError(
      400,
      "No detectÃ© a quÃ© paciente corresponde la nota. Repite indicando el syntheticId o el nombre completo (ej. \u201cagrega una nota a PAC-001 que presenta fiebre\u201d).",
    );
  }

  const matches = resolvePatientMatches(patients, command.patientQuery);
  if (matches.length === 0) {
    throw new HttpError(404, "No encontrÃ© ningÃºn paciente autorizado con ese nombre o ID.");
  }
  if (matches.length > 1) {
    const names = matches
      .map((m) => `${m.firstName} ${m.lastName} (${m.syntheticId})`)
      .join(", ");
    throw new HttpError(
      409,
      `EncontrÃ© ${matches.length} pacientes con ese nombre: ${names}. Repite indicando el syntheticId exacto para no equivocarme de paciente.`,
    );
  }

  const qualified = await context.entities.SyntheticPatient.findUnique({
    where: { id: matches[0].id },
  });
  if (!qualified) {
    throw new HttpError(404, "Paciente no encontrado.");
  }

  const clinicalText =
    command.clinicalText ||
    "Nota clínica iniciada por voz. Pendiente de dictado clínico y estructuración con IA.";

  const created = await createClinicalNote(
    { patientId: qualified.id, originalText: clinicalText },
    context,
  );

  await createAuditEntry({
    userId: user.id,
    action: "VOICE_NOTE_CREATE",
    resourceType: "NOTE",
    resourceId: created.id,
    patientId: qualified.id,
    metadata: {
      phase: "MEDICO",
      status: created.status,
      patientMatchedBy: /^pac-\d+$/i.test(command.patientQuery) ? "pac" : "name",
    },
  });

  return {
    actionType: "NOTE_CREATED",
    noteId: created.id,
    patientId: qualified.id,
    patientName: `${qualified.firstName} ${qualified.lastName}`.trim(),
    syntheticId: qualified.syntheticId,
  };
};

// ---------------------------------------------------------------------------
// deleteClinicalNote (MÃ©dico) - eliminar nota no confirmada
// ---------------------------------------------------------------------------

const deleteClinicalNoteInputSchema = z.object({
  noteId: z.string().min(1),
});

type DeleteClinicalNoteInput = z.infer<typeof deleteClinicalNoteInputSchema>;

// Solo se pueden eliminar NOTAS NO confirmadas (RF-028 conserva lo confirmado).
// Verificaciones previas: autor (o acceso con contrato), sin adendas hijas.
export const deleteClinicalNote: DeleteClinicalNote<
  DeleteClinicalNoteInput,
  { ok: true }
> = async (rawArgs, context) => {
  const user = ensureMedico(context.user);

  const { noteId } = ensureArgsSchemaOrThrowHttpError(
    deleteClinicalNoteInputSchema,
    rawArgs,
  );

  const note = await context.entities.ClinicalNote.findUnique({
    where: { id: noteId },
    include: { childNotes: { select: { id: true } } },
  });
  if (!note) {
    throw new HttpError(404, "Nota no encontrada");
  }
  if (note.authorId !== user.id) {
    throw new HttpError(403, "Solo el autor puede eliminar esta nota");
  }
  await assertMedicoPatientAccess(user.id, note.patientId);

  if (note.status === "CONFIRMED") {
    throw new HttpError(
      409,
      "Registro confirmado: no se puede eliminar (RF-028). Solo se permite crear adenda.",
    );
  }
  if (note.childNotes.length > 0) {
    throw new HttpError(
      409,
      "La nota tiene adendas asociadas; no se puede eliminar.",
    );
  }

  // Limpia la trazabilidad propia de la nota (borradores/ediciones) para no
  // romper la FK, y deja un registro de la eliminaciÃ³n sin referencia a la nota.
  await context.entities.AuditLog.deleteMany({
    where: { clinicalNoteId: note.id },
  });
  await context.entities.ClinicalNote.delete({ where: { id: note.id } });

  await createAuditEntry({
    userId: user.id,
    action: "DELETE_NOTE",
    resourceType: "NOTE",
    resourceId: note.id,
    patientId: note.patientId,
    metadata: { status: note.status, noteType: note.noteType },
  });

  return { ok: true };
};

// ---------------------------------------------------------------------------
// recordEpicrisisExport (solo auditorÃ­a: EXPORT_EPICRISIS_PDF, RF-019)
// El PDF se genera Ã­ntegramente en el cliente (@react-pdf/renderer); el
// servidor Ãºnicamente registra la acciÃ³n y verifica acceso (R-10).
// ---------------------------------------------------------------------------

const recordEpicrisisExportInputSchema = z.object({
  epicrisisId: z.string().min(1),
});

type RecordEpicrisisExportInput = z.infer<
  typeof recordEpicrisisExportInputSchema
>;

export const recordEpicrisisExport: RecordEpicrisisExport<
  RecordEpicrisisExportInput,
  { ok: boolean }
> = async (rawArgs, context) => {
  const user = ensureMedico(context.user);

  const { epicrisisId } = ensureArgsSchemaOrThrowHttpError(
    recordEpicrisisExportInputSchema,
    rawArgs,
  );

  const epicrisis = await context.entities.Epicrisis.findUnique({
    where: { id: epicrisisId },
    select: { id: true, patientId: true, status: true },
  });
  if (!epicrisis) {
    throw new HttpError(404, "Epicrisis no encontrada");
  }
  await assertMedicoPatientAccess(user.id, epicrisis.patientId);

  // AuditorÃ­a sin contenido clÃ­nico (RNF-002): solo referencia y estado.
  await createAuditEntry({
    userId: user.id,
    action: "EXPORT_EPICRISIS_PDF",
    resourceType: "EPICRISIS",
    resourceId: epicrisis.id,
    patientId: epicrisis.patientId,
    epicrisisId: epicrisis.id,
    metadata: { status: epicrisis.status },
  });

  return { ok: true };
};

// ---------------------------------------------------------------------------
// updateNoteCIE11 — Asignar clasificación CIE-11 a una nota clínica
// Solo médicos autorizados. Solo en estado DRAFT (antes de confirmar).
// ---------------------------------------------------------------------------

const updateNoteCIE11InputSchema = z.object({
  noteId: z.string().min(1),
  cie11Code: z.string().min(1).max(20),
  cie11Description: z.string().min(1).max(500),
  cie11Uri: z.string().url().optional(),
});

type UpdateNoteCIE11Input = z.infer<typeof updateNoteCIE11InputSchema>;

export const updateNoteCIE11 = async (
  rawArgs: UpdateNoteCIE11Input,
  context: any,
) => {
  const user = ensureMedico(context.user);

  const args = ensureArgsSchemaOrThrowHttpError(
    updateNoteCIE11InputSchema,
    rawArgs,
  );

  const note = await context.entities.ClinicalNote.findUnique({
    where: { id: args.noteId },
    select: { id: true, patientId: true, status: true },
  });
  if (!note) {
    throw new HttpError(404, "Nota clínica no encontrada");
  }

  // Inmutabilidad: solo se puede clasificar en estado DRAFT
  if (note.status !== "DRAFT_MANUAL" && note.status !== "DRAFT_AI_ASSISTED") {
    throw new HttpError(
      409,
      "Solo se puede asignar CIE-11 en notas en borrador (DRAFT). La nota confirmada es inmutable.",
    );
  }

  await assertMedicoPatientAccess(user.id, note.patientId);

  const updated = await context.entities.ClinicalNote.update({
    where: { id: args.noteId },
    data: {
      cie11Code: args.cie11Code,
      cie11Description: args.cie11Description,
      cie11Uri: args.cie11Uri ?? null,
    },
  });

  await createAuditEntry({
    userId: user.id,
    action: "UPDATE_NOTE_CIE11",
    resourceType: "NOTE",
    resourceId: note.id,
    patientId: note.patientId,
    clinicalNoteId: note.id,
    metadata: {
      code: args.cie11Code,
      description: args.cie11Description,
    },
  });

  return updated;
};

// ---------------------------------------------------------------------------
// updateEpicrisisCIE11 — Asignar clasificación CIE-11 a una epicrisis
// Solo médicos autorizados. Solo en estado DRAFT (antes de confirmar).
// ---------------------------------------------------------------------------

const updateEpicrisisCIE11InputSchema = z.object({
  epicrisisId: z.string().min(1),
  cie11Code: z.string().min(1).max(20),
  cie11Description: z.string().min(1).max(500),
  cie11Uri: z.string().url().optional(),
});

type UpdateEpicrisisCIE11Input = z.infer<typeof updateEpicrisisCIE11InputSchema>;

export const updateEpicrisisCIE11 = async (
  rawArgs: UpdateEpicrisisCIE11Input,
  context: any,
) => {
  const user = ensureMedico(context.user);

  const args = ensureArgsSchemaOrThrowHttpError(
    updateEpicrisisCIE11InputSchema,
    rawArgs,
  );

  const epicrisis = await context.entities.Epicrisis.findUnique({
    where: { id: args.epicrisisId },
    select: { id: true, patientId: true, status: true },
  });
  if (!epicrisis) {
    throw new HttpError(404, "Epicrisis no encontrada");
  }

  // Inmutabilidad: solo se puede clasificar en estado DRAFT
  if (
    epicrisis.status !== "DRAFT_AI_ASSISTED" &&
    epicrisis.status !== "REVIEWED"
  ) {
    throw new HttpError(
      409,
      "Solo se puede asignar CIE-11 en epicrisis en borrador. La epicrisis confirmada es inmutable.",
    );
  }

  await assertMedicoPatientAccess(user.id, epicrisis.patientId);

  const updated = await context.entities.Epicrisis.update({
    where: { id: args.epicrisisId },
    data: {
      cie11Code: args.cie11Code,
      cie11Description: args.cie11Description,
      cie11Uri: args.cie11Uri ?? null,
    },
  });

  await createAuditEntry({
    userId: user.id,
    action: "UPDATE_EPICRISIS_CIE11",
    resourceType: "EPICRISIS",
    resourceId: epicrisis.id,
    patientId: epicrisis.patientId,
    epicrisisId: epicrisis.id,
    metadata: {
      code: args.cie11Code,
      description: args.cie11Description,
    },
  });

  return updated;
};
