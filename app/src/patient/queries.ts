import { HttpError } from "wasp/server";
import { ensurePaciente, ensureRole } from "../clinical/services/guards";
import {
  DEFAULT_CLINICAL_FACILITY,
  PUBLIC_DIRECTORY_CACHE_TTL_MS,
  PUBLIC_DIRECTORY_LIMIT,
} from "./constants";

export interface PublicSpecialistDto {
  fullName: string;
  specialty: string;
  location: string;
  generalHours: string;
}

export function parseAllowedDirectoryEmails(rawEnv?: string | null): string[] {
  if (!rawEnv || typeof rawEnv !== "string") return [];
  return rawEnv
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

interface DirectoryCacheEntry {
  data: PublicSpecialistDto[];
  expiresAt: number;
  rawEnvSnapshot?: string;
}

let directoryCache: DirectoryCacheEntry | null = null;

export function clearDirectoryCache(): void {
  directoryCache = null;
}

/**
 * Consulta pública del Directorio de Especialistas.
 * 
 * Invariantes de Seguridad y Privacidad:
 * 1. NO requiere sesión (anónimo seguro).
 * 2. Basado EXCLUSIVAMENTE en lista blanca (allowlist) definida en process.env.PUBLIC_DIRECTORY_EMAILS.
 *    Si está vacía o ausente, devuelve [] de forma segura.
 * 3. Selección explícita con select: solo fullName y specialty del esquema real.
 * 4. Excluye rigurosamente filas con fullName o specialty nulos o vacíos.
 * 5. NUNCA devuelve id, email, password, teléfono, flags internos ni PII.
 * 6. Cache en memoria TTL de 60s para evitar abuso sobre la base de datos.
 */
export const getPublicSpecialistsDirectory: any = async (
  _rawArgs: any,
  context: any,
) => {
  const rawEnv = process.env.PUBLIC_DIRECTORY_EMAILS;
  const now = Date.now();

  if (
    directoryCache &&
    directoryCache.expiresAt > now &&
    directoryCache.rawEnvSnapshot === rawEnv
  ) {
    return directoryCache.data;
  }

  const allowedEmails = parseAllowedDirectoryEmails(rawEnv);
  if (allowedEmails.length === 0) {
    directoryCache = {
      data: [],
      expiresAt: now + PUBLIC_DIRECTORY_CACHE_TTL_MS,
      rawEnvSnapshot: rawEnv,
    };
    return [];
  }

  const doctors = await context.entities.User.findMany({
    where: {
      isMedico: true,
      isAdmin: false,
      isSecretaria: false,
      isPaciente: false,
      isActive: true,
      fullName: { not: null },
      specialty: { not: null },
      OR: allowedEmails.map((email) => ({
        email: { equals: email, mode: "insensitive" },
      })),
    },
    select: {
      fullName: true,
      specialty: true,
    },
    orderBy: [
      { fullName: "asc" },
      { id: "asc" },
    ],
    take: PUBLIC_DIRECTORY_LIMIT,
  });

  const mapped: PublicSpecialistDto[] = (doctors || [])
    .filter((d: any) => Boolean(d.fullName?.trim()) && Boolean(d.specialty?.trim()))
    .map((doc: any) => ({
      fullName: doc.fullName.trim(),
      specialty: doc.specialty.trim(),
      location: DEFAULT_CLINICAL_FACILITY.location,
      generalHours: DEFAULT_CLINICAL_FACILITY.generalHours,
    }));

  directoryCache = {
    data: mapped,
    expiresAt: now + PUBLIC_DIRECTORY_CACHE_TTL_MS,
    rawEnvSnapshot: rawEnv,
  };

  return mapped;
};

export const getActiveDoctorsForPatient: any = async (
  _rawArgs: any,
  context: any,
) => {
  ensureRole(context.user, "paciente", "admin", "secretaria", "medico");
  return await context.entities.User.findMany({
    where: { isMedico: true, isAdmin: false, isActive: true },
    select: { id: true, fullName: true, specialty: true, email: true },
    orderBy: { fullName: "asc" },
  });
};

export const getPatientAppointments: any = async (_rawArgs: any, context: any) => {
  const user = ensurePaciente(context.user);

  const patient = await context.entities.SyntheticPatient.findFirst({
    where: { userId: user.id },
  });

  if (!patient) {
    return { linked: false, citas: [], patient: null };
  }

  const citas = await context.entities.Cita.findMany({
    where: { patientId: patient.id },
    orderBy: { scheduledAt: "desc" },
    include: {
      medico: {
        select: {
          id: true,
          fullName: true,
          email: true,
          specialty: true,
        },
      },
    },
  });

  return {
    linked: true,
    patient: {
      id: patient.id,
      syntheticId: patient.syntheticId,
      firstName: patient.firstName,
      lastName: patient.lastName,
      birthDate: patient.birthDate,
      sex: patient.sex,
      tipoDocumento: patient.tipoDocumento,
      documento: patient.documento,
      allergies: patient.allergies,
      medicalHistory: patient.medicalHistory,
      bloodType: patient.bloodType,
      phone: patient.phone,
      address: patient.address,
      emergencyName: patient.emergencyName,
      emergencyPhone: patient.emergencyPhone,
      insurance: patient.insurance,
      nationality: patient.nationality,
      ethnicity: patient.ethnicity,
      heightCm: patient.heightCm,
      weightKg: patient.weightKg,
    },
    citas,
  };
};

export const getPatientClinicalHistory: any = async (
  _rawArgs: any,
  context: any,
) => {
  const user = ensurePaciente(context.user);

  const patient = await context.entities.SyntheticPatient.findFirst({
    where: { userId: user.id },
  });

  if (!patient) {
    return { linked: false, notes: [], epicrises: [] };
  }

  const [notes, epicrises] = await Promise.all([
    context.entities.ClinicalNote.findMany({
      where: {
        patientId: patient.id,
        status: "CONFIRMED", // RNF-002: El paciente solo ve notas CONFIRMADAS
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        motivoConsulta: true,
        notaClinica: true,
        planIndicaciones: true,
        cie11Code: true,
        cie11Description: true,
        status: true,
        createdAt: true,
        confirmedAt: true,
        author: {
          select: {
            fullName: true,
            specialty: true,
          },
        },
      },
    }),
    context.entities.Epicrisis.findMany({
      where: {
        patientId: patient.id,
        status: "CONFIRMED", // RNF-002: Solo epicrisis CONFIRMADAS
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reasonForAdmission: true,
        evolutionSummary: true,
        conditionAtDischarge: true,
        followUpInstructions: true,
        validatedDiagnoses: true,
        cie11Code: true,
        cie11Description: true,
        status: true,
        dateTime: true,
        createdAt: true,
        author: {
          select: {
            fullName: true,
            specialty: true,
          },
        },
      },
    }),
  ]);

  return {
    linked: true,
    notes,
    epicrises,
  };
};

export const getMyLinkRequestStatus: any = async (
  _rawArgs: any,
  context: any,
) => {
  const user = context.user;
  if (!user) return { status: "NONE" };

  const patient = await context.entities.SyntheticPatient.findFirst({
    where: { userId: user.id },
  });
  if (patient) {
    return { status: "ACTIVE", patientId: patient.id, syntheticId: patient.syntheticId };
  }

  const latestRequest = await context.entities.PatientLinkRequest.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  if (!latestRequest) {
    return { status: "NONE" };
  }

  return {
    status: latestRequest.status,
    createdAt: latestRequest.createdAt,
    rejectionReason: latestRequest.rejectionReason,
  };
};

