import { action, page, query, route, type Spec } from "@wasp.sh/spec";

import { PatientDashboard } from "./pages/PatientDashboard" with { type: "ref" };
import { LinkPatientPage } from "./pages/LinkPatientPage" with { type: "ref" };

import {
  getPatientAppointments,
  getPatientClinicalHistory,
  getMyLinkRequestStatus,
  getActiveDoctorsForPatient,
} from "./queries" with { type: "ref" };
import {
  updateMyPatientProfile,
  requestPatientAppointment,
} from "./actions" with { type: "ref" };

export const patientSpec: Spec = [
  action(updateMyPatientProfile, {
    entities: ["SyntheticPatient", "User", "AuditLog"],
  }),
  action(requestPatientAppointment, {
    entities: [
      "SyntheticPatient",
      "Cita",
      "User",
      "AuditLog",
      "MedicoPatientAccess",
    ],
  }),
  query(getActiveDoctorsForPatient, {
    entities: ["User"],
  }),
  query(getPatientAppointments, {
    entities: ["SyntheticPatient", "Cita", "User"],
  }),
  query(getPatientClinicalHistory, {
    entities: ["SyntheticPatient", "ClinicalNote", "Epicrisis", "User"],
  }),
  query(getMyLinkRequestStatus, {
    entities: ["PatientLinkRequest", "SyntheticPatient", "User"],
  }),

  route(
    "PatientDashboardRoute",
    "/patient/dashboard",
    page(PatientDashboard, { authRequired: true }),
  ),
  route(
    "PatientLinkRoute",
    "/patient/link",
    page(LinkPatientPage, { authRequired: true }),
  ),
];
