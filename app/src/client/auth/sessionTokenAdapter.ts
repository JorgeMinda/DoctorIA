/**
 * Adaptador de lectura de Token de Sesión en Cliente (DoctorIA / Wasp).
 * 
 * Permite detectar de forma síncrona en 0 milisegundos si el dispositivo
 * tiene una sesión almacenada localmente antes de disparar llamadas de red
 * a endpoints de autenticación (/auth/me).
 * 
 * Invariantes:
 * 1. Clave canónica de Wasp: 'wasp:sessionId' (definida en wasp/core/storage.ts).
 * 2. Cero excepciones ante bloqueo de cookies o modo incógnito restrictivo.
 * 3. Admite inyección de storage para testing determinista.
 */

export const WASP_SESSION_STORAGE_KEY = "wasp:sessionId";

/**
 * Obtiene el storage de forma segura si el entorno es navegador.
 */
function getSafeLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Retorna true si existe un token de sesión no vacío guardado en el navegador.
 */
export function hasStoredSessionToken(storage: Storage | null = getSafeLocalStorage()): boolean {
  if (!storage) return false;
  try {
    const value = storage.getItem(WASP_SESSION_STORAGE_KEY);
    if (!value) return false;

    // Wasp almacena valores con JSON.stringify; verificamos si es string plano o JSON
    const trimmed = value.trim();
    if (!trimmed || trimmed === "null" || trimmed === '""') return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Retorna el valor bruto del token de sesión si existe, o null.
 */
export function getStoredSessionToken(storage: Storage | null = getSafeLocalStorage()): string | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(WASP_SESSION_STORAGE_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string" && parsed.trim().length > 0) {
        return parsed.trim();
      }
    } catch {
      // Si no era JSON, se usa el valor trimmed directamente
    }

    const trimmed = raw.trim();
    return trimmed.length > 0 && trimmed !== "null" ? trimmed : null;
  } catch {
    return null;
  }
}
