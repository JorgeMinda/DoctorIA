import { HttpError } from "wasp/server";
import type { AuthUser } from "wasp/auth";

// Roles funcionales DoctorIA (data-model.md §1, research R-02):
//   isAdmin=false + isMedico=false -> usuario autenticado sin acceso clínico
//   isAdmin=false + isMedico=true  -> Médico
//   isAdmin=true  + isMedico=false -> Administrador
//   isAdmin=true  + isMedico=true  -> INVÁLIDO (bloqueado por guards)

export function ensureMedico(user: AuthUser | null | undefined): AuthUser {
  if (!user) {
    throw new HttpError(401, "Debe iniciar sesión para acceder al módulo clínico");
  }
  if (!user.isMedico || user.isAdmin) {
    throw new HttpError(403, "Solo profesionales médicos habilitados pueden ejecutar esta operación");
  }
  return user;
}

export function ensureAdmin(user: AuthUser | null | undefined): AuthUser {
  if (!user) {
    throw new HttpError(401, "Debe iniciar sesión");
  }
  if (!user.isAdmin || user.isMedico) {
    throw new HttpError(403, "Solo administradores pueden ejecutar esta operación");
  }
  return user;
}

export function ensureAuthenticated(user: AuthUser | null | undefined): AuthUser {
  if (!user) {
    throw new HttpError(401, "Debe iniciar sesión");
  }
  return user;
}
