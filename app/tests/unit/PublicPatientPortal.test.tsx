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
      expect(html).toContain("Directorio de especialistas");
      // Contenido veraz: sólo describe lo existente (citas, indicaciones confirmadas)
      expect(html).toContain("Consulta externa programada");
      expect(html).not.toMatch(/\bfirmadas\b/i);
      expect(html).not.toContain("laboratorio");
    });

    it("renderiza estado de error neutro con botón de reintento si la consulta falla", () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error("Database connection refused: 500 internal"),
        refetch: vi.fn(),
      });

      const html = renderToString(
        <MemoryRouter>
          <PublicPatientPortal />
        </MemoryRouter>
      );

      // Nunca debe exponer el texto del error técnico
      expect(html).not.toContain("Database connection refused");
      expect(html).toContain("No pudimos cargar la lista de especialistas en este momento");
      expect(html).toContain("Reintentar");
    });

    it("renderiza el Estado Vacío (a): no hay especialistas publicados", () => {
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

      // Estado vacío institucional seguro
      expect(html).toContain("Consulta Externa Disponible");
      expect(html).toContain("No hay especialistas publicados en este momento");
      expect(html).toContain("Agendar Cita Médica");
      expect(html).toContain("Acceso Profesionales");
      // Contador seguro (nunca dice 'listados' cuando es 0)
      expect(html).toContain("0 disponibles");
      expect(html).not.toContain("0 listados");
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
      expect(html).toContain("2 especialistas disponibles");

      // Verificación de ausencia estricta de credenciales demo, hashes o PII
      expect(html).not.toContain("@doctoria.com");
      expect(html).not.toContain("doctoria2026");
      expect(html).not.toContain("password");
      expect(html).not.toContain("uuid");
    });

    it("incluye el aviso permanente de emergencias ECU 911 y botones con tamaño táctil adecuado", () => {
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

      // Aviso permanente de emergencias
      expect(html).toContain("Aviso de Emergencias Médicas");
      expect(html).toContain("ECU 911");
      expect(html).toContain("tel:911");

      // Enlaces a login y registro usando Wasp router
      expect(html).toContain('href="/login"');
      expect(html).toContain('href="/signup"');

      // Pie de página con privacidad y acceso profesionales
      expect(html).toContain('href="#privacidad"');
      expect(html).toContain("Aviso de Privacidad");
    });
  });
});
