import { HttpError } from "wasp/server";
import type { AuthUser } from "wasp/auth";

// Roles funcionales DoctorIA (data-model.md §1, research R-02):
// Mutuamente excluyentes — exactamente UN flag en true:
//   isAdmin=true                      -> Administrador
//   isMedico=true                     -> Médico
//   isSecretaria=true                 -> Secretaria clínica
//   ninguno                           -> usuario autenticado sin acceso clínico
// Cualquier combinación de ≥2 flags es INVÁLIDA y bloqueada por guards.
//
// R2 (soft delete): un usuario con isActive=false PUEDE autenticar, pero todos
// los guards clínicos lo rechazan con 403 hasta que el admin lo reactive.

export type ClinicalRole = "admin" | "medico" | "secretaria";

const INACTIVE_MESSAGE =
  "Usuario inactivo. Contacte al administrador para reactivar su cuenta.";

// Lanza 401 si no hay sesión y 403 si la cuenta está desactivada (R2).
// Ausencia del campo (undefined) se trata como activo por compatibilidad.
function requireActiveAuthenticated(
  user: AuthUser | null | undefined,
): AuthUser {
  if (!user) {
    throw new HttpError(401, "Debe iniciar sesión");
  }
  if ((user as any).isActive === false) {
    throw new HttpError(403, INACTIVE_MESSAGE);
  }
  return user;
}

// Devuelve el ÚNICO rol activo del usuario, o null si no tiene ninguno o si
// tiene una combinación inválida de flags (≥2).
export function getActiveClinicalRole(
  user: AuthUser | null | undefined,
): ClinicalRole | null {
  if (!user) return null;
  const roles: ClinicalRole[] = [];
  if (user.isAdmin) roles.push("admin");
  if (user.isMedico) roles.push("medico");
  if ((user as any).isSecretaria) roles.push("secretaria");
  if (roles.length !== 1) return null;
  return roles[0];
}

// Guard genérico: exige sesión activa y que el único rol del usuario esté
// entre los permitidos para la operación.
export function ensureRole(
  user: AuthUser | null | undefined,
  ...allowed: ClinicalRole[]
): AuthUser {
  const u = requireActiveAuthenticated(user);
  const role = getActiveClinicalRole(u);
  if (!role || !allowed.includes(role)) {
    throw new HttpError(403, "Rol inválido para esta operación");
  }
  return u;
}

export function ensureMedico(user: AuthUser | null | undefined): AuthUser {
  const u = requireActiveAuthenticated(user);
  if (
    !u.isMedico ||
    u.isAdmin ||
    (u as any).isSecretaria
  ) {
    throw new HttpError(
      403,
      "Solo profesionales médicos habilitados pueden ejecutar esta operación",
    );
  }
  return u;
}

// Visualización de pacientes: médico, secretaria y admin. El médico ve solo
// pacientes autorizados; secretaria/admin ven el universo activo.
export function ensurePatientViewer(
  user: AuthUser | null | undefined,
): AuthUser {
  return ensureRole(user, "admin", "medico", "secretaria");
}

export function ensureAdmin(user: AuthUser | null | undefined): AuthUser {
  const u = requireActiveAuthenticated(user);
  if (!u.isAdmin || u.isMedico || (u as any).isSecretaria) {
    throw new HttpError(403, "Solo administradores pueden ejecutar esta operación");
  }
  return u;
}

export function ensureSecretaria(user: AuthUser | null | undefined): AuthUser {
  const u = requireActiveAuthenticated(user);
  if (!(u as any).isSecretaria || u.isAdmin || u.isMedico) {
    throw new HttpError(
      403,
      "Solo personal de secretaría puede ejecutar esta operación",
    );
  }
  return u;
}

// Personal clínico operativo: médico o secretaria (sin admin). Útil para
// registro de signos vitales y gestión administrativa de agenda.
export function ensureClinicalStaff(
  user: AuthUser | null | undefined,
): AuthUser {
  return ensureRole(user, "medico", "secretaria");
}

// Médico O secretaria (sin admin). Acceso combinado para registro pre-clínico,
// visualización de pre-clínico y epicrisis. RBAC estricto: admin es rol
// separado y NO entra aquí (defensa en profundidad; coherente con
// createVitalSignAction, que tampoco admite admin).
export function ensureSecretariaOrMedico(
  user: AuthUser | null | undefined,
): AuthUser {
  return ensureRole(user, "medico", "secretaria");
}

// Sesión válida (sin chequeo de rol ni de estado): solo autenticación.
// NO usar para operaciones clínicas — usar ensureRole/guards específicos.
export function ensureAuthenticated(user: AuthUser | null | undefined): AuthUser {
  if (!user) {
    throw new HttpError(401, "Debe iniciar sesión");
  }
  return user;
}
