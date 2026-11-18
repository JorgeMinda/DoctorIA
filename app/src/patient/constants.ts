/**
 * Constantes institucionales del Portal de Paciente (DoctorIA).
 * 
 * NOTA DE ARQUITECTURA:
 * 'location' y 'generalHours' NO existen como columnas en el esquema de la tabla User (schema.prisma).
 * Se centralizan como constantes estáticas institucionales hasta la migración posterior a 0.5.
 */

export const DEFAULT_CLINICAL_FACILITY = {
  location: "Sede Principal · Consulta Externa",
  generalHours: "Lunes a Viernes · 08:00 a 18:00",
} as const;

export const PUBLIC_DIRECTORY_LIMIT = 20;
export const PUBLIC_DIRECTORY_CACHE_TTL_MS = 60 * 1000; // 60 segundos

/**
 * Aviso institucional obligatorio y permanente de emergencias médicas (ECU 911).
 * Redacción editable sujeta a validación final de la clínica.
 */
export const EMERGENCY_ALERT_NOTICE = {
  badge: "Emergencias Médicas: Llama al 911",
  title: "Atención Inmediata de Urgencias y Emergencias",
  message: "Si presentas síntomas agudos con riesgo vital (dificultad respiratoria severa, dolor torácico opresivo, pérdida de conciencia o trauma grave), llama de inmediato al 911 (ECU 911) o acude a la sala de emergencias más cercana.",
  subtext: "DoctorIA está diseñada exclusivamente para consultas médicas externas programadas. La categoría de urgencias no admite agendamiento en línea por protocolos de triaje clínico.",
  phone: "911",
  callActionLabel: "Llamar al ECU 911",
} as const;

/**
 * Correspondencia explícita categoría → especialidades médicas.
 * Normalizada sin tildes ni mayúsculas.
 * 
 * Comportamiento de 'especialidades' (Otras Especialidades):
 * Cualquier especialidad activa que no coincida con general, odontologia,
 * pediatria o urgencias se clasifica determinísticamente aquí.
 */
export const CATEGORY_SPECIALTY_MAPPING: Record<string, string[]> = {
  general: [
    "medicina general",
    "medicina interna",
    "medicina familiar",
    "medico general",
    "medico internista",
    "medico familiar",
    "general",
    "internista",
    "familia",
  ],
  odontologia: [
    "odontologia",
    "odontologia general",
    "odontopediatria",
    "ortodoncia",
    "endodoncia",
    "periodoncia",
    "cirugia maxilofacial",
    "dental",
  ],
  pediatria: [
    "pediatria",
    "neonatologia",
    "pediatra",
  ],
  urgencias: [
    "urgencias",
    "emergencias",
    "medicina de emergencias",
    "medico de emergencias",
  ],
  especialidades: [], // Catch-all: cardiología, dermatología, neurología, etc.
};
