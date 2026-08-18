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
  type Epicrisis,
  type MedicoPatientAccess,
  type SyntheticPatient,
  type User,
} from "wasp/entities";
import type {
  AdminCreateMedicoUser,
  AdminUpdateMedicoUser,
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
  ManageMedicoPatientAccess,
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
      )}. Complételas o márquelas como "No aplica" con justificación.`,
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
    medicalHistory: z.string().nullable().optional(),
    allergies: z.string().nullable().optional(),
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
    if (
      !data.syntheticId ||
      !data.firstName ||
      !data.lastName ||
      !data.birthDate ||
      !data.sex
    ) {
      throw new HttpError(400, "Campos obligatorios incompletos");
    }
    const existing = await context.entities.SyntheticPatient.findUnique({
      where: { syntheticId: data.syntheticId },
    });
    if (existing) {
      throw new HttpError(
        409,
        "Ya existe un paciente con ese identificador sintético",
      );
    }
    const patient = await context.entities.SyntheticPatient.create({
      data: {
        syntheticId: data.syntheticId,
        firstName: data.firstName,
        lastName: data.lastName,
        birthDate: data.birthDate,
        sex: data.sex,
        medicalHistory: data.medicalHistory ?? undefined,
        allergies: data.allergies ?? undefined,
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
        medicalHistory: data.medicalHistory ?? undefined,
        allergies: data.allergies ?? undefined,
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
  await context.entities.ClinicalNote.deleteMany({ where: { patientId } });
  await context.entities.Epicrisis.deleteMany({ where: { patientId } });
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
