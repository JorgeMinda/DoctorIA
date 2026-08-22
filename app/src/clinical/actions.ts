// Acciones (Actions) del módulo clínico.
// contracts/clinical-operations.md §2, §3, §5.

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
} from "wasp/entities";
import type {
  AdminCreateMedicoUser,
  AdminUpdateMedicoUser,
  AdminDeleteMedicoUser,
  CreateClinicalNote,
  UpdateClinicalNoteDraft,
  RequestAIStructuring,
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
} from "wasp/server/operations";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { ensureMedico, ensureAdmin } from "./services/guards";
import { assertMedicoPatientAccess } from "./services/patientAccess";
import { createAuditEntry } from "./services/audit";
import {
  structureClinicalText,
  generateEpicrisisFromHistory,
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

  // originalText NUNCA se modifica vía esta operación (RNF-004)
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
});

type RequestAIStructuringInput = z.infer<
  typeof requestAIStructuringInputSchema
>;

export const requestAIStructuring: RequestAIStructuring<
  RequestAIStructuringInput,
  ClinicalNote
> = async (rawArgs, context) => {
  const user = ensureMedico(context.user);

  const { noteId } = ensureArgsSchemaOrThrowHttpError(
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

  let result;
  try {
    result = await structureClinicalText({
      text: note.originalText,
      mode: "NOTE",
    });
  } catch (err: any) {
    // RNF-008: falla de IA -> la nota permanece en DRAFT_MANUAL, texto intacto
    throw new HttpError(
      504,
      err?.message ?? "El servicio de IA no está disponible",
    );
  }

  const updated = await context.entities.ClinicalNote.update({
    where: { id: note.id },
    data: {
      status: "DRAFT_AI_ASSISTED",
      aiAssisted: true,
      aiRawResponse: JSON.stringify(result).slice(0, 8000),
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
    action: "REQUEST_AI_STRUCTURING",
    resourceType: "NOTE",
    resourceId: note.id,
    patientId: note.patientId,
    clinicalNoteId: note.id,
    metadata: { status: "DRAFT_AI_ASSISTED" },
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
    throw new HttpError(409, "La nota ya está confirmada");
  }

  // RF-026: verificación acumulativa
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
      )}. Complételas o márquelas como "No aplica".`,
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

  // Validación: el paciente debe tener al menos una nota CONFIRMED
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
  } catch (err: any) {
    throw new HttpError(
      504,
      err?.message ?? "El servicio de IA no está disponible",
    );
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
    throw new HttpError(409, "La epicrisis ya está confirmada");
  }
  if (
    epicrisis.status !== "DRAFT_AI_ASSISTED" &&
    epicrisis.status !== "REVIEWED"
  ) {
    throw new HttpError(409, "Estado inválido para confirmar");
  }

  // Validación RF-018: elementos obligatorios
  const missing: string[] = [];
  if (!epicrisis.patientIdentification)
    missing.push("Identificación del paciente");
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
  action: z.enum(["CREATE", "UPDATE", "DELETE"]),
  data: z.object({
    syntheticId: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    birthDate: z.coerce.date().optional(),
    sex: z.string().optional(),
    documento: z.string().max(10, "Máximo 10 caracteres").nullable().optional(),
    medicalHistory: z.string().nullable().optional(),
    allergies: z.string().nullable().optional(),
    nationality: z.string().nullable().optional(),
    heightCm: z.number().int().min(1).max(300).nullable().optional(),
    weightKg: z.number().int().min(1).max(500).nullable().optional(),
    ethnicity: z.string().nullable().optional(),
    bloodType: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    emergencyName: z.string().max(200).nullable().optional(),
    emergencyPhone: z.string().nullable().optional(),
    insurance: z.string().nullable().optional(),
  }),
  patientId: z.string().optional(),
});

type ManageSyntheticPatientsInput = z.infer<
  typeof manageSyntheticPatientsInputSchema
>;

export const manageSyntheticPatients: ManageSyntheticPatients<
  ManageSyntheticPatientsInput,
  SyntheticPatient | { success: true }
> = async (rawArgs, context) => {
  const user = ensureAdmin(context.user);

  const args = ensureArgsSchemaOrThrowHttpError(
    manageSyntheticPatientsInputSchema,
    rawArgs,
  );

  const { action, data, patientId } = args;

  if (action === "CREATE") {
    if (!data.firstName || !data.lastName || !data.birthDate || !data.sex) {
      throw new HttpError(400, "Campos obligatorios incompletos");
    }

    let syntheticId = data.syntheticId?.trim();
    if (syntheticId) {
      if (!/^PAC-\d{1,6}$/.test(syntheticId)) {
        throw new HttpError(
          400,
          "El identificador sintético debe tener el formato PAC-NNN",
        );
      }
      const existing = await context.entities.SyntheticPatient.findUnique({
        where: { syntheticId },
      });
      if (existing) {
        throw new HttpError(
          409,
          "Ya existe un paciente con ese identificador sintético",
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

  // DELETE: no borrar pacientes con notas confirmadas
  const confirmedCount = await context.entities.ClinicalNote.count({
    where: { patientId, status: "CONFIRMED" },
  });
  if (confirmedCount > 0) {
    throw new HttpError(
      409,
      "No se puede eliminar un paciente con notas confirmadas",
    );
  }
  await context.entities.MedicoPatientAccess.deleteMany({
    where: { patientId },
  });
  await context.entities.Cita.deleteMany({ where: { patientId } });
  await context.entities.ClinicalNote.deleteMany({ where: { patientId } });
  await context.entities.Epicrisis.deleteMany({ where: { patientId } });
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
  const user = ensureAdmin(context.user);

  const { action, medicoId, patientId } = ensureArgsSchemaOrThrowHttpError(
    manageMedicoPatientAccessInputSchema,
    rawArgs,
  );

  const medico = await context.entities.User.findUnique({
    where: { id: medicoId },
  });
  if (!medico || !medico.isMedico || medico.isAdmin) {
    throw new HttpError(
      400,
      "medicoId debe referenciar un usuario con isMedico=true",
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
      throw new HttpError(409, "El médico ya tiene acceso a este paciente");
    }
    const access = await context.entities.MedicoPatientAccess.create({
      data: { medicoId, patientId, grantedById: user.id },
    });
    await createAuditEntry({
      userId: user.id,
      action: "ADMIN_MANAGE_DATA",
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
    throw new HttpError(409, "El médico no tiene acceso a este paciente");
  }
  await context.entities.MedicoPatientAccess.delete({
    where: { id: existing.id },
  });
  await createAuditEntry({
    userId: user.id,
    action: "ADMIN_MANAGE_DATA",
    resourceType: "PATIENT",
    resourceId: patientId,
    patientId,
    metadata: { accessAction: "REVOKE", medicoId },
  });
  return { success: true };
};

// ---------------------------------------------------------------------------
// adminCreateMedicoUser (Admin) - alta de usuario con rol Médico
// ---------------------------------------------------------------------------

const adminCreateMedicoUserInputSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(/[A-Z]/, "La contraseña debe incluir al menos una mayúscula")
    .regex(/[0-9]/, "La contraseña debe incluir al menos un número"),
  fullName: z.string().min(1).optional(),
  specialty: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
});

type AdminCreateMedicoUserInput = z.infer<
  typeof adminCreateMedicoUserInputSchema
>;

export const adminCreateMedicoUser: AdminCreateMedicoUser<
  AdminCreateMedicoUserInput,
  User
> = async (rawArgs, context) => {
  const user = ensureAdmin(context.user);

  const { email, password, fullName, specialty, username } =
    ensureArgsSchemaOrThrowHttpError(adminCreateMedicoUserInputSchema, rawArgs);

  const existingUser = await context.entities.User.findUnique({
    where: { email },
  });
  if (existingUser) {
    throw new HttpError(409, "Ya existe un usuario con ese correo");
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
      specialty: specialty ?? null,
      isMedico: true,
      isAdmin: false,
    },
  );

  await createAuditEntry({
    userId: user.id,
    action: "ADMIN_MANAGE_USER",
    resourceType: "USER",
    resourceId: created.id,
    metadata: { adminAction: "CREATE_MEDICO", email },
  });

  return created;
};

// ---------------------------------------------------------------------------
// adminUpdateMedicoUser (Admin) - edición de campos permitidos del perfil médico
// ---------------------------------------------------------------------------

const adminUpdateMedicoUserInputSchema = z.object({
  id: z.string().min(1),
  fullName: z.string().min(1).optional(),
  specialty: z.string().min(1).optional(),
});

type AdminUpdateMedicoUserInput = z.infer<
  typeof adminUpdateMedicoUserInputSchema
>;

export const adminUpdateMedicoUser: AdminUpdateMedicoUser<
  AdminUpdateMedicoUserInput,
  User
> = async (rawArgs, context) => {
  const user = ensureAdmin(context.user);

  const { id, fullName, specialty } = ensureArgsSchemaOrThrowHttpError(
    adminUpdateMedicoUserInputSchema,
    rawArgs,
  );

  const target = await context.entities.User.findUnique({ where: { id } });
  if (!target) {
    throw new HttpError(404, "Usuario no encontrado");
  }
  if (!target.isMedico || target.isAdmin) {
    throw new HttpError(
      400,
      "Solo se pueden editar perfiles de usuarios con rol Médico",
    );
  }

  const updated = await context.entities.User.update({
    where: { id },
    data: {
      fullName: fullName ?? target.fullName,
      specialty: specialty ?? target.specialty,
    },
  });

  await createAuditEntry({
    userId: user.id,
    action: "ADMIN_MANAGE_USER",
    resourceType: "USER",
    resourceId: id,
    metadata: { adminAction: "UPDATE_MEDICO", email: target.email ?? "" },
  });

  return updated;
};

// ---------------------------------------------------------------------------
// adminDeleteMedicoUser (Admin) - eliminación de cuenta de médico
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
      "Solo se pueden eliminar cuentas con rol Médico",
    );
  }

  // Limpieza de referencias (FK restrict por defecto en Prisma).
  await context.entities.MedicoPatientAccess.deleteMany({
    where: { medicoId: id },
  });
  await context.entities.Cita.deleteMany({ where: { medicoId: id } });
  await context.entities.ClinicalNote.deleteMany({ where: { authorId: id } });
  await context.entities.Epicrisis.deleteMany({ where: { authorId: id } });
  await context.entities.AuditLog.deleteMany({ where: { userId: id } });

  await context.entities.User.delete({ where: { id } });

  await createAuditEntry({
    userId: user.id,
    action: "ADMIN_MANAGE_USER",
    resourceType: "USER",
    resourceId: id,
    metadata: { adminAction: "DELETE_MEDICO", email: target.email ?? "" },
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

export const manageCita: ManageCita<ManageCitaInput, Cita> = async (
  rawArgs,
  context,
) => {
  const user = ensureAdmin(context.user);

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
      throw new HttpError(400, "Estado de cita inválido");
    }
    const startMs = data.scheduledAt.getTime();
    const durMin = data.durationMinutes ?? 30;
    const endMs = startMs + durMin * 60_000;
    const overlapWindowStart = new Date(startMs - 240 * 60_000);
    const overlapping = await context.entities.Cita.findMany({
      where: {
        medicoId: data.medicoId,
        status: { not: "CANCELLED" },
        scheduledAt: { gte: overlapWindowStart, lt: new Date(endMs) },
      },
      select: { scheduledAt: true, durationMinutes: true },
    });
    const conflicto = overlapping.some((c) => {
      const cStart = c.scheduledAt.getTime();
      const cEnd = cStart + c.durationMinutes * 60_000;
      return cStart < endMs && cEnd > startMs;
    });
    if (conflicto) {
      throw new HttpError(
        409,
        "El horario seleccionado no está disponible para este médico",
      );
    }
    const cita = await context.entities.Cita.create({
      data: {
        medicoId: data.medicoId,
        patientId: data.patientId,
        scheduledAt: data.scheduledAt,
        durationMinutes: data.durationMinutes ?? 30,
        status,
        reason: data.reason ?? undefined,
      },
    });
    await createAuditEntry({
      userId: user.id,
      action: "MANAGE_CITA",
      resourceType: "CITA",
      resourceId: cita.id,
      patientId: cita.patientId,
      citaId: cita.id,
      metadata: { action: "CREATE", status: cita.status },
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
      throw new HttpError(400, "Estado de cita inválido");
    }
    if (
      targetStatus !== existing.status &&
      !canTransitionCita(existing.status, targetStatus)
    ) {
      throw new HttpError(
        409,
        `Transición no permitida: ${existing.status} → ${targetStatus}`,
      );
    }
    const updated = await context.entities.Cita.update({
      where: { id: citaId },
      data: {
        medicoId: data?.medicoId ?? undefined,
        patientId: data?.patientId ?? undefined,
        scheduledAt: data?.scheduledAt ?? undefined,
        durationMinutes: data?.durationMinutes ?? undefined,
        status: data?.status ?? undefined,
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
      },
    });
    return updated;
  }

  // DELETE: nunca borrar citas completadas (trazabilidad).
  if (existing.status === "COMPLETED") {
    throw new HttpError(409, "No se puede eliminar una cita completada");
  }
  await context.entities.Cita.delete({ where: { id: citaId } });
  await createAuditEntry({
    userId: user.id,
    action: "MANAGE_CITA",
    resourceType: "CITA",
    resourceId: citaId,
    patientId: existing.patientId,
    citaId,
    metadata: { action: "DELETE", status: existing.status },
  });
  return existing;
};

// ---------------------------------------------------------------------------
// updateCitaStatus (Médico de la cita o Admin) - transición de estado
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
  const authUser = context.user;
  if (!authUser) {
    throw new HttpError(401, "Debe iniciar sesión");
  }
  const isAdmin = authUser.isAdmin && !authUser.isMedico;
  const isMedico = authUser.isMedico && !authUser.isAdmin;
  if (!isMedico && !isAdmin) {
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

  if (isMedico && cita.medicoId !== authUser.id) {
    throw new HttpError(403, "Solo puede operar sobre sus propias citas");
  }

  if (status !== cita.status && !canTransitionCita(cita.status, status)) {
    throw new HttpError(
      409,
      `Transición no permitida: ${cita.status} → ${status}`,
    );
  }

  if (
    status === "IN_PROGRESS" &&
    cita.scheduledAt.getTime() > Date.now() + 5 * 60_000
  ) {
    throw new HttpError(409, "La cita aún no comienza");
  }

  const updated = await context.entities.Cita.update({
    where: { id: citaId },
    data: { status },
  });

  await createAuditEntry({
    userId: authUser.id,
    action: "MANAGE_CITA",
    resourceType: "CITA",
    resourceId: updated.id,
    patientId: updated.patientId,
    citaId: updated.id,
    metadata: {
      action: "STATUS",
      phase: isAdmin ? "ADMIN" : "MEDICO",
      status: updated.status,
      previousStatus: cita.status,
    },
  });

  return updated;
};

// ---------------------------------------------------------------------------
// createNoteFromVoice (Médico) - creación de notas por voz
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

  // Solo pacientes autorizados para este médico.
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
      "No detecté a qué paciente corresponde la nota. Repite indicando el syntheticId o el nombre completo (ej. \u201cagrega una nota a PAC-001 que presenta fiebre\u201d).",
    );
  }

  const matches = resolvePatientMatches(patients, command.patientQuery);
  if (matches.length === 0) {
    throw new HttpError(404, "No encontré ningún paciente autorizado con ese nombre o ID.");
  }
  if (matches.length > 1) {
    const names = matches
      .map((m) => `${m.firstName} ${m.lastName} (${m.syntheticId})`)
      .join(", ");
    throw new HttpError(
      409,
      `Encontré ${matches.length} pacientes con ese nombre: ${names}. Repite indicando el syntheticId exacto para no equivocarme de paciente.`,
    );
  }

  const qualified = await context.entities.SyntheticPatient.findUnique({
    where: { id: matches[0].id },
  });
  if (!qualified) {
    throw new HttpError(404, "Paciente no encontrado.");
  }

  if (!command.clinicalText) {
    throw new HttpError(
      400,
      "No detecté el texto clínico de la nota. Repite indicando el contenido del dictado (ej. \u201canota en la historia de PAC-001 que presenta fiebre de 38 grados\u201d).",
    );
  }

  const created = await createClinicalNote(
    { patientId: qualified.id, originalText: command.clinicalText },
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
// deleteClinicalNote (Médico) - eliminar nota no confirmada
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
  // romper la FK, y deja un registro de la eliminación sin referencia a la nota.
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
