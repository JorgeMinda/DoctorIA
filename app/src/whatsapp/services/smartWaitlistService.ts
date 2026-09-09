// Smart Waitlist & Auto Re-engagement Service (DoctorIA)
// Notificación proactiva por WhatsApp a pacientes en espera cuando se cancela una cita.

import { sendWhatsAppMessage } from "./whatsappGateway";

export interface WaitlistEntry {
  id: string;
  patientId: string;
  patientName: string;
  phone: string;
  medicoId: string;
  preferredDateISO: string;
  createdAt: Date;
  status: "WAITING" | "OFFERED" | "ACCEPTED" | "EXPIRED";
  offeredCitaSlot?: Date;
}

// Registro en memoria de lista de espera para re-enganche rápido
const activeWaitlist: Map<string, WaitlistEntry> = new Map();

/**
 * Registra a un paciente en la lista de espera para un médico y fecha determinada.
 */
export function registerPatientInWaitlist(entry: Omit<WaitlistEntry, "id" | "createdAt" | "status">): WaitlistEntry {
  const id = `wl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newEntry: WaitlistEntry = {
    ...entry,
    id,
    createdAt: new Date(),
    status: "WAITING",
  };
  activeWaitlist.set(id, newEntry);
  return newEntry;
}

/**
 * Obtiene todas las entradas activas de la lista de espera.
 */
export function getActiveWaitlistEntries(): WaitlistEntry[] {
  return Array.from(activeWaitlist.values()).filter((e) => e.status === "WAITING" || e.status === "OFFERED");
}

/**
 * Se dispara automáticamente cuando una cita es cancelada.
 * Busca pacientes en lista de espera para ese médico y fecha, y les envía una oferta por WhatsApp.
 */
export async function notifyWaitlistOnSlotFreed(params: {
  entities: any;
  medicoId: string;
  freedScheduledAt: Date;
  doctorName: string;
}): Promise<{ notifiedCount: number; candidate?: WaitlistEntry }> {
  const { entities, medicoId, freedScheduledAt, doctorName } = params;
  const dateISO = new Date(freedScheduledAt).toISOString().slice(0, 10);
  const timeStr = new Date(freedScheduledAt).toLocaleTimeString("es-EC", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = new Date(freedScheduledAt).toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // 1. Buscar en lista de espera explícita
  let candidates = Array.from(activeWaitlist.values()).filter(
    (w) => w.medicoId === medicoId && w.preferredDateISO === dateISO && w.status === "WAITING",
  );

  // 2. Si no hay lista explícita, buscar pacientes con citas posteriores (más lejos en el tiempo) que podrían querer adelantar
  let targetEntry: WaitlistEntry | null = candidates[0] || null;

  if (!targetEntry) {
    const nextPatientCita = await entities.Cita.findFirst({
      where: {
        medicoId,
        status: "SCHEDULED",
        scheduledAt: { gt: new Date(freedScheduledAt.getTime() + 24 * 60 * 60 * 1000) },
      },
      include: { patient: true },
      orderBy: { scheduledAt: "asc" },
    });

    if (nextPatientCita?.patient?.phone) {
      targetEntry = {
        id: `auto-reengage-${nextPatientCita.id}`,
        patientId: nextPatientCita.patient.id,
        patientName: `${nextPatientCita.patient.firstName} ${nextPatientCita.patient.lastName}`.trim(),
        phone: nextPatientCita.patient.phone,
        medicoId,
        preferredDateISO: dateISO,
        createdAt: new Date(),
        status: "WAITING",
      };
    }
  }

  if (!targetEntry) {
    return { notifiedCount: 0 };
  }

  // Marcar como ofrecido
  targetEntry.status = "OFFERED";
  targetEntry.offeredCitaSlot = freedScheduledAt;
  activeWaitlist.set(targetEntry.id, targetEntry);

  const proactiveMessage = `🔔 *¡Turno Liberado en DoctorIA!*

Hola ${targetEntry.patientName}, se acaba de liberar un turno con el Dr. ${doctorName}:
📅 *Fecha:* ${dateStr}
⏰ *Hora:* ${timeStr}

¿Deseas tomar este turno más temprano?
👉 Responde *1* para *AGENDARLO DE INMEDIATO*
👉 Responde *2* para mantener tu horario actual`;

  const result = await sendWhatsAppMessage({
    to: targetEntry.phone,
    text: proactiveMessage,
  });

  if (result.success) {
    await entities.AuditLog.create({
      data: {
        userId: medicoId,
        action: "WAITLIST_SLOT_OFFERED_WHATSAPP",
        details: JSON.stringify({
          patientId: targetEntry.patientId,
          freedScheduledAt,
          phone: targetEntry.phone,
        }),
      },
    }).catch(() => null);

    return { notifiedCount: 1, candidate: targetEntry };
  }

  return { notifiedCount: 0 };
}
