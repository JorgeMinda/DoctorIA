// Módulo clínico DoctorIA (spec.md RF-014..RF-020, RF-025..RF-028; data-model.md).
// Declara las 17 operaciones de contracts/clinical-operations.md y las rutas clínicas.

import { action, page, query, route, type Spec } from "@wasp.sh/spec";

import {
  createClinicalNote,
  createEpicrisisAddendum,
  createNoteAddendum,
  confirmClinicalNote,
  confirmEpicrisis,
  generateEpicrisisDraft,
  manageMedicoPatientAccess,
  manageSyntheticPatients,
  requestAIStructuring,
  updateClinicalNoteDraft,
  updateEpicrisisDraft,
} from "./actions" with { type: "ref" };
import {
  getAuditLog,
  getClinicalNote,
  getEpicrisis,
  getPatientById,
  getPatientHistory,
  getPatients,
} from "./queries" with { type: "ref" };

import { ClinicalAdminPage } from "./pages/ClinicalAdminPage" with { type: "ref" };
import { ClinicalAuditPage } from "./pages/ClinicalAuditPage" with { type: "ref" };
import { ClinicalEpicrisisPage } from "./pages/ClinicalEpicrisisPage" with { type: "ref" };
import { ClinicalNotePage } from "./pages/ClinicalNotePage" with { type: "ref" };
import { ClinicalPatientDetailPage } from "./pages/ClinicalPatientDetailPage" with { type: "ref" };
import { ClinicalPatientsPage } from "./pages/ClinicalPatientsPage" with { type: "ref" };

export const clinicalSpec: Spec = [
  // Queries (contracts §1 y §4)
  query(getPatients, {
    entities: ["SyntheticPatient", "MedicoPatientAccess"],
  }),
  query(getPatientById, {
    entities: ["SyntheticPatient", "ClinicalNote", "Epicrisis", "MedicoPatientAccess"],
  }),
  query(getPatientHistory, {
    entities: ["ClinicalNote", "MedicoPatientAccess"],
  }),
  query(getClinicalNote, {
    entities: ["ClinicalNote", "MedicoPatientAccess"],
  }),
  query(getEpicrisis, {
    entities: ["Epicrisis", "MedicoPatientAccess"],
  }),
  query(getAuditLog, { entities: ["AuditLog", "User"] }),

  // Actions (contracts §2, §3, §5)
  action(createClinicalNote, {
    entities: ["ClinicalNote", "SyntheticPatient", "MedicoPatientAccess", "AuditLog"],
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
  action(generateEpicrisisDraft, {
    entities: ["Epicrisis", "ClinicalNote", "SyntheticPatient", "MedicoPatientAccess", "AuditLog"],
  }),
  action(updateEpicrisisDraft, {
    entities: ["Epicrisis", "MedicoPatientAccess", "AuditLog"],
  }),
  action(confirmEpicrisis, {
    entities: ["Epicrisis", "MedicoPatientAccess", "AuditLog"],
  }),
  action(createEpicrisisAddendum, {
    entities: ["Epicrisis", "MedicoPatientAccess", "AuditLog"],
  }),
  action(manageSyntheticPatients, {
    entities: ["SyntheticPatient", "ClinicalNote", "Epicrisis", "MedicoPatientAccess", "AuditLog"],
  }),
  action(manageMedicoPatientAccess, {
    entities: ["MedicoPatientAccess", "User", "SyntheticPatient", "AuditLog"],
  }),

  // Rutas / páginas clínicas
  route("ClinicalPatientsRoute", "/clinical/patients", page(ClinicalPatientsPage, { authRequired: true })),
  route("ClinicalPatientDetailRoute", "/clinical/patients/:patientId", page(ClinicalPatientDetailPage, { authRequired: true })),
  route("ClinicalNoteRoute", "/clinical/notes/:noteId", page(ClinicalNotePage, { authRequired: true })),
  route("ClinicalEpicrisisRoute", "/clinical/epicrises/:epicrisisId", page(ClinicalEpicrisisPage, { authRequired: true })),
  route("ClinicalAuditRoute", "/clinical/audit", page(ClinicalAuditPage, { authRequired: true })),
  route("ClinicalAdminRoute", "/clinical/admin", page(ClinicalAdminPage, { authRequired: true })),
];
