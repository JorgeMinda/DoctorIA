/**
 * Gestor de Intención de Agendamiento del Paciente (DoctorIA).
 * 
 * Permite persistir de forma segura y temporal la categoría/especialidad
 * seleccionada por el paciente antes de autenticarse o registrarse.
 * 
 * Invariantes de Seguridad y Calidad:
 * 1. Validación estricta contra PATIENT_ATTENTION_CATEGORIES.
 * 2. Se rechaza 'all' (no es una categoría de atención clínica agendable).
 * 3. TTL corto de 15 minutos para evitar intenciones zombis o desactualizadas.
 * 4. Almacenamiento aislado en sessionStorage (o memoria segura).
 */

import { PATIENT_ATTENTION_CATEGORIES } from "./patientCategories";

export const APPOINTMENT_INTENT_STORAGE_KEY = "doctoria_appointment_intent_v1";
export const APPOINTMENT_INTENT_TTL_MS = 15 * 60 * 1000; // 15 minutos

export interface StoredAppointmentIntent {
  categoryId: string;
  categoryLabel: string;
  timestamp: number;
}

/**
 * Guarda la intención de agendamiento si la categoría es válida.
 * Si categoryId es 'all' o no existe en el catálogo, no realiza acción.
 */
export function saveAppointmentIntent(
  categoryId: string,
  storage: Storage = typeof window !== "undefined" ? window.sessionStorage : (null as any),
): boolean {
  if (!storage || !categoryId || categoryId === "all") {
    return false;
  }

  const matched = PATIENT_ATTENTION_CATEGORIES.find((cat) => cat.id === categoryId);
  if (!matched) {
    return false;
  }

  const payload: StoredAppointmentIntent = {
    categoryId: matched.id,
    categoryLabel: matched.label,
    timestamp: Date.now(),
  };

  try {
    storage.setItem(APPOINTMENT_INTENT_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Obtiene la intención actual solo si es válida y no ha expirado su TTL.
 * Si ha expirado, limpia el almacenamiento automáticamente.
 */
export function getValidAppointmentIntent(
  storage: Storage = typeof window !== "undefined" ? window.sessionStorage : (null as any),
  now: number = Date.now(),
): StoredAppointmentIntent | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(APPOINTMENT_INTENT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredAppointmentIntent;
    if (!parsed || typeof parsed.categoryId !== "string" || typeof parsed.timestamp !== "number") {
      storage.removeItem(APPOINTMENT_INTENT_STORAGE_KEY);
      return null;
    }

    // Verificar TTL
    if (now - parsed.timestamp > APPOINTMENT_INTENT_TTL_MS || parsed.timestamp > now + 60000) {
      storage.removeItem(APPOINTMENT_INTENT_STORAGE_KEY);
      return null;
    }

    // Verificar que la categoría siga existiendo en el catálogo
    const exists = PATIENT_ATTENTION_CATEGORIES.some((c) => c.id === parsed.categoryId && c.id !== "all");
    if (!exists) {
      storage.removeItem(APPOINTMENT_INTENT_STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    try {
      storage.removeItem(APPOINTMENT_INTENT_STORAGE_KEY);
    } catch {}
    return null;
  }
}

/**
 * Elimina la intención almacenada (ej: tras ser consumida en el agendamiento).
 */
export function clearAppointmentIntent(
  storage: Storage = typeof window !== "undefined" ? window.sessionStorage : (null as any),
): void {
  if (!storage) return;
  try {
    storage.removeItem(APPOINTMENT_INTENT_STORAGE_KEY);
  } catch {}
}
