import { HttpError } from "wasp/server";
import { z } from "zod";
import { ensurePaciente } from "../clinical/services/guards";
import { createAuditEntry } from "../clinical/services/audit";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";

const updateMyPatientProfileSchema = z.object({
  firstName: z.string().trim().min(1, "El nombre es obligatorio").max(60),
  lastName: z.string().trim().min(1, "El apellido es obligatorio").max(60),
  birthDate: z.coerce.date().optional(),
  sex: z.enum(["M", "F", "O"]).optional(),
  phone: z.string().trim().nullable().optional(),
  address: z.string().trim().nullable().optional(),
  bloodType: z.string().trim().nullable().optional(),
  allergies: z.string().trim().nullable().optional(),
  medicalHistory: z.string().trim().nullable().optional(),
  emergencyName: z.string().trim().nullable().optional(),
  emergencyPhone: z.string().trim().nullable().optional(),
  insurance: z.string().trim().nullable().optional(),
  nationality: z.string().trim().nullable().optional(),
  ethnicity: z.string().trim().nullable().optional(),
  heightCm: z.number().int().positive().nullable().optional(),
  weightKg: z.number().int().positive().nullable().optional(),
});

type UpdateMyPatientProfileInput = z.infer<typeof updateMyPatientProfileSchema>;

export const updateMyPatientProfile: any = async (
  rawArgs: any,
  context: any,
) => {
  const user = ensurePaciente(context.user);

  const data: UpdateMyPatientProfileInput = ensureArgsSchemaOrThrowHttpError(
    updateMyPatientProfileSchema,
    rawArgs,
  );

  const patient = await context.entities.SyntheticPatient.findFirst({
    where: { userId: user.id },
  });

  if (!patient) {
    throw new HttpError(
      404,
      "No se encontró una ficha de paciente vinculada a tu usuario.",
    );
  }

  // Actualizar datos del paciente
  const updatedPatient = await context.entities.SyntheticPatient.update({
    where: { id: patient.id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      ...(data.birthDate ? { birthDate: data.birthDate } : {}),
      ...(data.sex ? { sex: data.sex } : {}),
      phone: data.phone ?? null,
      address: data.address ?? null,
      bloodType: data.bloodType ?? null,
      allergies: data.allergies ?? null,
      medicalHistory: data.medicalHistory ?? null,
      emergencyName: data.emergencyName ?? null,
      emergencyPhone: data.emergencyPhone ?? null,
      insurance: data.insurance ?? null,
      nationality: data.nationality ?? null,
      ethnicity: data.ethnicity ?? null,
      heightCm: data.heightCm ?? null,
      weightKg: data.weightKg ?? null,
    },
  });

  // Sincronizar el nombre en la cuenta de usuario
  const fullName = `${data.firstName} ${data.lastName}`.trim();
  await context.entities.User.update({
    where: { id: user.id },
    data: { fullName },
  });

  // Auditoría sin contenido médico confidencial
  await createAuditEntry({
    userId: user.id,
    action: "ADMIN_MANAGE_DATA",
    resourceType: "PATIENT",
    resourceId: patient.id,
    patientId: patient.id,
    metadata: {
      action: "PATIENT_SELF_UPDATE_PROFILE",
      patientId: patient.id,
      syntheticId: patient.syntheticId,
    },
  });

  return {
    success: true,
    patient: updatedPatient,
  };
};
