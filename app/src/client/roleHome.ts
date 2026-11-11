import type { ClinicalRole } from "./hooks/useRole";

/**
 * Destino seguro según rol para CTAs de marketing ("Comenzar", footer).
 * /clinical/voice es solo médico (RoleGuard) — sin sesión o con otro rol
 * el CTA nunca debe apuntar ahí para evitar el rebote a /clinical/patients.
 */
export function getRoleHomePath(role: ClinicalRole | null): string {
  switch (role) {
    case "medico":
      return "/clinical/voice";
    case "admin":
    case "secretaria":
      return "/clinical/patients";
    case "paciente":
      return "/patient/dashboard";
    default:
      return "/login";
  }
}
