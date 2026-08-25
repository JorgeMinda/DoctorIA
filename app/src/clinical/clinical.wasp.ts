// Módulo clínico DoctorIA (spec.md RF-014..RF-020, RF-025..RF-031; data-model.md).
// Declara las 18 operaciones de contracts/clinical-operations.md y las rutas clínicas.

import { action, page, query, route, type Spec } from "@wasp.sh/spec";

import {
  adminCreateMedicoUser,
  adminUpdateMedicoUser,
  adminDeleteMedicoUser,
  createClinicalNote,
  createEpicrisisAddendum,
  createNoteAddendum,
  generateAddendumDraftAction,
  createNoteFromVoice,
  deleteClinicalNote,
  confirmClinicalNote,
  confirmEpicrisis,
  generateEpicrisisDraft,
  manageCita,
  manageMedicoPatientAccess,
  manageSyntheticPatients,
  recordEpicrisisExport,
  createVitalSignAction,
  requestAIStructuring,
  updateClinicalNoteDraft,
  updateCitaStatus,
  updateEpicrisisDraft,
} from "./actions" with { type: "ref" };
import {
  adminGetPatients,
  getAgenda,
  getAuditLog,
  getClinicalNote,
  getDoctorsAgenda,
  getEpicrisis,
  getPatientById,
  getPatientHistory,
  getPatients,
  getVoiceAssistantResponse,
  getVitalSigns,
} from "./queries" with { type: "ref" };

import { ClinicalAdminPage } from "./pages/ClinicalAdminPage" with { type: "ref" };
import { ClinicalAgendaPage } from "./pages/ClinicalAgendaPage" with { type: "ref" };
import { ClinicalAuditPage } from "./pages/ClinicalAuditPage" with { type: "ref" };
import { ClinicalEpicrisisPage } from "./pages/ClinicalEpicrisisPage" with { type: "ref" };
import { ClinicalNotePage } from "./pages/ClinicalNotePage" with { type: "ref" };
import { ClinicalPatientDetailPage } from "./pages/ClinicalPatientDetailPage" with { type: "ref" };
import { ClinicalPatientsPage } from "./pages/ClinicalPatientsPage" with { type: "ref" };
import { ClinicalVoicePage } from "./pages/ClinicalVoicePage" with { type: "ref" };

export const clinicalSpec: Spec = [
  // Queries (contracts §1 y §4)
  query(getPatients, {
    entities: ["SyntheticPatient", "MedicoPatientAccess"],
  }),
  query(getPatientById, {
    entities: [
      "SyntheticPatient",
      "ClinicalNote",
      "Epicrisis",
      "MedicoPatientAccess",
    ],
  }),
  query(getPatientHistory, {
    entities: ["ClinicalNote", "Epicrisis", "MedicoPatientAccess"],
  }),
  query(getClinicalNote, {
    entities: ["ClinicalNote", "MedicoPatientAccess"],
  }),
  query(getEpicrisis, {
    entities: ["Epicrisis", "MedicoPatientAccess"],
  }),
  query(getAuditLog, { entities: ["AuditLog", "User"] }),
  query(getVoiceAssistantResponse, {
    entities: ["SyntheticPatient", "MedicoPatientAccess", "AuditLog"],
  }),
  query(getVitalSigns, {
    entities: ["VitalSign", "SyntheticPatient", "MedicoPatientAccess"],
  }),
  query(adminGetPatients, {
    entities: ["SyntheticPatient", "MedicoPatientAccess", "User"],
  }),
  query(getAgenda, {
    entities: ["Cita", "User", "SyntheticPatient", "ClinicalNote", "Epicrisis"],
  }),
  query(getDoctorsAgenda, {
    entities: ["Cita", "User", "ClinicalNote", "Epicrisis"],
  }),

  // Actions (contracts §2, §3, §5)
  action(createClinicalNote, {
    entities: [
      "ClinicalNote",
      "SyntheticPatient",
      "MedicoPatientAccess",
      "AuditLog",
    ],
  }),
  action(updateClinicalNoteDraft, {
    entities: ["ClinicalNote", "MedicoPatientAccess", "AuditLog"],
  }),
  action(requestAIStructuring, {
    entities: ["ClinicalNote", "MedicoPatientAccess", "AuditLog"],
  }),
  action(confirmClinicalNote, {
    entities: ["ClinicalNote", "MedicoPatientAccess", "AuditLog"],
  }),
  action(createNoteAddendum, {
    entities: ["ClinicalNote", "MedicoPatientAccess", "AuditLog"],
  }),
  action(generateAddendumDraftAction, {
    entities: ["ClinicalNote", "MedicoPatientAccess", "AuditLog"],
  }),
  action(generateEpicrisisDraft, {
    entities: [
      "Epicrisis",
      "ClinicalNote",
      "SyntheticPatient",
      "MedicoPatientAccess",
      "AuditLog",
    ],
  }),
  action(updateEpicrisisDraft, {
    entities: ["Epicrisis", "MedicoPatientAccess", "AuditLog"],
  }),
  action(confirmEpicrisis, {
    entities: ["Epicrisis", "MedicoPatientAccess", "AuditLog"],
  }),
  action(recordEpicrisisExport, {
    entities: ["Epicrisis", "MedicoPatientAccess", "AuditLog"],
  }),
  action(createVitalSignAction, {
    entities: ["VitalSign", "SyntheticPatient", "Cita", "MedicoPatientAccess", "AuditLog"],
  }),
  action(createEpicrisisAddendum, {
    entities: ["Epicrisis", "MedicoPatientAccess", "AuditLog"],
  }),
  action(manageSyntheticPatients, {
    entities: [
      "SyntheticPatient",
      "ClinicalNote",
      "Epicrisis",
      "MedicoPatientAccess",
      "Cita",
      "AuditLog",
    ],
  }),
  action(manageMedicoPatientAccess, {
    entities: ["MedicoPatientAccess", "User", "SyntheticPatient", "AuditLog"],
  }),
  action(adminCreateMedicoUser, {
    entities: ["User", "AuditLog"],
  }),
  action(adminUpdateMedicoUser, {
    entities: ["User", "AuditLog"],
  }),
  action(adminDeleteMedicoUser, {
    entities: [
      "User",
      "MedicoPatientAccess",
      "ClinicalNote",
      "Epicrisis",
      "Cita",
      "AuditLog",
    ],
  }),
  action(manageCita, {
    entities: ["Cita", "User", "SyntheticPatient", "AuditLog"],
  }),
  action(updateCitaStatus, {
    entities: ["Cita", "AuditLog"],
  }),
  action(createNoteFromVoice, {
    entities: [
      "SyntheticPatient",
      "User",
      "ClinicalNote",
      "MedicoPatientAccess",
      "AuditLog",
    ],
  }),
  action(deleteClinicalNote, {
    entities: ["ClinicalNote", "MedicoPatientAccess", "AuditLog"],
  }),

  // Rutas / páginas clínicas
  route(
    "ClinicalPatientsRoute",
    "/clinical/patients",
    page(ClinicalPatientsPage, { authRequired: true }),
  ),
  route(
    "ClinicalPatientDetailRoute",
    "/clinical/patients/:patientId",
    page(ClinicalPatientDetailPage, { authRequired: true }),
  ),
  route(
    "ClinicalAgendaRoute",
    "/clinical/agenda",
    page(ClinicalAgendaPage, { authRequired: true }),
  ),
  route(
    "ClinicalNoteRoute",
    "/clinical/notes/:noteId",
    page(ClinicalNotePage, { authRequired: true }),
  ),
  route(
    "ClinicalEpicrisisRoute",
    "/clinical/epicrises/:epicrisisId",
    page(ClinicalEpicrisisPage, { authRequired: true }),
  ),
  route(
    "ClinicalAuditRoute",
    "/clinical/audit",
    page(ClinicalAuditPage, { authRequired: true }),
  ),
  route(
    "ClinicalAdminRoute",
    "/clinical/admin",
    page(ClinicalAdminPage, { authRequired: true }),
  ),
  route(
    "ClinicalVoiceRoute",
    "/clinical/voice",
    page(ClinicalVoicePage, { authRequired: true }),
  ),
];
