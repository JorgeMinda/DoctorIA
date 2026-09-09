// WhatsApp Admin Actions (DoctorIA)

import { HttpError } from "wasp/server";
import { ensureAdmin } from "../clinical/services/guards";
import { sendWhatsAppMessage } from "./services/whatsappGateway";
import { runAppointmentReminders } from "./jobs/reminderJob";

export const sendWhatsAppTestMessage = async (rawArgs: any, context: any) => {
  ensureAdmin(context.user);

  const phone = rawArgs?.phone;
  const message = rawArgs?.message || "Hola, este es un mensaje de prueba desde DoctorIA 🩺.";

  if (!phone) {
    throw new HttpError(400, "El número de teléfono es requerido");
  }

  const result = await sendWhatsAppMessage({
    to: phone,
    text: message,
  });

  if (!result.success) {
    throw new HttpError(500, "No se pudo enviar el mensaje al Gateway de WhatsApp");
  }

  return { success: true, messageId: result.messageId };
};

export const triggerAppointmentRemindersAction = async (_rawArgs: any, context: any) => {
  ensureAdmin(context.user);

  const summary = await runAppointmentReminders({}, context);
  return summary;
};
