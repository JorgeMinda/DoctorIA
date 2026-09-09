// Declaración de Wasp Spec para el módulo WhatsApp AI (DoctorIA)

import { action, api, job, query, type Spec } from "@wasp.sh/spec";

import { handleWhatsAppWebhook } from "./api/webhook" with { type: "ref" };
import {
  sendWhatsAppTestMessage,
  triggerAppointmentRemindersAction,
} from "./actions" with { type: "ref" };
import { getWhatsAppConnectionInfo } from "./queries" with { type: "ref" };
import { runAppointmentReminders } from "./jobs/reminderJob" with { type: "ref" };

export const whatsappSpec: Spec = [
  // Webhook HTTP endpoint (Ingress desde WhatsApp Gateway / Evolution API)
  api("POST", "/whatsapp/webhook", handleWhatsAppWebhook, {
    entities: ["Cita", "SyntheticPatient", "User", "AuditLog"],
    auth: false,
  }),

  // Background Job: Recordatorios automáticos diarios a las 09:00 AM
  job(runAppointmentReminders, {
    executor: "PgBoss",
    entities: ["Cita", "SyntheticPatient", "User"],
    schedule: { cron: "0 9 * * *" },
  }),

  // Queries administrativas
  query(getWhatsAppConnectionInfo, {
    entities: ["SyntheticPatient", "Cita", "User"],
  }),

  // Actions administrativas
  action(sendWhatsAppTestMessage, {
    entities: ["User"],
  }),
  action(triggerAppointmentRemindersAction, {
    entities: ["Cita", "SyntheticPatient", "User"],
  }),
];
