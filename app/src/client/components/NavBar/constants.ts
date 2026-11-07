import type { NavigationItem } from "./NavBar";

const staticNavigationItems: NavigationItem[] = [];

export const marketingNavigationItems: NavigationItem[] = [
  { name: "Iniciar Sesión", to: "/login" },
] as const;

export const clinicalNavigationItems: NavigationItem[] = [
  { name: "Pacientes", to: "/clinical/patients" },
] as const;
