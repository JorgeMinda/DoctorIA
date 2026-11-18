import type { ClinicalRole } from "./hooks/useRole";

/**
 * Destino seguro según rol para redirecciones y CTAs.
 * 
 * Reglas de enrutamiento institucional:
 * - médico → /clinical/voice
 * - admin / secretaria → /clinical/patients
 * - paciente → /patient/dashboard
 * - autenticado sin rol clínico activo → /pending-activation (Decisión 4)
 * - anónimo (sin sesión) → /login
 */
export function getRoleHomePath(
  role: ClinicalRole | null,
  isAuthenticated?: boolean,
): string {
  switch (role) {
    case "medico":
      return "/clinical/voice";
    case "admin":
    case "secretaria":
      return "/clinical/patients";
    case "paciente":
      return "/patient/dashboard";
    default:
      if (isAuthenticated === true) {
        return "/pending-activation";
      }
      return "/login";
  }
}
