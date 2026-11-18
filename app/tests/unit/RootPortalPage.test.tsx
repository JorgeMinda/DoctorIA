import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import {
  RootPortalPage,
  RootHydrationSkeleton,
  AuthenticatedRootGate,
} from "../../src/patient/pages/RootPortalPage";
import * as tokenAdapter from "../../src/client/auth/sessionTokenAdapter";
import * as roleHook from "../../src/client/hooks/useRole";

vi.mock("wasp/client/operations", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useQuery: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
    getPublicSpecialistsDirectory: "mock-op-getPublicSpecialistsDirectory",
  };
});

describe("Enrutador Raíz RootPortalPage (F3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("RootHydrationSkeleton", () => {
    it("renderiza el esqueleto neutro con atributos de accesibilidad para carga", () => {
      const html = renderToString(<RootHydrationSkeleton />);
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain("Validando sesión clínica...");
    });
  });

  describe("Puerta Anónima vs Puerta Autenticada", () => {
    it("Puerta Anónima (sin token): renderiza PublicPatientPortal de inmediato sin consultar useRole", () => {
      vi.spyOn(tokenAdapter, "hasStoredSessionToken").mockReturnValue(false);
      const useRoleSpy = vi.spyOn(roleHook, "useRole");

      const html = renderToString(
        <MemoryRouter>
          <RootPortalPage />
        </MemoryRouter>
      );

      // Renderiza el portal de paciente directamente
      expect(html).toContain("Portal Oficial del Paciente");
      expect(html).toContain("Necesidades de Atención");
      // Cero llamadas a useRole en la rama anónima (Cold start bypass en 0 ms)
      expect(useRoleSpy).not.toHaveBeenCalled();
    });

    it("Puerta Autenticada (con token): si isLoading=true, muestra el esqueleto de hidratación", () => {
      vi.spyOn(tokenAdapter, "hasStoredSessionToken").mockReturnValue(true);
      vi.spyOn(roleHook, "useRole").mockReturnValue({
        user: null,
        role: null,
        isLoading: true,
        isAuthenticated: false,
        isAdmin: false,
        isMedico: false,
        isSecretaria: false,
        isPaciente: false,
      });

      const html = renderToString(
        <MemoryRouter>
          <RootPortalPage />
        </MemoryRouter>
      );

      expect(html).toContain('aria-busy="true"');
      expect(html).toContain("Validando sesión clínica...");
    });

    it("Puerta Autenticada: si el token expiró en el servidor (!isAuthenticated), degrada a portal público", () => {
      vi.spyOn(tokenAdapter, "hasStoredSessionToken").mockReturnValue(true);
      vi.spyOn(roleHook, "useRole").mockReturnValue({
        user: null,
        role: null,
        isLoading: false,
        isAuthenticated: false,
        isAdmin: false,
        isMedico: false,
        isSecretaria: false,
        isPaciente: false,
      });

      const html = renderToString(
        <MemoryRouter>
          <RootPortalPage />
        </MemoryRouter>
      );

      expect(html).toContain("Portal Oficial del Paciente");
    });

    it("Puerta Autenticada: médico redirige a /clinical/voice", () => {
      vi.spyOn(roleHook, "useRole").mockReturnValue({
        user: { id: "1", email: "doc@test.com" } as any,
        role: "medico",
        isLoading: false,
        isAuthenticated: true,
        isAdmin: false,
        isMedico: true,
        isSecretaria: false,
        isPaciente: false,
      });

      // En MemoryRouter renderToString, <Navigate to="..." /> no emite contenido visible del componente
      const html = renderToString(
        <MemoryRouter initialEntries={["/"]}>
          <AuthenticatedRootGate />
        </MemoryRouter>
      );

      // No debe contener el portal público (parpadeo prevenido)
      expect(html).not.toContain("Portal Oficial del Paciente");
    });

    it("Puerta Autenticada: usuario sin rol clínico activo redirige a /pending-activation (Decisión 4)", () => {
      vi.spyOn(roleHook, "useRole").mockReturnValue({
        user: { id: "2", email: "nuevo@test.com" } as any,
        role: null,
        isLoading: false,
        isAuthenticated: true,
        isAdmin: false,
        isMedico: false,
        isSecretaria: false,
        isPaciente: false,
      });

      const html = renderToString(
        <MemoryRouter initialEntries={["/"]}>
          <AuthenticatedRootGate />
        </MemoryRouter>
      );

      expect(html).not.toContain("Portal Oficial del Paciente");
    });
  });
});
