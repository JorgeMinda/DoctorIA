import {
  Activity,
  ClipboardList,
  FileText,
  KeyRound,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Stamp,
  UserRound,
} from "lucide-react";
import avatarPlaceholder from "../client/static/avatar-placeholder.webp";
import type { GridFeature } from "./components/FeaturesGrid";

export const features: GridFeature[] = [
  {
    name: "Historia clínica estructurada",
    description: "Notas clínicas organizadas por secciones: motivo, antecedentes, evolución y plan.",
    icon: <ClipboardList className="size-5" />,
    href: "#features",
    size: "medium",
  },
  {
    name: "IA que estructura el texto",
    description: "Convierte el texto libre del médico en una nota clínica estructurada y validada.",
    icon: <Sparkles className="size-5" />,
    href: "#features",
    size: "medium",
  },
  {
    name: "Epicrisis asistida",
    description: "Genera borradores de epicrisis a partir de las notas y eventos del paciente.",
    icon: <FileText className="size-5" />,
    href: "#features",
    size: "large",
  },
  {
    name: "Acceso controlado por rol",
    description: "RBAC con roles de médico y administrador sobre cada paciente.",
    icon: <KeyRound className="size-5" />,
    href: "#features",
    size: "medium",
  },
  {
    name: "Pacientes sintéticos",
    description: "Datos de demostración ficticios (PAC-NNN) que garantizan cero PII real.",
    icon: <UserRound className="size-5" />,
    href: "#features",
    size: "large",
  },
  {
    name: "Auditoría completa",
    description: "Cada acción clínica queda registrada y trazable en el AuditLog.",
    icon: <ShieldCheck className="size-5" />,
    href: "#features",
    size: "small",
  },
  {
    name: "Búsqueda de pacientes",
    description: "Encuentra pacientes por nombre o ID sintético con paginación.",
    icon: <ScanSearch className="size-5" />,
    href: "#features",
    size: "small",
  },
  {
    name: "Borradores y confirmación",
    description: "Flujo de edición en borrador con confirmación final de la nota.",
    icon: <Stamp className="size-5" />,
    href: "#features",
    size: "medium",
  },
  {
    name: "Adendas trazables",
    description: "Correcciones posteriores registradas sin alterar el contenido original.",
    icon: <Activity className="size-5" />,
    href: "#features",
    size: "medium",
  },
];

export const testimonials = [
  {
    name: "Dra. Laura Méndez",
    role: "Medicina Interna",
    avatarSrc: avatarPlaceholder,
    socialUrl: "#",
    quote:
      "La IA me ahorra tiempo: dicto la evolución y DoctorIA la estructura en la nota clínica al instante.",
  },
  {
    name: "Dr. Carlos Vega",
    role: "Cardiología",
    avatarSrc: avatarPlaceholder,
    socialUrl: "#",
    quote:
      "Las epicrisis asistidas salen listas para revisión. Solo valido los campos y confirmo.",
  },
  {
    name: "Dra. Sofía Herrera",
    role: "Pediatría",
    avatarSrc: avatarPlaceholder,
    socialUrl: "#",
    quote:
      "La auditoría me da tranquilidad: sé exactamente quién tocó cada historia y cuándo.",
  },
];

export const faqs = [
  {
    id: 1,
    question: "¿Qué es DoctorIA?",
    answer:
      "DoctorIA es una plataforma clínica que estructura el trabajo del médico: historias clínicas, notas por secciones, epicrisis asistidas por IA y auditoría de cada acción.",
  },
  {
    id: 2,
    question: "¿DoctorIA maneja datos reales de pacientes?",
    answer:
      "No en el entorno de demostración. El MVP opera exclusivamente con pacientes sintéticos (PAC-NNN) para garantizar cero PII real.",
  },
  {
    id: 3,
    question: "¿La IA reemplaza el criterio médico?",
    answer:
      "No. La IA solo propone una estructura a partir del texto del profesional; el médico revisa, edita y confirma cada documento antes de que quede validado.",
  },
  {
    id: 4,
    question: "¿Quién puede acceder a una historia clínica?",
    answer:
      "Solo médicos autorizados mediante la gestión de accesos médico-paciente. Todo acceso y modificación queda registrado en el AuditLog.",
  },
  {
    id: 5,
    question: "¿Puedo corregir una nota ya confirmada?",
    answer:
      "Sí. Las correcciones posteriores se registran como adendas, preservando el contenido original y manteniendo la trazabilidad clínica.",
  },
];

export const footerNavigation = {
  app: [
    { name: "Iniciar sesión", href: "/login" },
    { name: "Registrarse", href: "/signup" },
    { name: "Pacientes", href: "/clinical/patients" },
  ],
  company: [
    { name: "DoctorIA", href: "/" },
    { name: "Documentación", href: "https://wasp.sh/docs" },
  ],
};
