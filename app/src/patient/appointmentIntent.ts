/**
 * Gestor de Intención de Agendamiento del Paciente (DoctorIA).
 * 
 * Justificación Técnica de Almacenamiento (Requisito 5):
 * Se utiliza 'localStorage' con caducidad corta (15 minutos) en lugar de 'sessionStorage'
 * debido a que el flujo de registro de usuarios en DoctorIA exige verificación de correo electrónico
 * (EmailVerificationRoute). Cuando el paciente hace clic en el enlace recibido en su cliente de correo
 * (Gmail, Outlook, etc.), el navegador abre una PESTAÑA NUEVA. 'sessionStorage' está estrictamente
 * aislado por pestaña y se perdería en la nueva pestaña de verificación, mientras que 'localStorage'
 * persiste entre pestañas del mismo origen y permite recuperar la intención tras verificar la cuenta.
 * 
 * Invariantes de Seguridad y Calidad:
 * 1. Validación estricta del ID contra PATIENT_ATTENTION_CATEGORIES (no texto libre).
 * 2. Se rechaza 'all' (no es categoría clínica agendable).
 * 3. Se rechaza 'urgencias' (protocolo hospitalario: no admite agendamiento web).
 * 4. Caducidad corta: 15 minutos (900.000 ms).
 * 5. Consumo de un solo uso (single-use): al ser recuperada para agendar, se purga de inmediato.
 */

import { PATIENT_ATTENTION_CATEGORIES } from "./patientCategories";

export const APPOINTMENT_INTENT_STORAGE_KEY = "doctoria_appointment_intent_v1";
export const APPOINTMENT_INTENT_TTL_MS = 15 * 60 * 1000; // 15 minutos

export interface StoredAppointmentIntent {
  categoryId: string;
  categoryLabel: string;
  timestamp: number;
}

function getSafeLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Guarda la intención de agendamiento si el id de categoría es válido y agendable.
 */
export function saveAppointmentIntent(
  categoryId: string,
  storage: Storage | null = getSafeLocalStorage(),
): boolean {
  if (!storage || !categoryId || categoryId === "all" || categoryId === "urgencias") {
    return false;
  }

  // Validación estricta: debe existir exactamente en el catálogo oficial
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
 * Inspecciona la intención actual sin eliminarla (solo si es válida y no ha expirado).
 */
export function peekAppointmentIntent(
  storage: Storage | null = getSafeLocalStorage(),
  now: number = Date.now(),
): StoredAppointmentIntent | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(APPOINTMENT_INTENT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredAppointmentIntent;
    if (
      !parsed ||
      typeof parsed.categoryId !== "string" ||
      typeof parsed.timestamp !== "number"
    ) {
      storage.removeItem(APPOINTMENT_INTENT_STORAGE_KEY);
      return null;
    }

    // Verificar TTL (15 minutos)
    if (now - parsed.timestamp > APPOINTMENT_INTENT_TTL_MS || parsed.timestamp > now + 60000) {
      storage.removeItem(APPOINTMENT_INTENT_STORAGE_KEY);
      return null;
    }

    // Verificar que la categoría sea válida y agendable
    const exists = PATIENT_ATTENTION_CATEGORIES.some(
      (c) => c.id === parsed.categoryId && c.id !== "all" && c.id !== "urgencias"
    );
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
 * Consume la intención de agendamiento (un solo uso): la retorna y la borra inmediatamente del almacenamiento.
 */
export function consumeAppointmentIntent(
  storage: Storage | null = getSafeLocalStorage(),
  now: number = Date.now(),
): StoredAppointmentIntent | null {
  const intent = peekAppointmentIntent(storage, now);
  if (intent && storage) {
    try {
      storage.removeItem(APPOINTMENT_INTENT_STORAGE_KEY);
    } catch {}
  }
  return intent;
}

/**
 * Elimina manualmente la intención almacenada.
 */
export function clearAppointmentIntent(
  storage: Storage | null = getSafeLocalStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(APPOINTMENT_INTENT_STORAGE_KEY);
  } catch {}
}
