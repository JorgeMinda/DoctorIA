// Tests unitarios del servicio ICD-11 (CIE-11).
// Mockea la API de la OMS para validar:
//   - Búsqueda exitosa
//   - Resultados vacíos
//   - Errores de red
//   - Errores HTTP (401, 429, 500)
//   - Reutilización de token cacheado
//   - Query vacío
//   - Configuración faltante

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("wasp/server", () => ({
  HttpError: class HttpError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

import {
  searchICD11,
  clearTokenCache,
  isConfigured,
} from "../../src/clinical/services/classification/icd11.service";
import type { ICD11Config } from "../../src/clinical/services/classification/types";

const TEST_CONFIG: ICD11Config = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
};

const MOCK_TOKEN_RESPONSE = {
  access_token: "mock-access-token-123",
  expires_in: 3600,
  token_type: "Bearer",
};

const MOCK_SEARCH_RESPONSE = {
  destinationEntities: [
    {
      id: "123456",
      code: "MD12",
      title: { "@value": "Dolor abdominal" },
      iris: ["https://id.who.int/icd/release/11/2024-01/mms/MD12"],
    },
    {
      id: "789012",
      code: "5A11",
      title: { "@value": "Diabetes mellitus tipo 2" },
      iris: [],
    },
  ],
};

// ─── Mock global fetch ──────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockTokenSuccess() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => MOCK_TOKEN_RESPONSE,
  });
}

function mockSearchSuccess() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => MOCK_SEARCH_RESPONSE,
    headers: new Map(),
  });
}

function mockHttpResponse(status: number, body: string = "") {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    text: async () => body,
    headers: new Map([["Retry-After", "60"]]),
  });
}

function mockNetworkError() {
  mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));
}

function mockTimeout() {
  const abortError = new DOMException("The operation was aborted", "AbortError");
  mockFetch.mockRejectedValueOnce(abortError);
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("searchICD11", () => {
  afterEach(() => {
    vi.clearAllMocks();
    clearTokenCache();
  });

  describe("búsqueda exitosa", () => {
    it("retorna resultados normalizados para una query válida", async () => {
      mockTokenSuccess();
      mockSearchSuccess();

      const results = await searchICD11("dolor abdominal", TEST_CONFIG);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        code: "MD12",
        title: "Dolor abdominal",
        uri: "https://id.who.int/icd/release/11/2024-01/mms/MD12",
      });
      expect(results[1]).toEqual({
        code: "5A11",
        title: "Diabetes mellitus tipo 2",
        uri: "https://id.who.int/icd/release/11/2024-01/mms/5A11",
      });
    });

    it("envía headers correctos de autenticación", async () => {
      mockTokenSuccess();
      mockSearchSuccess();

      await searchICD11("asma", TEST_CONFIG);

      // Primera llamada: token
      const tokenCall = mockFetch.mock.calls[0];
      expect(tokenCall[1].headers.Authorization).toMatch(/^Basic /);

      // Segunda llamada: búsqueda
      const searchCall = mockFetch.mock.calls[1];
      expect(searchCall[1].headers.Authorization).toBe(
        "Bearer mock-access-token-123",
      );
      expect(searchCall[1].headers.Accept).toBe("application/json");
    });
  });

  describe("resultados vacíos", () => {
    it("retorna array vacío si no hay entidades", async () => {
      mockTokenSuccess();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ destinationEntities: [] }),
        headers: new Map(),
      });

      const results = await searchICD11("xyz123inexistente", TEST_CONFIG);

      expect(results).toEqual([]);
    });

    it("retorna array vacío si destinationEntities es undefined", async () => {
      mockTokenSuccess();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      const results = await searchICD11("algo", TEST_CONFIG);

      expect(results).toEqual([]);
    });

    it("filtra entidades sin código o título", async () => {
      mockTokenSuccess();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          destinationEntities: [
            { id: "1", code: null, title: { "@value": "Test" } },
            { id: "2", code: "AB12", title: null },
            { id: "3", code: "CD34", title: { "@value": "Válido" } },
          ],
        }),
        headers: new Map(),
      });

      const results = await searchICD11("test", TEST_CONFIG);

      expect(results).toHaveLength(1);
      expect(results[0].code).toBe("CD34");
    });
  });

  describe("validación de entrada", () => {
    it("retorna array vacío para query vacío", async () => {
      const results = await searchICD11("", TEST_CONFIG);
      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("retorna array vacío para query con solo espacios", async () => {
      const results = await searchICD11("   ", TEST_CONFIG);
      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("lanza error si falta clientId", async () => {
      await expect(
        searchICD11("test", { clientId: "", clientSecret: "secret" }),
      ).rejects.toThrow("ICD11_CLIENT_ID e ICD11_CLIENT_SECRET son requeridos");
    });

    it("lanza error si falta clientSecret", async () => {
      await expect(
        searchICD11("test", { clientId: "id", clientSecret: "" }),
      ).rejects.toThrow("ICD11_CLIENT_ID e ICD11_CLIENT_SECRET son requeridos");
    });
  });

  describe("manejo de errores", () => {
    it("lanza error en HTTP 401 (credenciales inválidas)", async () => {
      mockHttpResponse(401, "Unauthorized");

      await expect(
        searchICD11("test", TEST_CONFIG),
      ).rejects.toThrow("ICD-11 token error: HTTP 401");
    });

    it("lanza error en HTTP 429 (rate limiting)", async () => {
      mockTokenSuccess();
      mockHttpResponse(429, "Too Many Requests");

      await expect(
        searchICD11("test", TEST_CONFIG),
      ).rejects.toThrow("ICD-11 rate limit");
    });

    it("lanza error en HTTP 500 (error del servidor)", async () => {
      mockTokenSuccess();
      mockHttpResponse(500, "Internal Server Error");

      await expect(
        searchICD11("test", TEST_CONFIG),
      ).rejects.toThrow("ICD-11 search error: HTTP 500");
    });

    it("lanza error en fallo de red", async () => {
      mockNetworkError();

      await expect(
        searchICD11("test", TEST_CONFIG),
      ).rejects.toThrow("fetch failed");
    });

    it("lanza error en timeout del token", async () => {
      mockTimeout();

      await expect(
        searchICD11("test", TEST_CONFIG),
      ).rejects.toThrow("ICD-11 token timeout");
    });

    it("lanza error en timeout de búsqueda", async () => {
      mockTokenSuccess();
      mockTimeout();

      await expect(
        searchICD11("test", TEST_CONFIG),
      ).rejects.toThrow("ICD-11 search timeout");
    });
  });

  describe("cache de token", () => {
    it("reutiliza el token cacheado en búsquedas consecutivas", async () => {
      mockTokenSuccess();
      mockSearchSuccess();

      await searchICD11("primera", TEST_CONFIG);

      // Segunda búsqueda: solo mock para search (token reutilizado del cache)
      mockSearchSuccess();
      await searchICD11("segunda", TEST_CONFIG);

      // Solo 1 llamada a token (la segunda reutiliza cache)
      const tokenCalls = mockFetch.mock.calls.filter(
        (call: any[]) =>
          typeof call[0] === "string" && call[0].includes("connect/token"),
      );
      expect(tokenCalls).toHaveLength(1);

      // 2 llamadas a search
      const searchCalls = mockFetch.mock.calls.filter(
        (call: any[]) =>
          typeof call[0] === "string" && call[0].includes("/mms/search"),
      );
      expect(searchCalls).toHaveLength(2);
    });

    it("solicita nuevo token cuando se limpia el cache", async () => {
      mockTokenSuccess();
      mockSearchSuccess();
      await searchICD11("primera", TEST_CONFIG);

      clearTokenCache();

      mockTokenSuccess();
      mockSearchSuccess();
      await searchICD11("segunda", TEST_CONFIG);

      const tokenCalls = mockFetch.mock.calls.filter(
        (call: any[]) =>
          typeof call[0] === "string" && call[0].includes("connect/token"),
      );
      expect(tokenCalls).toHaveLength(2);
    });
  });

  describe("configuración", () => {
    it("isConfigured retorna true con credenciales válidas", () => {
      expect(isConfigured(TEST_CONFIG)).toBe(true);
    });

    it("isConfigured retorna false sin credenciales", () => {
      expect(isConfigured({ clientId: "", clientSecret: "" })).toBe(false);
    });

    it("usa idioma español por defecto", async () => {
      mockTokenSuccess();
      mockSearchSuccess();

      await searchICD11("test", TEST_CONFIG);

      const searchCall = mockFetch.mock.calls[1];
      const url = new URL(searchCall[0]);
      expect(url.searchParams.get("language")).toBe("es");
    });

    it("respeta idioma personalizado", async () => {
      mockTokenSuccess();
      mockSearchSuccess();

      await searchICD11("test", { ...TEST_CONFIG, language: "en" });

      const searchCall = mockFetch.mock.calls[1];
      const url = new URL(searchCall[0]);
      expect(url.searchParams.get("language")).toBe("en");
    });
  });
});
