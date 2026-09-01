// Operaciones de consulta (Queries) del módulo clínico.
// contracts/clinical-operations.md Â§1, Â§4.

import { HttpError, prisma } from "wasp/server";
import { type SyntheticPatient } from "wasp/entities";
import type {
  AdminGetPatients,
  GetAgenda,
  GetDoctorsAgenda,
  GetPatients,
  GetPatientById,
  GetPatientHistory,
  GetClinicalNote,
  GetEpicrisis,
  GetAuditLog,
  GetVoiceAssistantResponse,
  GetVitalSigns,
  GetAvailableSlots,
  GetEpicrisisForPrint,
  GetSecretaryAuditLog,
  GetPreClinicalRecord,
  GetPrintableEpicrises,
} from "wasp/server/operations";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import {
  ensureMedico,
  ensureAdmin,
  ensureRole,
  ensureSecretaria,
  ensureSecretariaOrMedico,
  getActiveClinicalRole,
  ensurePatientViewer,
} from "./services/guards";
import { assertMedicoPatientAccess } from "./services/patientAccess";
import { createAuditEntry } from "./services/audit";
import {
  buildVoiceSummary,
  buildVoiceError,
  parseVoiceQuery,
  resolvePatientByName,
  type VoiceAssistantResponse,
  type VoicePatientMatch,
} from "./services/voiceAssistant";
import {
  buildDaySlots,
  filterFreeSlots,
  getOccupiedSlots,
} from "./services/appointmentAvailability";
import {
  searchICD11,
  isConfigured as isICD11Configured,
} from "./services/classification/icd11.service";

// ---------------------------------------------------------------------------
// getPatients
// ---------------------------------------------------------------------------

const getPatientsInputSchema = z.object({
  search: z.string().optional(),
  page: z.number().int().nonnegative().optional(),
  pageSize: z.number().int().positive().max(500).optional(),
});

type GetPatientsInput = z.infer<typeof getPatientsInputSchema>;

type GetPatientsOutput = {
  patients: any[];
  totalPages: number;
};

export const getPatients: GetPatients<
  GetPatientsInput,
  GetPatientsOutput
> = async (rawArgs, context) => {
  const user = ensurePatientViewer(context.user);

  const {
    search,
    page = 1,
    pageSize = 20,
  } = ensureArgsSchemaOrThrowHttpError(getPatientsInputSchema, rawArgs);

  const skip = (page - 1) * pageSize;

  const where: any = {
    isActive: true,
    ...(user.isMedico && !user.isAdmin
      ? { authorizedMedicos: { some: { medicoId: user.id } } }
      : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { syntheticId: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [patients, total] = await Promise.all([
    context.entities.SyntheticPatient.findMany({
      where,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      skip,
      take: pageSize,
      include: {
        authorizedMedicos: {
          select: {
            medicoId: true,
          },
        },
      },
    }),
    context.entities.SyntheticPatient.count({ where }),
  ]);

  return { patients, totalPages: Math.ceil(total / pageSize) };
};

// ---------------------------------------------------------------------------
// getPatientById
// ---------------------------------------------------------------------------

const getPatientByIdInputSchema = z.object({
  patientId: z.string().min(1),
});

type GetPatientByIdInput = z.infer<typeof getPatientByIdInputSchema>;

type PatientNoteSummary = {
  id: string;
  status: string;
  noteType: string;
  createdAt: Date;
  originalText: string;
  author: PersonSummary;
  confirmedBy: PersonSummary | null;
};

type PatientCitaSummary = {
  id: string;
  status: string;
  scheduledAt: Date;
  durationMinutes: number | null;
  reason: string | null;
  createdAt: Date;
};

type GetPatientByIdOutput = {
  patient: SyntheticPatient;
  noteCount: number;
  latestNotes: PatientNoteSummary[];
  epicrisisCount: number;
  citaCount: number;
  latestCitas: PatientCitaSummary[];
};

export const getPatientById: GetPatientById<
  GetPatientByIdInput,
  GetPatientByIdOutput
> = async (rawArgs, context) => {
  const user = ensurePatientViewer(context.user);

  const { patientId } = ensureArgsSchemaOrThrowHttpError(
    getPatientByIdInputSchema,
    rawArgs,
  );

  if (user.isMedico && !user.isAdmin) {
    await assertMedicoPatientAccess(user.id, patientId);
  }

  const patient = await context.entities.SyntheticPatient.findUnique({
    where: { id: patientId },
  });

  if (!patient) {
    throw new HttpError(404, "Paciente no encontrado");
  }

  const authorSelect = { fullName: true, username: true, email: true };

  const [noteCount, latestNotes, epicrisisCount, citaCount, latestCitas] =
    await Promise.all([
      context.entities.ClinicalNote.count({ where: { patientId } }),
      context.entities.ClinicalNote.findMany({
        where: { patientId, noteType: "ORIGINAL" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          noteType: true,
          createdAt: true,
          originalText: true,
          author: { select: authorSelect },
          confirmedBy: { select: authorSelect },
        },
      }),
      context.entities.Epicrisis.count({ where: { patientId } }),
      prisma.cita.count({ where: { patientId } }),
      prisma.cita.findMany({
        where: { patientId },
        orderBy: { scheduledAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          scheduledAt: true,
          durationMinutes: true,
          reason: true,
          createdAt: true,
        },
      }),
    ]);

  // Regla crítica: la secretaria NO recibe contenido de notas (ni siquiera
  // preview). Se devuelve el paciente + citas + conteos, pero sin latestNotes.
  if ((user as any).isSecretaria && !user.isMedico && !user.isAdmin) {
    return {
      patient,
      noteCount,
      latestNotes: [],
      epicrisisCount,
      citaCount,
      latestCitas,
    };
  }

  // Audit VIEW_PATIENT (contracts Â§1)
  await createAuditEntry({
    userId: user.id,
    action: "VIEW_PATIENT",
    resourceType: "PATIENT",
    resourceId: patientId,
    patientId,
  });

  return { patient, noteCount, latestNotes, epicrisisCount, citaCount, latestCitas };
};

// ---------------------------------------------------------------------------
// getPatientHistory
// ---------------------------------------------------------------------------

const getPatientHistoryInputSchema = z.object({
  patientId: z.string().min(1),
  includeAddenda: z.boolean().optional(),
});

type GetPatientHistoryInput = z.infer<typeof getPatientHistoryInputSchema>;

type PersonSummary = {
  fullName: string | null;
  username: string | null;
  email: string | null;
};

type HistoryNote = {
  id: string;
  status: string;
  noteType: string;
  originalText: string;
  addendumReason: string | null;
  createdAt: Date;
  author: PersonSummary;
  confirmedBy: PersonSummary | null;
  childNotes: {
    id: string;
    status: string;
    noteType: string;
    originalText: string;
    addendumReason: string | null;
    createdAt: Date;
    author: PersonSummary;
  }[];
};

type HistoryEpicrisis = {
  id: string;
  status: string;
  noteType: string;
  addendumReason: string | null;
  reasonForAdmission: string | null;
  validatedDiagnoses: string | null;
  responsibleProfessional: string;
  dateTime: Date;
  createdAt: Date;
  author: PersonSummary;
  confirmedBy: PersonSummary | null;
};

type GetPatientHistoryOutput = {
  notes: HistoryNote[];
  epicrises: HistoryEpicrisis[];
};

export const getPatientHistory: GetPatientHistory<
  GetPatientHistoryInput,
  GetPatientHistoryOutput
> = async (rawArgs, context) => {
  const user = ensurePatientViewer(context.user);

  const { patientId, includeAddenda = false } =
    ensureArgsSchemaOrThrowHttpError(getPatientHistoryInputSchema, rawArgs);

  if (user.isMedico && !user.isAdmin) {
    await assertMedicoPatientAccess(user.id, patientId);
  }

  // Regla crítica: la secretaria NUNCA accede a notas ni epicrisis (solo
  // registro pre-clínico). Se devuelve vacío como defensa en profundidad;
  // la UI también oculta estas secciones para el rol secretaria.
  if ((user as any).isSecretaria && !user.isMedico && !user.isAdmin) {
    return { notes: [], epicrises: [] };
  }

  const authorSelect = { fullName: true, username: true, email: true };

  const [notes, epicrises] = await Promise.all([
    context.entities.ClinicalNote.findMany({
      where: {
        patientId,
        ...(includeAddenda ? {} : { parentNoteId: null }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: authorSelect },
        confirmedBy: { select: authorSelect },
        childNotes: {
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: authorSelect },
          },
        },
      },
    }),
    context.entities.Epicrisis.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        noteType: true,
        addendumReason: true,
        reasonForAdmission: true,
        validatedDiagnoses: true,
        responsibleProfessional: true,
        dateTime: true,
        createdAt: true,
        author: { select: authorSelect },
        confirmedBy: { select: authorSelect },
      },
    }),
  ]);

  return {
    notes: notes as HistoryNote[],
    epicrises: epicrises as HistoryEpicrisis[],
  };
};

// ---------------------------------------------------------------------------
// getPreClinicalRecord (Médico / Secretaria) - lectura del registro pre-clínico
// ligado a una cita (1:1). Sin contenido clínico (desacoplado de la historia).
// ---------------------------------------------------------------------------

const getPreClinicalRecordInputSchema = z.object({
  citaId: z.string().min(1),
});

type GetPreClinicalRecordInput = z.infer<
  typeof getPreClinicalRecordInputSchema
>;

export const getPreClinicalRecord: GetPreClinicalRecord<
  GetPreClinicalRecordInput,
  any
> = async (rawArgs, context) => {
  ensureRole(context.user, "admin", "medico", "secretaria");

  const { citaId } = ensureArgsSchemaOrThrowHttpError(
    getPreClinicalRecordInputSchema,
    rawArgs,
  );

  const rec = await context.entities.PreClinicalRecord.findUnique({
    where: { citaId },
  });
  return rec;
};

// ---------------------------------------------------------------------------
// getPrintableEpicrises (Médico / Secretaria) - lista de epicrises CONFIRMED de
// un paciente (solo metadatos id/fecha/tipo) para la acción de impresión. El
// contenido completo se entrega vía getEpicrisisForPrint al imprimir.
// ---------------------------------------------------------------------------

const getPrintableEpicrisesInputSchema = z.object({
  patientId: z.string().min(1),
});

type GetPrintableEpicrisesInput = z.infer<
  typeof getPrintableEpicrisesInputSchema
>;

export const getPrintableEpicrises: GetPrintableEpicrises<
  GetPrintableEpicrisesInput,
  any[]
> = async (rawArgs, context) => {
  // Metadatos (ids/fechas) de epicrises confirmadas para la acción de impresión.
  // Incluye admin (superusuario) para evitar errores de fondo en la vista de
  // detalle; el contenido completo sigue restringido a secretaria||medico.
  ensureRole(context.user, "admin", "medico", "secretaria");

  const { patientId } = ensureArgsSchemaOrThrowHttpError(
    getPrintableEpicrisesInputSchema,
    rawArgs,
  );

  const rows = await context.entities.Epicrisis.findMany({
    where: { patientId, status: "CONFIRMED" },
    orderBy: { dateTime: "desc" },
    select: { id: true, dateTime: true, noteType: true },
  });
  return rows;
};

// ---------------------------------------------------------------------------
// getClinicalNote
// ---------------------------------------------------------------------------

const getClinicalNoteInputSchema = z.object({
  noteId: z.string().min(1),
});

type GetClinicalNoteInput = z.infer<typeof getClinicalNoteInputSchema>;

type ClinicalNoteDetail = {
  id: string;
  patientId: string;
  updatedAt: Date;
  status: string;
  noteType: string;
  originalText: string;
  motivoConsulta: string | null;
  notaClinica: string | null;
  examenFisico: string | null;
  valoracionClinica: string | null;
  planIndicaciones: string | null;
  sectionsNotApplicable: Record<string, string> | null;
  aiAssisted: boolean;
  unclassifiedContent: string | null;
  cie11Code: string | null;
  cie11Description: string | null;
  cie11Uri: string | null;
  addendumReason: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  author: PersonSummary;
  confirmedBy: PersonSummary | null;
  parentNote: HistoryNote | null;
  childNotes: HistoryNote[];
  patient: {
    id: string;
    syntheticId: string;
    firstName: string;
    lastName: string;
  };
};

export const getClinicalNote: GetClinicalNote<
  GetClinicalNoteInput,
  ClinicalNoteDetail
> = async (rawArgs, context) => {
  const user = ensureMedico(context.user);

  const { noteId } = ensureArgsSchemaOrThrowHttpError(
    getClinicalNoteInputSchema,
    rawArgs,
  );

  const note = await context.entities.ClinicalNote.findUnique({
    where: { id: noteId },
    include: {
      author: { select: { fullName: true, username: true, email: true } },
      confirmedBy: { select: { fullName: true, username: true, email: true } },
      parentNote: true,
      childNotes: { orderBy: { createdAt: "asc" } },
      patient: {
        select: {
          id: true,
          syntheticId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!note) {
    throw new HttpError(404, "Nota no encontrada");
  }

  await assertMedicoPatientAccess(user.id, note.patientId);

  return note as unknown as ClinicalNoteDetail;
};

// ---------------------------------------------------------------------------
// getEpicrisis
// ---------------------------------------------------------------------------

const getEpicrisisInputSchema = z.object({
  epicrisisId: z.string().min(1),
});

type GetEpicrisisInput = z.infer<typeof getEpicrisisInputSchema>;

type EpicrisisDetail = {
  id: string;
  patientId: string;
  status: string;
  noteType: string;
  aiAssisted: boolean;
  cie11Code: string | null;
  cie11Description: string | null;
  cie11Uri: string | null;
  addendumReason: string | null;
  patientIdentification: string;
  reasonForAdmission: string | null;
  relevantHistory: string | null;
  evolutionSummary: string | null;
  proceduresResults: string | null;
  validatedDiagnoses: string | null;
  conditionAtDischarge: string | null;
  followUpInstructions: string | null;
  responsibleProfessional: string;
  dateTime: Date;
  confirmedAt: Date | null;
  createdAt: Date;
  author: PersonSummary;
  confirmedBy: PersonSummary | null;
  parentEpicrisis: HistoryNote | null;
  childEpicrises: HistoryNote[];
  patient: {
    id: string;
    syntheticId: string;
    firstName: string;
    lastName: string;
  };
};

export const getEpicrisis: GetEpicrisis<
  GetEpicrisisInput,
  EpicrisisDetail
> = async (rawArgs, context) => {
  const user = ensureMedico(context.user);

  const { epicrisisId } = ensureArgsSchemaOrThrowHttpError(
    getEpicrisisInputSchema,
    rawArgs,
  );

  const epicrisis = await context.entities.Epicrisis.findUnique({
    where: { id: epicrisisId },
    include: {
      author: { select: { fullName: true, username: true, email: true } },
      confirmedBy: { select: { fullName: true, username: true, email: true } },
      parentEpicrisis: true,
      childEpicrises: { orderBy: { createdAt: "asc" } },
      patient: {
        select: {
          id: true,
          syntheticId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!epicrisis) {
    throw new HttpError(404, "Epicrisis no encontrada");
  }

  await assertMedicoPatientAccess(user.id, epicrisis.patientId);

  return epicrisis as unknown as EpicrisisDetail;
};

// ---------------------------------------------------------------------------
// getAuditLog
// ---------------------------------------------------------------------------

const getAuditLogInputSchema = z.object({
  page: z.number().int().nonnegative().optional(),
  resourceType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

type GetAuditLogInput = z.infer<typeof getAuditLogInputSchema>;

type AuditEntryOutput = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  createdAt: Date;
  user: PersonSummary;
};

type GetAuditLogOutput = {
  entries: AuditEntryOutput[];
  totalPages: number;
};

export const getAuditLog: GetAuditLog<
  GetAuditLogInput,
  GetAuditLogOutput
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Debe iniciar sesión");
  }

  const {
    page = 1,
    resourceType,
    dateFrom,
    dateTo,
  } = ensureArgsSchemaOrThrowHttpError(getAuditLogInputSchema, rawArgs);

  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  // Scoping por rol (contracts §4)
  // Admin: ve TODO el registro. Medico: sus notas/epicrisis/pacientes.
  // Secretaria: registro funcional de su ambito (pacientes, citas, epicrisis, usuarios).
  const role = getActiveClinicalRole(context.user);
  let where: any = {};
  if (role === "medico") {
    where = {
      userId: context.user.id,
      resourceType: { in: ["PATIENT", "NOTE", "EPICRISIS"] },
    };
  } else if (role === "admin") {
    where = {};
  } else if (role === "secretaria") {
    where = {
      resourceType: { in: ["PATIENT", "CITA", "EPICRISIS", "USER", "SYSTEM"] },
    };
  } else {
    throw new HttpError(403, "Rol inválido");
  }

  if (resourceType) {
    where.resourceType = resourceType;
  }
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  }

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        user: { select: { fullName: true, username: true, email: true } },
        patient: {
          select: {
            firstName: true,
            lastName: true,
            syntheticId: true,
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    entries,
    totalPages: Math.ceil(total / pageSize),
  } as GetAuditLogOutput;
};

// ---------------------------------------------------------------------------
// getVoiceAssistantResponse
// ---------------------------------------------------------------------------

const getVoiceAssistantResponseInputSchema = z.object({
  query: z.string().min(1),
});

type GetVoiceAssistantResponseInput = z.infer<
  typeof getVoiceAssistantResponseInputSchema
>;

export const getVoiceAssistantResponse: GetVoiceAssistantResponse<
  GetVoiceAssistantResponseInput,
  VoiceAssistantResponse
> = async (rawArgs, context) => {
  const user = ensureMedico(context.user);

  const { query } = ensureArgsSchemaOrThrowHttpError(
    getVoiceAssistantResponseInputSchema,
    rawArgs,
  );

  const { name } = parseVoiceQuery(query);

  // Solo pacientes autorizados para este médico.
  const authorizedPatients = await context.entities.SyntheticPatient.findMany({
    where: { authorizedMedicos: { some: { medicoId: user.id } } },
  });

  const match: VoicePatientMatch | null = resolvePatientByName(
    authorizedPatients as VoicePatientMatch[],
    name,
  );

  // Auditoría (sin contenido clínico en metadata, RNF-002).
  await createAuditEntry({
    userId: user.id,
    action: "VOICE_ASSISTANT_QUERY",
    resourceType: "PATIENT",
    resourceId: match?.id ?? null,
    patientId: match?.id ?? null,
    metadata: { queryLength: String(query.length), matched: String(!!match) },
  });

  if (!match) {
    return buildVoiceError(query, "NOT_FOUND");
  }

  return buildVoiceSummary(query, match);
};

// ---------------------------------------------------------------------------
// adminGetPatients (Admin) - gestión de pacientes sintéticos sin filtro de acceso
// ---------------------------------------------------------------------------

const adminGetPatientsInputSchema = z.object({
  search: z.string().optional(),
  page: z.number().int().nonnegative().optional(),
  pageSize: z.number().int().positive().max(500).optional(),
  medicoId: z.string().optional(),
  // Solo admin: ver también pacientes desactivados (R4/R3).
  includeInactive: z.boolean().optional(),
});

type AdminGetPatientsInput = z.infer<typeof adminGetPatientsInputSchema>;

type AdminPatientOutput = SyntheticPatient & {
  authorizedMedicos: {
    id: string;
    fullName: string | null;
    username: string | null;
    email: string | null;
    specialty: string | null;
  }[];
};

type AdminGetPatientsOutput = {
  patients: AdminPatientOutput[];
  totalPages: number;
};

export const adminGetPatients: AdminGetPatients<
  AdminGetPatientsInput,
  AdminGetPatientsOutput
> = async (rawArgs, context) => {
  // Secretaria consulta el padron para gestionar agenda/citas (R1: sin notas).
  const viewer = ensureRole(context.user, "admin", "secretaria");
  const isAdminViewer = getActiveClinicalRole(viewer) === "admin";

  const {
    search,
    page = 1,
    pageSize = 20,
    medicoId,
    includeInactive = false,
  } = ensureArgsSchemaOrThrowHttpError(adminGetPatientsInputSchema, rawArgs);

  const skip = (page - 1) * pageSize;

  const where = {
    // R4: por defecto solo pacientes activos; admin puede incluir inactivos.
    ...(isAdminViewer && includeInactive ? {} : { isActive: true }),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { syntheticId: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(medicoId ? { authorizedMedicos: { some: { medicoId } } } : {}),
  };

  const [patients, total] = await Promise.all([
    context.entities.SyntheticPatient.findMany({
      where,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      skip,
      take: pageSize,
      include: {
        authorizedMedicos: {
          include: {
            medico: {
              select: {
                id: true,
                fullName: true,
                username: true,
                email: true,
                specialty: true,
              },
            },
          },
        },
      },
    }),
    context.entities.SyntheticPatient.count({ where }),
  ]);

  const adminPatients: AdminPatientOutput[] = patients.map((p: any) => ({
    ...p,
    authorizedMedicos: p.authorizedMedicos.map((a: any) => a.medico),
  }));

  return { patients: adminPatients, totalPages: Math.ceil(total / pageSize) };
};

// ---------------------------------------------------------------------------
// getAgenda (Médico = agenda propia; Admin = agenda por médico)
// ---------------------------------------------------------------------------

const getAgendaInputSchema = z.object({
  medicoId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

type GetAgendaInput = z.infer<typeof getAgendaInputSchema>;

type AgendaCita = {
  id: string;
  scheduledAt: Date;
  durationMinutes: number;
  status: string;
  reason: string | null;
  patient: {
    id: string;
    syntheticId: string;
    firstName: string;
    lastName: string;
  };
  medico: {
    id: string;
    fullName: string | null;
    email: string | null;
  };
};

type AgendaMetrics = {
  pacientesAtendidos: number;
  atencionesHoy: number;
  citasHoy: number;
  citasCompletadasHoy: number;
};

type GetAgendaOutput = {
  citas: AgendaCita[];
  currentStatus: "EN_CITA" | "DESOCUPADO";
  metrics: AgendaMetrics;
};

export const getAgenda: GetAgenda<GetAgendaInput, GetAgendaOutput> = async (
  rawArgs,
  context,
) => {
  // Secretaria consulta la agenda global junto a admin/médico (R2 activo).
  const authUser = ensureRole(context.user, "admin", "medico", "secretaria");
  const isMedico = getActiveClinicalRole(authUser) === "medico";

  const { medicoId, from, to } = ensureArgsSchemaOrThrowHttpError(
    getAgendaInputSchema,
    rawArgs,
  );

  const role = getActiveClinicalRole(authUser);
  const isMedicoUser = role === "medico";
  const scopeMedicoId = isMedicoUser ? authUser.id : medicoId;

  const now = new Date();
  const fromDate = from ?? new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const toDate = to ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const where = {
    ...(scopeMedicoId ? { medicoId: scopeMedicoId } : {}),
    scheduledAt: { gte: fromDate, lte: toDate },
  };

  const citas = await context.entities.Cita.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    include: {
      patient: {
        select: {
          id: true,
          syntheticId: true,
          firstName: true,
          lastName: true,
        },
      },
      medico: { select: { id: true, fullName: true, email: true } },
    },
  });

  const statusRef = { SCHEDULED: "SCHEDULED", IN_PROGRESS: "IN_PROGRESS" };
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const currentStatus = citas.some(
    (c: any) =>
      (c.status === statusRef.SCHEDULED ||
        c.status === statusRef.IN_PROGRESS) &&
      c.scheduledAt.getTime() <= now.getTime() &&
      now.getTime() < c.scheduledAt.getTime() + c.durationMinutes * 60_000,
  )
    ? ("EN_CITA" as const)
    : ("DESOCUPADO" as const);

  let pacientesAtendidos = 0;
  let atencionesHoy = 0;
  let citasHoy = 0;
  let citasCompletadasHoy = 0;

  if (scopeMedicoId) {
    const [
      authoredPatients,
      confirmedPatients1,
      authoredEpicrisisPatients,
      confirmedEpicrisisPatients,
    ] = await Promise.all([
      context.entities.ClinicalNote.findMany({
        where: { authorId: scopeMedicoId },
        select: { patientId: true },
        distinct: ["patientId" as const],
      }),
      context.entities.ClinicalNote.findMany({
        where: { confirmedById: scopeMedicoId },
        select: { patientId: true },
        distinct: ["patientId" as const],
      }),
      context.entities.Epicrisis.findMany({
        where: { authorId: scopeMedicoId },
        select: { patientId: true },
        distinct: ["patientId" as const],
      }),
      context.entities.Epicrisis.findMany({
        where: { confirmedById: scopeMedicoId },
        select: { patientId: true },
        distinct: ["patientId" as const],
      }),
    ]);
    const ids = new Set<string>();
    [
      ...authoredPatients,
      ...confirmedPatients1,
      ...authoredEpicrisisPatients,
      ...confirmedEpicrisisPatients,
    ].forEach((p) => ids.add(p.patientId));
    pacientesAtendidos = ids.size;

    const todayWhere = {
      authorId: scopeMedicoId,
      createdAt: { gte: startOfToday, lt: endOfToday },
    };
    const [notesToday, epicrisisToday, citasToday] = await Promise.all([
      context.entities.ClinicalNote.count({ where: todayWhere }),
      context.entities.Epicrisis.count({ where: todayWhere }),
      context.entities.Cita.findMany({
        where: {
          medicoId: scopeMedicoId,
          scheduledAt: { gte: startOfToday, lt: endOfToday },
        },
        select: { status: true },
      }),
    ]);
    citasHoy = citasToday.length;
    citasCompletadasHoy = citasToday.filter(
      (c: any) => c.status === "COMPLETED",
    ).length;
    atencionesHoy = notesToday + epicrisisToday + citasCompletadasHoy;
  } else {
    const todayCitas = await context.entities.Cita.findMany({
      where: {
        scheduledAt: { gte: startOfToday, lt: endOfToday },
      },
      select: { status: true },
    });
    citasHoy = todayCitas.length;
    citasCompletadasHoy = todayCitas.filter(
      (c: any) => c.status === "COMPLETED",
    ).length;
    atencionesHoy = citasCompletadasHoy;
  }

  // Los valores se devuelven como JSON plano (fechas en ISO): evita fallos de
  // serializacion superjson observados en produccion con filas reales.
  return JSON.parse(JSON.stringify({
    citas: citas as AgendaCita[],
    currentStatus,
    metrics: {
      pacientesAtendidos,
      atencionesHoy,
      citasHoy,
      citasCompletadasHoy,
    },
  })) as GetAgendaOutput;
};

// ---------------------------------------------------------------------------
// getDoctorsAgenda (Admin) - métricas y estado por profesional
// ---------------------------------------------------------------------------

type DoctorAgendaRow = {
  id: string;
  fullName: string | null;
  email: string | null;
  specialty: string | null;
  currentStatus: "EN_CITA" | "DESOCUPADO";
  pacientesAtendidos: number;
  atencionesHoy: number;
  citasHoy: number;
  proximaCita: Date | null;
};

type GetDoctorsAgendaOutput = {
  medicos: DoctorAgendaRow[];
};

export const getDoctorsAgenda: GetDoctorsAgenda<
  Record<string, never>,
  GetDoctorsAgendaOutput
> = async (_rawArgs, context) => {
  ensureRole(context.user, "admin", "medico", "secretaria");

  const medicos = await context.entities.User.findMany({
    where: { isMedico: true, isAdmin: false, isActive: true },
    select: { id: true, fullName: true, email: true, specialty: true },
  });

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const rows = await Promise.all(
    medicos.map(async (medico) => {
      const [
        authoredNotes,
        confirmedNotes,
        authoredEpicrises,
        confirmedEpicrises,
      ] = await Promise.all([
        context.entities.ClinicalNote.findMany({
          where: { authorId: medico.id },
          select: { patientId: true },
          distinct: ["patientId" as const],
        }),
        context.entities.ClinicalNote.findMany({
          where: { confirmedById: medico.id },
          select: { patientId: true },
          distinct: ["patientId" as const],
        }),
        context.entities.Epicrisis.findMany({
          where: { authorId: medico.id },
          select: { patientId: true },
          distinct: ["patientId" as const],
        }),
        context.entities.Epicrisis.findMany({
          where: { confirmedById: medico.id },
          select: { patientId: true },
          distinct: ["patientId" as const],
        }),
      ]);
      const patientIds = new Set<string>();
      [
        ...authoredNotes,
        ...confirmedNotes,
        ...authoredEpicrises,
        ...confirmedEpicrises,
      ].forEach((p) => patientIds.add(p.patientId));

      const todayWhere = {
        authorId: medico.id,
        createdAt: { gte: startOfToday, lt: endOfToday },
      };
      const [notesToday, epicrisisToday, citas] = await Promise.all([
        context.entities.ClinicalNote.count({ where: todayWhere }),
        context.entities.Epicrisis.count({ where: todayWhere }),
        context.entities.Cita.findMany({
          where: {
            medicoId: medico.id,
            scheduledAt: { gte: startOfToday, lt: endOfToday },
          },
          select: { status: true, scheduledAt: true, durationMinutes: true },
        }),
      ]);
      const citasHoy = citas.length;
      const citasCompletadasHoy = citas.filter(
        (c: any) => c.status === "COMPLETED",
      ).length;
      const atencionesHoy = notesToday + epicrisisToday + citasCompletadasHoy;

      const currentStatus = citas.some(
        (c: any) =>
          (c.status === "SCHEDULED" || c.status === "IN_PROGRESS") &&
          c.scheduledAt.getTime() <= now.getTime() &&
          now.getTime() < c.scheduledAt.getTime() + c.durationMinutes * 60_000,
      )
        ? ("EN_CITA" as const)
        : ("DESOCUPADO" as const);

      const upcoming = await context.entities.Cita.findFirst({
        where: {
          medicoId: medico.id,
          scheduledAt: { gte: now },
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        },
        orderBy: { scheduledAt: "asc" },
        select: { scheduledAt: true },
      });

      return {
        id: medico.id,
        fullName: medico.fullName,
        email: medico.email,
        specialty: medico.specialty,
        currentStatus,
        pacientesAtendidos: patientIds.size,
        atencionesHoy,
        citasHoy,
        proximaCita: upcoming?.scheduledAt ?? null,
      };
    }),
  );

  return { medicos: rows };
};

// ---------------------------------------------------------------------------
// getVitalSigns (Médico autorizado, Secretaria o Admin) - historial de signos vitales
// ---------------------------------------------------------------------------

const getVitalSignsInputSchema = z.object({
  patientId: z.string().min(1),
  page: z.number().int().nonnegative().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
});

type GetVitalSignsInput = z.infer<typeof getVitalSignsInputSchema>;

type VitalSignEntry = {
  id: string;
  createdAt: Date;
  citaId: string | null;
  recordedById: string;
  systolicBP: number;
  diastolicBP: number;
  heartRate: number;
  temperature: number;
  respiratoryRate: number;
  oxygenSaturation: number;
  weight: number;
  height: number;
  recordedBy: { fullName: string | null; username: string | null; email: string | null };
};

type GetVitalSignsOutput = {
  entries: VitalSignEntry[];
  totalPages: number;
};

export const getVitalSigns: GetVitalSigns<
  GetVitalSignsInput,
  GetVitalSignsOutput
> = async (rawArgs, context) => {
  // R2: solo cuentas activas; médico exige acceso al paciente (R-10).
  const viewer = ensureRole(context.user, "admin", "medico", "secretaria");

  const { patientId, page = 1, pageSize = 20 } =
    ensureArgsSchemaOrThrowHttpError(getVitalSignsInputSchema, rawArgs);

  const skip = (page - 1) * pageSize;

  const patient = await context.entities.SyntheticPatient.findUnique({
    where: { id: patientId },
    select: { id: true },
  });
  if (!patient) {
    throw new HttpError(404, "Paciente no encontrado");
  }

  if (getActiveClinicalRole(viewer) === "medico") {
    await assertMedicoPatientAccess(viewer.id, patientId);
  }

  const [entries, total] = await Promise.all([
    context.entities.VitalSign.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        recordedBy: { select: { fullName: true, username: true, email: true } },
      },
    }),
    context.entities.VitalSign.count({ where: { patientId } }),
  ]);

  return {
    entries: entries as unknown as VitalSignEntry[],
    totalPages: Math.ceil(total / pageSize),
  };
};

// ---------------------------------------------------------------------------
// getAvailableSlots (Médico, Secretaria o Admin) - huecos libres de un médico
// en un día. Estados bloqueantes (SCHEDULED/IN_PROGRESS) descartan sus slots.
// ---------------------------------------------------------------------------

const getAvailableSlotsInputSchema = z.object({
  medicoId: z.string().min(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha en formato YYYY-MM-DD"),
  durationMinutes: z.number().int().positive().max(240).optional(),
});

type GetAvailableSlotsInput = z.infer<typeof getAvailableSlotsInputSchema>;

type GetAvailableSlotsOutput = {
  medicoId: string;
  date: string;
  durationMinutes: number;
  freeSlots: string[];
  busyIntervals: { start: string; end: string }[];
};

export const getAvailableSlots: GetAvailableSlots<
  GetAvailableSlotsInput,
  GetAvailableSlotsOutput
> = async (rawArgs, context) => {
  ensureRole(context.user, "admin", "medico", "secretaria");

  const { medicoId, date, durationMinutes = 30 } =
    ensureArgsSchemaOrThrowHttpError(getAvailableSlotsInputSchema, rawArgs);

  const busy = await getOccupiedSlots({
    citaDelegate: context.entities.Cita,
    medicoId,
    dateISO: date,
  });

  const freeSlots = filterFreeSlots(
    buildDaySlots(durationMinutes),
    date,
    busy,
    durationMinutes,
    Date.now(),
  );

  return {
    medicoId,
    date,
    durationMinutes,
    freeSlots,
    busyIntervals: busy.map((iv) => ({
      start: new Date(iv.startMs).toISOString(),
      end: new Date(iv.endMs).toISOString(),
    })),
  };
};

// ---------------------------------------------------------------------------
// getEpicrisisForPrint (Admin / Médico / Secretaria) - datos de impresión de
// una epicrisis CONFIRMED. Solo lectura; nunca se editan documentos confirmados
// (P5 inmutabilidad). No incluye campos de debug/IA.
// ---------------------------------------------------------------------------

const getEpicrisisForPrintInputSchema = z.object({
  epicrisisId: z.string().min(1),
});

type GetEpicrisisForPrintInput = z.infer<
  typeof getEpicrisisForPrintInputSchema
>;

type EpicrisisPrintData = {
  id: string;
  status: string;
  noteType: string;
  patientIdentification: string;
  reasonForAdmission: string | null;
  relevantHistory: string | null;
  evolutionSummary: string | null;
  proceduresResults: string | null;
  validatedDiagnoses: string | null;
  conditionAtDischarge: string | null;
  followUpInstructions: string | null;
  responsibleProfessional: string;
  dateTime: Date;
  patient: { syntheticId: string; firstName: string; lastName: string };
};

type GetEpicrisisForPrintOutput = EpicrisisPrintData;

export const getEpicrisisForPrint: GetEpicrisisForPrint<
  GetEpicrisisForPrintInput,
  GetEpicrisisForPrintOutput
> = async (rawArgs, context) => {
  // P3: secretaría solo imprime; médico también. Admin NO (RBAC estricto).
  const viewer = ensureSecretariaOrMedico(context.user);

  const { epicrisisId } = ensureArgsSchemaOrThrowHttpError(
    getEpicrisisForPrintInputSchema,
    rawArgs,
  );

  const epicrisis = await context.entities.Epicrisis.findUnique({
    where: { id: epicrisisId },
    include: {
      patient: {
        select: {
          id: true,
          syntheticId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
  if (!epicrisis) {
    throw new HttpError(404, "Epicrisis no encontrada");
  }

  // P5: solo epicrisis confirmadas se entregan para impresión.
  if (epicrisis.status !== "CONFIRMED") {
    throw new HttpError(
      409,
      "Solo se puede imprimir una epicrisis confirmada",
    );
  }

  if (getActiveClinicalRole(viewer) === "medico") {
    await assertMedicoPatientAccess(viewer.id, epicrisis.patientId);
  }

  await createAuditEntry({
    userId: viewer.id,
    action: "PRINT_EPICRISIS",
    resourceType: "EPICRISIS",
    resourceId: epicrisis.id,
    patientId: epicrisis.patientId,
    epicrisisId: epicrisis.id,
    metadata: { noteType: epicrisis.noteType },
  });

  return {
    id: epicrisis.id,
    status: epicrisis.status,
    noteType: epicrisis.noteType,
    patientIdentification: epicrisis.patientIdentification,
    reasonForAdmission: epicrisis.reasonForAdmission,
    relevantHistory: epicrisis.relevantHistory,
    evolutionSummary: epicrisis.evolutionSummary,
    proceduresResults: epicrisis.proceduresResults,
    validatedDiagnoses: epicrisis.validatedDiagnoses,
    conditionAtDischarge: epicrisis.conditionAtDischarge,
    followUpInstructions: epicrisis.followUpInstructions,
    responsibleProfessional: epicrisis.responsibleProfessional,
    dateTime: epicrisis.dateTime,
    patient: {
      syntheticId: epicrisis.patient.syntheticId,
      firstName: epicrisis.patient.firstName,
      lastName: epicrisis.patient.lastName,
    },
  };
};

// ---------------------------------------------------------------------------
// getSecretaryAuditLog (Secretaria) - trail administrativo: citas, registro
// pre-clínico, signos vitales, inicio/cancelación. Solo metadata (RNF-002).
// ---------------------------------------------------------------------------

const SECRETARY_AUDIT_ACTIONS = [
  "MANAGE_CITA",
  "REGISTER_PRE_CLINICAL_DATA",
  "REGISTER_VITAL_SIGNS",
  "START_APPOINTMENT",
  "CANCEL_APPOINTMENT",
  "MARK_NO_SHOW",
];

const secretaryAuditLogInputSchema = z.object({
  take: z.number().int().min(1).max(200).optional(),
  citaId: z.string().optional(),
  patientId: z.string().optional(),
});

type GetSecretaryAuditLogInput = z.infer<
  typeof secretaryAuditLogInputSchema
>;

export type SecretaryAuditLogEntry = {
  id: string;
  createdAt: Date;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, any> | null;
  patientId: string | null;
  citaId: string | null;
  user: { id: string; fullName: string | null } | null;
};

export const getSecretaryAuditLog: GetSecretaryAuditLog<
  GetSecretaryAuditLogInput,
  SecretaryAuditLogEntry[]
> = async (rawArgs, context) => {
  ensureSecretaria(context.user);

  const { take, citaId, patientId } = ensureArgsSchemaOrThrowHttpError(
    secretaryAuditLogInputSchema,
    rawArgs,
  );

  const where: any = {
    action: { in: SECRETARY_AUDIT_ACTIONS },
  };
  if (citaId) where.citaId = citaId;
  if (patientId) where.patientId = patientId;

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take ?? 50,
    include: { user: { select: { id: true, fullName: true } } },
  });

  return logs as SecretaryAuditLogEntry[];
};

// ---------------------------------------------------------------------------
// searchCIE11 — Búsqueda de códigos CIE-11 vía API oficial de la OMS
// ---------------------------------------------------------------------------

const searchCIE11InputSchema = z.object({
  query: z.string().min(1).max(200),
});

export const searchCIE11 = async (
  rawArgs: { query: string },
  context: any,
) => {
  const user = ensureMedico(context.user);
  void user;

  const { query } = ensureArgsSchemaOrThrowHttpError(
    searchCIE11InputSchema,
    rawArgs,
  );

  const config = {
    clientId: process.env.ICD11_CLIENT_ID ?? "",
    clientSecret: process.env.ICD11_CLIENT_SECRET ?? "",
  };

  if (!isICD11Configured(config)) {
    throw new HttpError(
      503,
      "Servicio CIE-11 no configurado. Contacte al administrador.",
    );
  }

  const results = searchICD11(query, config);
  return results;
};

// ---------------------------------------------------------------------------
// getPendingLinkRequests (Admin): Listar solicitudes pendientes de vinculación
// ---------------------------------------------------------------------------

export const getPendingLinkRequests = async (_args: void, context: any) => {
  ensureAdmin(context.user);
  const requests = await context.entities.PatientLinkRequest.findMany({
    where: { status: "PENDING" },
    include: {
      patient: {
        select: {
          id: true,
          syntheticId: true,
          firstName: true,
          lastName: true,
          birthDate: true,
          sex: true,
          tipoDocumento: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return requests;
};


