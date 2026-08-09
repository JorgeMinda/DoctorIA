import { Users, Settings, Shield } from "lucide-react";
import { routes } from "wasp/client/router";

export const userMenuItems = [
  {
    name: "Pacientes",
    to: routes.ClinicalPatientsRoute.to,
    icon: Users,
    isAdminOnly: false,
    isAuthRequired: true,
  },
  {
    name: "Cuenta",
    to: routes.AccountRoute.to,
    icon: Settings,
    isAuthRequired: false,
    isAdminOnly: false,
  },
  {
    name: "Administración",
    to: routes.ClinicalAdminRoute.to,
    icon: Shield,
    isAuthRequired: false,
    isAdminOnly: true,
  },
] as const;
