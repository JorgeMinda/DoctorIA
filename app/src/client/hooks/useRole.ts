import { useAuth } from "wasp/client/auth";

export type ClinicalRole = "admin" | "medico" | "secretaria";

export function useRole() {
  const { data: user, isLoading } = useAuth();

  const isAdmin = Boolean(user?.isAdmin && !user?.isMedico && !(user as any)?.isSecretaria);
  const isMedico = Boolean(user?.isMedico && !user?.isAdmin && !(user as any)?.isSecretaria);
  const isSecretaria = Boolean((user as any)?.isSecretaria && !user?.isAdmin && !user?.isMedico);

  let role: ClinicalRole | null = null;
  if (isAdmin) role = "admin";
  else if (isMedico) role = "medico";
  else if (isSecretaria) role = "secretaria";

  return {
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    isAdmin,
    isMedico,
    isSecretaria,
    role,
  };
}
