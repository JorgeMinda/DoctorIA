// WhatsApp Queries (DoctorIA)

import { ensureAdmin } from "../clinical/services/guards";
import { getWhatsAppStatus, getWhatsAppQrCode } from "./services/whatsappGateway";

export const getWhatsAppConnectionInfo = async (_rawArgs: any, context: any) => {
  ensureAdmin(context.user);

  const status = await getWhatsAppStatus();
  const qrData = !status.connected ? await getWhatsAppQrCode() : { qr: null };

  const totalPatientsWithPhone = await context.entities.SyntheticPatient.count({
    where: { phone: { not: null }, isActive: true },
  });

  const scheduledCitasUpcoming = await context.entities.Cita.count({
    where: {
      status: "SCHEDULED",
      scheduledAt: { gte: new Date() },
    },
  });

  return {
    ...status,
    qrCode: qrData.qr,
    totalPatientsWithPhone,
    scheduledCitasUpcoming,
  };
};
