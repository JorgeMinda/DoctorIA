// Autorización Médico↔Paciente (R-10, RF-025, quickstart Scenario 5).
// Toda operación patient-scoped DEBE verificar MedicoPatientAccess a nivel de servidor.
// Falla: 403 sin revelar contenido clínico; 404 si el recurso no existe.

import { HttpError, prisma } from "wasp/server";

export async function assertMedicoPatientAccess(
  medicoId: string,
  patientId: string,
): Promise<void> {
  const access = await prisma.medicoPatientAccess.findUnique({
    where: { medicoId_patientId: { medicoId, patientId } },
    select: { id: true },
  });
  if (!access) {
    throw new HttpError(403, "No autorizado para acceder a este paciente");
  }
}

export async function resolvePatientIdForMedico(
  medicoId: string,
  patientId: string,
): Promise<string> {
  // Retorna patientId si el médico tiene acceso; si no, 403 sin filtrar datos.
  await assertMedicoPatientAccess(medicoId, patientId);
  return patientId;
}
