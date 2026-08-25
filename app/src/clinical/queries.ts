// Operaciones de consulta (Queries) del módulo clínico.
// contracts/clinical-operations.md §1, §4.

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
} from "wasp/server/operations";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import {
  ensureMedico,
  ensureAdmin,
  ensureRole,
  getActiveClinicalRole,
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

// ---------------------------------------------------------------------------
// getPatients
// ---------------------------------------------------------------------------

const getPatientsInputSchema = z.object({
  search: z.string().optional(),
  page: z.number().int().nonnegative().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
});

type GetPatientsInput = z.infer<typeof getPatientsInputSchema>;

type GetPatientsOutput = {
  patients: SyntheticPatient[];
  totalPages: number;
};

export const getPatients: GetPatients<
  GetPatientsInput,
  GetPatientsOutput
> = async (rawArgs, context) => {
  const user = ensureMedico(context.user);

  const {
    search,
    page = 1,
    pageSize = 20,
  } = ensureArgsSchemaOrThrowHttpError(getPatientsInputSchema, rawArgs);

  const medicoId = user.id;
  const skip = (page - 1) * pageSize;

  const where = {
    isActive: true,
    authorizedMedicos: { some: { medicoId } },
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
  const user = ensureMedico(context.user);

  const { patientId } = ensureArgsSchemaOrThrowHttpError(
    getPatientByIdInputSchema,
    rawArgs,
  );

  await assertMedicoPatientAccess(user.id, patientId);

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

  // Audit VIEW_PATIENT (contracts §1)
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
  const user = ensureMedico(context.user);

  const { patientId, includeAddenda = false } =
    ensureArgsSchemaOrThrowHttpError(getPatientHistoryInputSchema, rawArgs);

  await assertMedicoPatientAccess(user.id, patientId);

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
  // Admin: ve TODO el registro (incluye alta de pacientes, citas y notas).
  let where: any = {};
  if (context.user.isMedico && !context.user.isAdmin) {
    where = {
      userId: context.user.id,
      resourceType: { in: ["PATIENT", "NOTE", "EPICRISIS"] },
    };
  } else if (context.user.isAdmin && !context.user.isMedico) {
    where = {};
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
  pageSize: z.number().int().positive().max(100).optional(),
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

  const isAdmin = authUser.isAdmin && !authUser.isMedico;
  const scopeMedicoId = isAdmin ? medicoId : authUser.id;

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
    (c) =>
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
      (c) => c.status === "COMPLETED",
    ).length;
    atencionesHoy = notesToday + epicrisisToday + citasCompletadasHoy;
  }

  return {
    citas: citas as AgendaCita[],
    currentStatus,
    metrics: {
      pacientesAtendidos,
      atencionesHoy,
      citasHoy,
      citasCompletadasHoy,
    },
  };
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
  ensureAdmin(context.user);

  const medicos = await context.entities.User.findMany({
    where: { isMedico: true, isAdmin: false },
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
        (c) => c.status === "COMPLETED",
      ).length;
      const atencionesHoy = notesToday + epicrisisToday + citasCompletadasHoy;

      const currentStatus = citas.some(
        (c) =>
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

