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
