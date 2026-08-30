import { HttpError } from "wasp/server";
import { ensurePaciente } from "../clinical/services/guards";

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
