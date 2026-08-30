import {
  CalendarDays,
  Mic,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface ClinicalNavItem {
  name: string;
  to: string;
  icon: LucideIcon;
}

export interface ClinicalNavGroup {
  label: string;
  items: ClinicalNavItem[];
}

import type { ClinicalRole } from "../../hooks/useRole";

export const clinicalNavGroups: ClinicalNavGroup[] = [
  {
    label: "Clínica",
    items: [
      { name: "Pacientes", to: "/clinical/patients", icon: Users },
      { name: "Mi agenda", to: "/clinical/agenda", icon: CalendarDays },
      { name: "Asistente de voz", to: "/clinical/voice", icon: Mic },
    ],
  },
  {
    label: "Gestión",
    items: [
      { name: "Auditoría", to: "/clinical/audit", icon: ScrollText },
      { name: "Administración", to: "/clinical/admin", icon: Settings },
    ],
  },
];

export function getNavGroupsForRole(role: ClinicalRole | null): ClinicalNavGroup[] {
  if (!role) return [];

  if (role === "medico") {
    return [
      {
        label: "Clínica",
        items: [
          { name: "Pacientes", to: "/clinical/patients", icon: Users },
          { name: "Mi agenda", to: "/clinical/agenda", icon: CalendarDays },
          { name: "Asistente de voz", to: "/clinical/voice", icon: Mic },
        ],
      },
      {
        label: "Gestión",
        items: [{ name: "Auditoría", to: "/clinical/audit", icon: ScrollText }],
      },
    ];
  }

  if (role === "secretaria") {
    return [
      {
        label: "Atención",
        items: [
          { name: "Pacientes", to: "/clinical/patients", icon: Users },
          { name: "Gestión de citas", to: "/clinical/agenda", icon: CalendarDays },
        ],
      },
      {
        label: "Gestión",
        items: [{ name: "Auditoría", to: "/clinical/audit", icon: ScrollText }],
      },
    ];
  }

  if (role === "paciente") {
    return [
      {
        label: "Mi Salud",
        items: [
          { name: "Mi Portal", to: "/patient/dashboard", icon: Users },
        ],
      },
    ];
  }

  // Admin
  return [
    {
      label: "Clínica",
      items: [
        { name: "Pacientes", to: "/clinical/patients", icon: Users },
        { name: "Gestión de citas", to: "/clinical/agenda", icon: CalendarDays },
      ],
    },
    {
      label: "Gestión",
      items: [
        { name: "Auditoría", to: "/clinical/audit", icon: ScrollText },
        { name: "Administración", to: "/clinical/admin", icon: Settings },
      ],
    },
  ];
}

export function isClinicalNavItemActive(pathname: string, to: string): boolean {
  if (to === "/clinical/patients") {
    return (
      pathname === "/clinical/patients" ||
      pathname.startsWith("/clinical/patients/") ||
      pathname.startsWith("/clinical/notes/") ||
      pathname.startsWith("/clinical/epicrises/")
    );
  }
  return pathname === to || pathname.startsWith(to + "/");
}

export function getClinicalSectionTitle(pathname: string): string {
  if (pathname.startsWith("/clinical/patients/")) {
    return "Detalle del paciente";
  }
  if (pathname.startsWith("/clinical/notes/")) {
    return "Nota clínica";
  }
  if (pathname.startsWith("/clinical/epicrises/")) {
    return "Epicrisis";
  }
  const found = clinicalNavGroups
    .flatMap((group) => group.items)
    .find((item) => isClinicalNavItemActive(pathname, item.to));
  return found?.name ?? "DoctorIA";
}
