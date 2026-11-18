import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { PublicPatientPortal, SpecialistAvatar } from "../../src/patient/pages/PublicPatientPortal";

// Mock de Wasp operations para controlar useQuery
const mockUseQuery = vi.fn();

vi.mock("wasp/client/operations", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  getPublicSpecialistsDirectory: "mock-operation-getPublicSpecialistsDirectory",
}));

describe("Portal Público del Paciente (F2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("SpecialistAvatar (Generador de iniciales local sin CDNs)", () => {
    it("extrae iniciales correctas ignorando títulos médicos comunes", () => {
      const html1 = renderToString(<SpecialistAvatar fullName="Dra. Laura Méndez" />);
      expect(html1).toContain("LM");

      const html2 = renderToString(<SpecialistAvatar fullName="Dr. Carlos Vega" />);
      expect(html2).toContain("CV");

      const html3 = renderToString(<SpecialistAvatar fullName="Lic. Sofía Alarcón" />);
      expect(html3).toContain("SA");
    });

    it("maneja nombres con una sola palabra o valores vacíos de forma segura", () => {
      const html1 = renderToString(<SpecialistAvatar fullName="Cardiólogo" />);
      expect(html1).toContain("CA");

      const html2 = renderToString(<SpecialistAvatar fullName="" />);
      expect(html2).toContain("MD");
    });
  });

  describe("Renderizado y Estados del Componente", () => {
    it("renderiza el esqueleto de carga cuando isLoading es true", () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      });

      const html = renderToString(
        <MemoryRouter>
          <PublicPatientPortal />
        </MemoryRouter>
      );

      // Verificación de a11y y estado ocupado
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain("Portal Oficial del Paciente");
      expect(html).toContain("Atención médica de calidad con");
    });

    it("renderiza estado de error neutro con botón de reintento si la consulta falla", () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error("Network timeout or 500 error"),
        refetch: vi.fn(),
      });

      const html = renderToString(
        <MemoryRouter>
          <PublicPatientPortal />
        </MemoryRouter>
      );

      // Nunca debe exponer el texto del error técnico
      expect(html).not.toContain("Network timeout or 500 error");
      expect(html).toContain("No pudimos cargar la lista de especialistas en este momento");
      expect(html).toContain("Reintentar");
    });

    it("renderiza el estado vacío seguro cuando no hay especialistas registrados", () => {
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      const html = renderToString(
        <MemoryRouter>
          <PublicPatientPortal />
        </MemoryRouter>
      );

      expect(html).toContain("Consulta Externa Disponible");
      expect(html).toContain("Horarios y especialidades disponibles para consulta externa");
      expect(html).toContain("Agendar en esta Especialidad");
      expect(html).toContain("Acceso Profesionales");
    });

    it("renderiza las cards completas con especialistas cuando hay datos", () => {
      const mockDoctors = [
        {
          fullName: "Dra. Laura Méndez",
          specialty: "Medicina Interna",
          location: "Sede Principal · Consulta Externa",
          generalHours: "Lunes a Viernes · 08:00 a 18:00",
        },
        {
          fullName: "Dr. Carlos Vega",
          specialty: "Cardiología",
          location: "Sede Principal · Consulta Externa",
          generalHours: "Lunes a Viernes · 08:00 a 18:00",
        },
      ];

      mockUseQuery.mockReturnValue({
        data: mockDoctors,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      const html = renderToString(
        <MemoryRouter>
          <PublicPatientPortal />
        </MemoryRouter>
      );

      expect(html).toContain("Dra. Laura Méndez");
      expect(html).toContain("Medicina Interna");
      expect(html).toContain("Dr. Carlos Vega");
      expect(html).toContain("Cardiología");
      expect(html).toContain("Sede Principal · Consulta Externa");
      expect(html).toContain("Lunes a Viernes · 08:00 a 18:00");
      expect(html).toContain("2 disponibles");

      // Verificación de ausencia estricta de campos privados
      expect(html).not.toContain("@doctoria");
      expect(html).not.toContain("uuid");
    });
  });
});
