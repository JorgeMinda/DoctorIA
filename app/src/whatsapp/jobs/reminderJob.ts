// Automated Appointment Reminders Job
// Envío proactivo de recordatorios interactivos 24 horas antes de la cita.

import { sendWhatsAppMessage } from "../services/whatsappGateway";

export async function runAppointmentReminders(args: any, context: any): Promise<{ sentCount: number; errors: number }> {
  const entities = context.entities;
  const now = new Date();
  // Rango de búsqueda: Citas entre 1 hora y 36 horas en el futuro
  const startWindow = new Date(now.getTime() + 1 * 60 * 60 * 1000);
  const endWindow = new Date(now.getTime() + 36 * 60 * 60 * 1000);

  const upcomingCitas = await entities.Cita.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: {
        gte: startWindow,
        lte: endWindow,
      },
    },
    include: {
      patient: true,
      medico: true,
    },
    orderBy: {
      scheduledAt: "asc",
    },
  });

  let sentCount = 0;
  let errors = 0;

  for (const cita of upcomingCitas) {
    const patientPhone = cita.patient?.phone;
    if (!patientPhone) continue;

    const patientName = `${cita.patient.firstName} ${cita.patient.lastName}`.trim();
    const doctorName = cita.medico?.fullName || "su médico tratante";
    const dateStr = new Date(cita.scheduledAt).toLocaleDateString("es-EC", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeStr = new Date(cita.scheduledAt).toLocaleTimeString("es-EC", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const reminderMessage = `🔔 *Recordatorio de Cita Médica — DoctorIA*

Hola ${patientName}, te recordamos tu próxima cita con el Dr. ${doctorName}:
📅 *Fecha:* ${dateStr}
⏰ *Hora:* ${timeStr}

Por favor, confirma tu asistencia respondiendo a este mensaje:
👉 Responde *1* para *CONFIRMAR* tu asistencia
👉 Responde *2* para *CANCELAR* tu cita`;

    const result = await sendWhatsAppMessage({
      to: patientPhone,
      text: reminderMessage,
    });

    if (result.success) {
      sentCount++;
    } else {
      errors++;
    }
  }

  console.info(`[WhatsApp Reminders] Ejecutado: ${sentCount} recordatorios enviados, ${errors} errores.`);
  return { sentCount, errors };
}
