import { useAuth } from "wasp/client/auth";

export type ClinicalRole = "admin" | "medico" | "secretaria" | "paciente";

export function useRole() {
  const { data: user, isLoading } = useAuth();

  const isAdmin = Boolean(user?.isAdmin && !user?.isMedico && !(user as any)?.isSecretaria && !(user as any)?.isPaciente);
  const isMedico = Boolean(user?.isMedico && !user?.isAdmin && !(user as any)?.isSecretaria && !(user as any)?.isPaciente);
  const isSecretaria = Boolean((user as any)?.isSecretaria && !user?.isAdmin && !user?.isMedico && !(user as any)?.isPaciente);
  const isPaciente = Boolean((user as any)?.isPaciente && !user?.isAdmin && !user?.isMedico && !(user as any)?.isSecretaria);

  let role: ClinicalRole | null = null;
  if (isAdmin) role = "admin";
  else if (isMedico) role = "medico";
  else if (isSecretaria) role = "secretaria";
  else if (isPaciente) role = "paciente";

  return {
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    isAdmin,
    isMedico,
    isSecretaria,
    isPaciente,
    role,
  };
}
