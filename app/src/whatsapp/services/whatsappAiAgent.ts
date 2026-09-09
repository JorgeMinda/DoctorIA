// WhatsApp AI Receptionist Agent (DoctorIA)
// Automatización de agendamiento, disponibilidad, confirmaciones y cancelaciones 24/7.

import { env } from "wasp/server";
import {
  buildDaySlots,
  getOccupiedSlots,
  filterFreeSlots,
  validateNoOverlap,
} from "../../clinical/services/appointmentAvailability";
import { normalizePhoneNumber, sendWhatsAppMessage } from "./whatsappGateway";

export interface IncomingWhatsAppMessage {
  from: string; // Número del paciente remitente
  text: string; // Contenido del mensaje de texto
  name?: string; // Nombre del perfil de WhatsApp (pushName)
}

export interface AgentProcessResult {
  handled: boolean;
  intent: "AVAILABILITY" | "BOOK" | "CONFIRM" | "CANCEL" | "INFO" | "GREETING" | "UNKNOWN";
  replyText: string;
  citaId?: string;
  patientId?: string;
}

// Formateador amigable de fechas en español
function formatDateSpanish(date: Date): string {
  return date.toLocaleDateString("es-EC", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Busca o registra un paciente sintético / real según el número de WhatsApp.
 */
export async function findOrCreatePatientByPhone(
  entities: any,
  phone: string,
  suggestedName?: string,
): Promise<any> {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return null;

  // 1. Buscar si ya existe por teléfono
  let patient = await entities.SyntheticPatient.findFirst({
    where: {
      phone: { contains: normalized },
      isActive: true,
    },
  });

  if (patient) return patient;

  // 2. Si no existe, crear un nuevo paciente sintético inicial
  const count = await entities.SyntheticPatient.count();
  const nextNum = String(count + 1).padStart(3, "0");
  const syntheticId = `PAC-${nextNum}`;

  const nameParts = (suggestedName || "Paciente WhatsApp").trim().split(" ");
  const firstName = nameParts[0] || "Paciente";
  const lastName = nameParts.slice(1).join(" ") || "WhatsApp";

  // Fecha de nacimiento por defecto (hace 30 años) si no se conoce
  const defaultBirthDate = new Date();
  defaultBirthDate.setFullYear(defaultBirthDate.getFullYear() - 30);

  patient = await entities.SyntheticPatient.create({
    data: {
      syntheticId,
      firstName,
      lastName,
      birthDate: defaultBirthDate,
      sex: "O",
      phone: `+${normalized}`,
      tipoDocumento: "CEDULA",
      paisEmisor: "EC",
    },
  });

  return patient;
}

/**
 * Motor de Inteligencia Artificial para clasificar intención y extraer entidades del mensaje.
 */
export async function classifyIntentWithAI(
  userText: string,
  historyContext?: string,
): Promise<{
  intent: "AVAILABILITY" | "BOOK" | "CONFIRM" | "CANCEL" | "INFO" | "GREETING" | "UNKNOWN";
  dateISO?: string; // YYYY-MM-DD
  timeHHMM?: string; // HH:mm
  doctorName?: string;
  patientName?: string;
  reason?: string;
}> {
  const normalizedText = userText
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Atajos directos para respuestas rápidas de recordatorio
  if (normalizedText === "1" || normalizedText.includes("confirmo") || normalizedText.includes("si asistire")) {
    return { intent: "CONFIRM" };
  }
  if (normalizedText === "2" || normalizedText.includes("cancelo") || normalizedText.includes("cancelar") || normalizedText.includes("no podre")) {
    return { intent: "CANCEL" };
  }

  // Si hay OpenRouter configurado, clasificar con LLM
  const apiKey = (env as any).OPENROUTER_API_KEY;
  if (apiKey) {
    const todayISO = new Date().toISOString().slice(0, 10);
    const tomorrowISO = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const prompt = `Eres el clasificador de mensajes para la recepcionista IA de una clínica médica (DoctorIA).
Hoy es fecha ${todayISO}.
Analiza el mensaje del paciente y devuelve ÚNICAMENTE un JSON con esta estructura:
{
  "intent": "AVAILABILITY" | "BOOK" | "CONFIRM" | "CANCEL" | "INFO" | "GREETING" | "UNKNOWN",
  "dateISO": "YYYY-MM-DD o null si no se menciona",
  "timeHHMM": "HH:mm o null si no se menciona",
  "patientName": "nombre del paciente si lo menciona o null",
  "reason": "motivo de consulta si lo menciona o null"
}

Mensaje del paciente: "${userText}"`;

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: (env as any).OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const json = await response.json();
        const content = json?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          return {
            intent: parsed.intent || "UNKNOWN",
            dateISO: parsed.dateISO || undefined,
            timeHHMM: parsed.timeHHMM || undefined,
            patientName: parsed.patientName || undefined,
            reason: parsed.reason || undefined,
          };
        }
      }
    } catch {
      // Fallback a reglas deterministas si la API de IA no responde
    }
  }

  // Reglas deterministas de contingencia
  if (normalizedText.includes("hola") || normalizedText.includes("buenas") || normalizedText.includes("buenos")) {
    return { intent: "GREETING" };
  }
  if (normalizedText.includes("turno") || normalizedText.includes("hora") || normalizedText.includes("disponib") || normalizedText.includes("cuando tiene")) {
    return { intent: "AVAILABILITY" };
  }
  if (normalizedText.includes("agendar") || normalizedText.includes("separar") || normalizedText.includes("reservar") || normalizedText.includes("cita")) {
    return { intent: "BOOK" };
  }
  if (normalizedText.includes("donde") || normalizedText.includes("ubicacion") || normalizedText.includes("direccion") || normalizedText.includes("precio") || normalizedText.includes("costo")) {
    return { intent: "INFO" };
  }

  return { intent: "UNKNOWN" };
}

/**
 * Procesa un mensaje entrante de WhatsApp y genera la acción y respuesta correspondiente.
 */
export async function processIncomingWhatsAppMessage(
  entities: any,
  message: IncomingWhatsAppMessage,
): Promise<AgentProcessResult> {
  const { from, text, name } = message;
  const rawClean = text.trim();
  if (!rawClean) {
    return { handled: false, intent: "UNKNOWN", replyText: "" };
  }

  // 1. Identificar o registrar paciente
  const patient = await findOrCreatePatientByPhone(entities, from, name);
  const patientDisplayName = patient ? `${patient.firstName} ${patient.lastName}`.trim() : (name || "Estimado/a");

  // 2. Obtener médico principal / activo para agendamientos
  const defaultDoctor = await entities.User.findFirst({
    where: { isMedico: true, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  // 3. Clasificar intención
  const analysis = await classifyIntentWithAI(rawClean);

  // 4. Manejo según intención
  switch (analysis.intent) {
    case "GREETING": {
      const reply = `👋 ¡Hola ${patientDisplayName}! Te saluda el Asistente Virtual de DoctorIA 🩺.
¿En qué puedo ayudarte hoy?
1️⃣ Consultar horarios disponibles
2️⃣ Agendar una nueva cita
3️⃣ Confirmar o cancelar una cita existente
4️⃣ Información de ubicación y servicios`;
      await sendWhatsAppMessage({ to: from, text: reply });
      return { handled: true, intent: "GREETING", replyText: reply, patientId: patient?.id };
    }

    case "CONFIRM": {
      if (!patient) {
        const reply = "No encontramos un registro asociado a este número. Por favor indícanos tu nombre completo para asistirte.";
        await sendWhatsAppMessage({ to: from, text: reply });
        return { handled: true, intent: "CONFIRM", replyText: reply };
      }

      // Buscar próxima cita agendada
      const nextCita = await entities.Cita.findFirst({
        where: {
          patientId: patient.id,
          status: "SCHEDULED",
          scheduledAt: { gte: new Date() },
        },
        include: { medico: true },
        orderBy: { scheduledAt: "asc" },
      });

      if (!nextCita) {
        const reply = `Hola ${patientDisplayName}, no encontramos citas pendientes de confirmación para este número. Si deseas agendar una nueva consulta, solo avísanos.`;
        await sendWhatsAppMessage({ to: from, text: reply });
        return { handled: true, intent: "CONFIRM", replyText: reply, patientId: patient.id };
      }

      await entities.Cita.update({
        where: { id: nextCita.id },
        data: { status: "CONFIRMED" },
      });

      await entities.AuditLog.create({
        data: {
          userId: nextCita.medicoId,
          action: "CITA_CONFIRMED_WHATSAPP",
          details: JSON.stringify({ citaId: nextCita.id, phone: from }),
        },
      }).catch(() => null);

      const dateStr = formatDateSpanish(new Date(nextCita.scheduledAt));
      const timeStr = new Date(nextCita.scheduledAt).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
      const doctorName = nextCita.medico?.fullName || "su médico tratante";

      const reply = `✅ ¡Cita Confirmada!
Muchas gracias ${patientDisplayName}. Tu cita con el Dr. ${doctorName} para el ${dateStr} a las ${timeStr} ha quedado confirmada. ¡Te esperamos puntualmente!`;

      await sendWhatsAppMessage({ to: from, text: reply });
      return { handled: true, intent: "CONFIRM", replyText: reply, citaId: nextCita.id, patientId: patient.id };
    }

    case "CANCEL": {
      if (!patient) {
        const reply = "No encontramos citas activas asociadas a este número telefónico.";
        await sendWhatsAppMessage({ to: from, text: reply });
        return { handled: true, intent: "CANCEL", replyText: reply };
      }

      const nextCita = await entities.Cita.findFirst({
        where: {
          patientId: patient.id,
          status: { in: ["SCHEDULED", "CONFIRMED"] },
          scheduledAt: { gte: new Date() },
        },
        include: { medico: true },
        orderBy: { scheduledAt: "asc" },
      });

      if (!nextCita) {
        const reply = `Hola ${patientDisplayName}, no tienes citas pendientes por cancelar en este momento.`;
        await sendWhatsAppMessage({ to: from, text: reply });
        return { handled: true, intent: "CANCEL", replyText: reply, patientId: patient.id };
      }

      await entities.Cita.update({
        where: { id: nextCita.id },
        data: { status: "CANCELLED" },
      });

      await entities.AuditLog.create({
        data: {
          userId: nextCita.medicoId,
          action: "CITA_CANCELLED_WHATSAPP",
          details: JSON.stringify({ citaId: nextCita.id, phone: from }),
        },
      }).catch(() => null);

      const dateStr = formatDateSpanish(new Date(nextCita.scheduledAt));
      const timeStr = new Date(nextCita.scheduledAt).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });

      const reply = `❌ Tu cita del ${dateStr} a las ${timeStr} ha sido cancelada. El turno ha quedado libre. Cuando desees reagendar tu atención médica, estaremos a tu disposición.`;

      await sendWhatsAppMessage({ to: from, text: reply });
      return { handled: true, intent: "CANCEL", replyText: reply, citaId: nextCita.id, patientId: patient.id };
    }

    case "AVAILABILITY": {
      if (!defaultDoctor) {
        const reply = "En este momento no hay médicos activos registrados en la plataforma. Por favor intenta más tarde.";
        await sendWhatsAppMessage({ to: from, text: reply });
        return { handled: true, intent: "AVAILABILITY", replyText: reply };
      }

      // Fecha objetivo: analizada por IA o mañana por defecto
      const targetDate = analysis.dateISO || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const busy = await getOccupiedSlots({
        citaDelegate: entities.Cita,
        medicoId: defaultDoctor.id,
        dateISO: targetDate,
      });

      // Solo slots de horario laboral (08:00 a 18:00)
      const allSlots = buildDaySlots(30).filter((s) => {
        const h = parseInt(s.split(":")[0], 10);
        return h >= 8 && h < 18;
      });

      const freeSlots = filterFreeSlots(allSlots, targetDate, busy, 30, Date.now());

      let reply = "";
      if (freeSlots.length === 0) {
        reply = `Para la fecha ${targetDate} no disponemos de turnos libres con el Dr. ${defaultDoctor.fullName || "Médico"}. ¿Te gustaría consultar para el día siguiente?`;
      } else {
        const previewSlots = freeSlots.slice(0, 6).join(", ");
        reply = `📅 Horarios disponibles para el ${targetDate} (Dr. ${defaultDoctor.fullName || "Médico"}):\n👉 ${previewSlots}\n\nPara agendar, respóndeme con la hora que prefieres (ej: "Deseo a las ${freeSlots[0]}").`;
      }

      await sendWhatsAppMessage({ to: from, text: reply });
      return { handled: true, intent: "AVAILABILITY", replyText: reply, patientId: patient?.id };
    }

    case "BOOK": {
      if (!defaultDoctor || !patient) {
        const reply = "No fue posible procesar el agendamiento. Por favor comunícate directamente con recepción.";
        await sendWhatsAppMessage({ to: from, text: reply });
        return { handled: true, intent: "BOOK", replyText: reply };
      }

      // Si tenemos hora y fecha
      let targetDate = analysis.dateISO || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      let targetTime = analysis.timeHHMM;

      // Si no especificó hora en el texto, buscar disponibilidad y sugerir
      if (!targetTime) {
        // Buscar si escribió una hora simple como "10:00" o "15:30"
        const timeMatch = rawClean.match(/\b([01]?[0-9]|2[0-3]):([0-5][0-9])\b/);
        if (timeMatch) {
          targetTime = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
        }
      }

      if (!targetTime) {
        const reply = `Con gusto te agendamos, ${patientDisplayName}. ¿A qué hora te gustaría tu cita? (Ej: 09:00, 10:30, 15:00)`;
        await sendWhatsAppMessage({ to: from, text: reply });
        return { handled: true, intent: "BOOK", replyText: reply, patientId: patient.id };
      }

      const scheduledAt = new Date(`${targetDate}T${targetTime}:00.000Z`);

      try {
        await validateNoOverlap({
          citaDelegate: entities.Cita,
          medicoId: defaultDoctor.id,
          scheduledAt,
          durationMinutes: 30,
        });

        const newCita = await entities.Cita.create({
          data: {
            medicoId: defaultDoctor.id,
            patientId: patient.id,
            scheduledAt,
            durationMinutes: 30,
            status: "SCHEDULED",
            reason: analysis.reason || "Agendado vía WhatsApp AI",
          },
        });

        await entities.AuditLog.create({
          data: {
            userId: defaultDoctor.id,
            action: "CITA_CREATED_WHATSAPP",
            details: JSON.stringify({ citaId: newCita.id, patientId: patient.id, scheduledAt }),
          },
        }).catch(() => null);

        const dateStr = formatDateSpanish(scheduledAt);
        const reply = `🎉 ¡Cita agendada con éxito!
👤 Paciente: ${patientDisplayName}
👨‍⚕️ Médico: Dr. ${defaultDoctor.fullName || "Especialista"}
📅 Fecha: ${dateStr}
⏰ Hora: ${targetTime}

Te enviaremos un recordatorio previo a tu cita. ¡Gracias por confiar en DoctorIA!`;

        await sendWhatsAppMessage({ to: from, text: reply });
        return { handled: true, intent: "BOOK", replyText: reply, citaId: newCita.id, patientId: patient.id };
      } catch (err: any) {
        const reply = `El horario de las ${targetTime} para el ${targetDate} ya se encuentra ocupado. ¿Deseas consultar otros turnos disponibles?`;
        await sendWhatsAppMessage({ to: from, text: reply });
        return { handled: true, intent: "BOOK", replyText: reply, patientId: patient.id };
      }
    }

    case "INFO": {
      const reply = `🏥 *DoctorIA — Centro Clínico*
📍 Dirección: Av. Principal y Consulta Médica
⏰ Horario de Atención: Lunes a Viernes de 08:00 a 18:00
🩺 Servicios: Consulta General, Especialidades, Telemedicina y Gestión de Citas.

¿Te gustaría agendar una cita o consultar disponibilidad?`;
      await sendWhatsAppMessage({ to: from, text: reply });
      return { handled: true, intent: "INFO", replyText: reply, patientId: patient?.id };
    }

    default: {
      const reply = `Hola ${patientDisplayName}, soy el Asistente Virtual de DoctorIA. Puedes escribirme para consultar turnos (ej. "Horarios disponibles mañana"), agendar una cita o confirmar tu asistencia. ¿En qué te ayudo?`;
      await sendWhatsAppMessage({ to: from, text: reply });
      return { handled: true, intent: "UNKNOWN", replyText: reply, patientId: patient?.id };
    }
  }
}
