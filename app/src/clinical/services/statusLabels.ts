export const NOTE_STATUS_LABELS: Record<string, string> = {
  DRAFT_MANUAL: "Borrador manual",
  DRAFT_AI_ASSISTED: "Borrador asistido por IA",
  REVIEWED: "En revisión",
  CONFIRMED: "Confirmada",
};

export const EPICRISIS_STATUS_LABELS: Record<string, string> = {
  DRAFT_MANUAL: "Borrador manual",
  DRAFT_AI_ASSISTED: "Borrador asistido por IA",
  REVIEWED: "En revisión",
  CONFIRMED: "Confirmada",
};

export const CITA_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Agendada",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No asistio",
  NOT_STARTED: "No iniciada",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  VIEW_PATIENT: "Vio paciente",
  CREATE_NOTE: "Creó nota",
  EDIT_DRAFT: "Editó borrador",
  REQUEST_AI_STRUCTURING: "Solicitó estructuración IA",
  REVIEW_NOTE: "Revisó nota",
  CONFIRM_NOTE: "Confirmó nota",
  GENERATE_EPICRISIS: "Generó epicrisis",
  REVIEW_EPICRISIS: "Revisó epicrisis",
  CONFIRM_EPICRISIS: "Confirmó epicrisis",
  EXPORT_EPICRISIS_PDF: "Exportó epicrisis a PDF",
  PRINT_EPICRISIS: "Imprimió epicrisis",
  REGISTER_VITAL_SIGNS: "Registró signos vitales",
  REGISTER_PRE_CLINICAL_DATA: "Registró registro pre-clínico",
  UPDATE_NOTE_CIE11: "Asignó clasificación CIE-11 a nota",
  UPDATE_EPICRISIS_CIE11: "Asignó clasificación CIE-11 a epicrisis",
  START_APPOINTMENT: "Inició cita",
  CANCEL_APPOINTMENT: "Canceló cita",
  MARK_NO_SHOW: "Marcó no asistió",
  ASSIGN_PATIENT_TO_MEDICO: "Asignó paciente a médico",
  CREATE_ADDENDUM: "Creó adenda",
  VOICE_ASSISTANT_QUERY: "Consulta de asistente de voz",
  CREATE_CITA: "Creó cita",
  UPDATE_CITA: "Actualizó cita",
  VOICE_NOTE_CREATE: "Creó nota por voz",
  DELETE_NOTE: "Eliminó nota",
  ADMIN_MANAGE_USER: "Administró usuario",
  ADMIN_MANAGE_ROLE: "Administró rol",
  ADMIN_MANAGE_DATA: "Administró datos",
  MANAGE_CITA: "Administró cita",
};

export function statusLabel(status: string): string {
  return (
    NOTE_STATUS_LABELS[status] ?? EPICRISIS_STATUS_LABELS[status] ?? status
  );
}

export function citaStatusLabel(status: string): string {
  return CITA_STATUS_LABELS[status] ?? status;
}

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
