// Auditoría funcional (RF-019, RF-020, RNF-007).
// Registro SOLO referencias/acciones/metadata no clínica. NUNCA contenido clínico (RNF-002).

import { prisma } from "wasp/server";

export type AuditAction =
  | "VIEW_PATIENT"
  | "CREATE_NOTE"
  | "EDIT_DRAFT"
  | "REQUEST_AI_STRUCTURING"
  | "REVIEW_NOTE"
  | "CONFIRM_NOTE"
  | "GENERATE_EPICRISIS"
  | "REVIEW_EPICRISIS"
  | "CONFIRM_EPICRISIS"
  | "EXPORT_EPICRISIS_PDF"
  | "REGISTER_VITAL_SIGNS"
  | "START_APPOINTMENT"
  | "CANCEL_APPOINTMENT"
  | "MARK_NO_SHOW"
  | "ASSIGN_PATIENT_TO_MEDICO"
  | "CREATE_ADDENDUM"
  | "VOICE_ASSISTANT_QUERY"
  | "VOICE_NOTE_CREATE"
  | "DELETE_NOTE"
  | "MANAGE_CITA"
  | "PRINT_EPICRISIS"
  | "ADMIN_MANAGE_USER"
  | "ADMIN_MANAGE_ROLE"
  | "ADMIN_MANAGE_DATA";

export type AuditResourceType =
  | "PATIENT"
  | "NOTE"
  | "EPICRISIS"
  | "CITA"
  | "USER"
  | "SYSTEM";

export interface CreateAuditEntryArgs {
  userId: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string | null;
  metadata?: Record<string, string> | null;
  patientId?: string | null;
  clinicalNoteId?: string | null;
  epicrisisId?: string | null;
  citaId?: string | null;
}

export async function createAuditEntry(
  args: CreateAuditEntryArgs,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: args.userId,
      action: args.action,
      resourceType: args.resourceType,
      resourceId: args.resourceId ?? null,
      metadata: args.metadata ?? undefined,
      patientId: args.patientId ?? null,
      clinicalNoteId: args.clinicalNoteId ?? null,
      epicrisisId: args.epicrisisId ?? null,
      citaId: args.citaId ?? null,
    },
  });
}
