import { describe, it, expect, beforeEach } from "vitest";
import {
  hasStoredSessionToken,
  getStoredSessionToken,
  WASP_SESSION_STORAGE_KEY,
} from "../../src/client/auth/sessionTokenAdapter";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe("Adaptador de Token de Sesión en Cliente (F3)", () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = new MemoryStorage();
  });

  describe("hasStoredSessionToken", () => {
    it("devuelve false si el storage es nulo o indefinido", () => {
      expect(hasStoredSessionToken(null)).toBe(false);
    });

    it("devuelve false si no existe la clave de sesión en el almacenamiento", () => {
      expect(hasStoredSessionToken(mockStorage)).toBe(false);
    });

    it("devuelve false si la clave contiene valores vacíos, nulos o cadenas en blanco", () => {
      mockStorage.setItem(WASP_SESSION_STORAGE_KEY, "");
      expect(hasStoredSessionToken(mockStorage)).toBe(false);

      mockStorage.setItem(WASP_SESSION_STORAGE_KEY, "   ");
      expect(hasStoredSessionToken(mockStorage)).toBe(false);

      mockStorage.setItem(WASP_SESSION_STORAGE_KEY, "null");
      expect(hasStoredSessionToken(mockStorage)).toBe(false);

      mockStorage.setItem(WASP_SESSION_STORAGE_KEY, '""');
      expect(hasStoredSessionToken(mockStorage)).toBe(false);
    });

    it("devuelve true si existe un token de sesión válido (formato JSON o plano)", () => {
      mockStorage.setItem(WASP_SESSION_STORAGE_KEY, JSON.stringify("jwt-session-token-xyz"));
      expect(hasStoredSessionToken(mockStorage)).toBe(true);

      mockStorage.setItem(WASP_SESSION_STORAGE_KEY, "raw-session-token-abc");
      expect(hasStoredSessionToken(mockStorage)).toBe(true);
    });

    it("maneja de forma segura excepciones de seguridad del storage (ej. cookies bloqueadas)", () => {
      const errorStorage = {
        getItem: () => {
          throw new Error("SecurityError: Access is denied");
        },
      } as unknown as Storage;

      expect(hasStoredSessionToken(errorStorage)).toBe(false);
    });
  });

  describe("getStoredSessionToken", () => {
    it("devuelve el valor del token desempaquetado de JSON", () => {
      mockStorage.setItem(WASP_SESSION_STORAGE_KEY, JSON.stringify("session-12345"));
      expect(getStoredSessionToken(mockStorage)).toBe("session-12345");
    });

    it("devuelve el valor plano si no era JSON", () => {
      mockStorage.setItem(WASP_SESSION_STORAGE_KEY, "token-plano-67890");
      expect(getStoredSessionToken(mockStorage)).toBe("token-plano-67890");
    });

    it("devuelve null si no existe o está vacío", () => {
      expect(getStoredSessionToken(mockStorage)).toBeNull();
      mockStorage.setItem(WASP_SESSION_STORAGE_KEY, "  ");
      expect(getStoredSessionToken(mockStorage)).toBeNull();
    });
  });
});
