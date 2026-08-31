import { describe, it, expect } from "vitest";
import {
  normalizeDocument,
  validateCedulaEcuador,
  validatePasaporte,
  validateDocument,
  calculateDocumentHash,
} from "../../src/shared/utils/documentValidation";

describe("Document Validation & HMAC Suite (Producción)", () => {
  describe("normalizeDocument", () => {
    it("debe remover espacios, guiones y caracteres especiales", () => {
      expect(normalizeDocument(" 171-003-406-5 ")).toBe("1710034065");
      expect(normalizeDocument("a.b-c 12 3")).toBe("ABC123");
      expect(normalizeDocument("")).toBe("");
    });
  });

  describe("validateCedulaEcuador (Módulo 10)", () => {
    it("debe validar cédulas ecuatorianas válidas de diversas provincias", () => {
      // Cédulas verificadas con algoritmo Módulo 10 oficial de Ecuador:
      expect(validateCedulaEcuador("1710034065").isValid).toBe(true);
      expect(validateCedulaEcuador("1721532826").isValid).toBe(true);
      expect(validateCedulaEcuador("0926687856").isValid).toBe(true);
    });

    it("debe rechazar cédulas con longitud diferente a 10 dígitos", () => {
      expect(validateCedulaEcuador("171003406").isValid).toBe(false);
      expect(validateCedulaEcuador("17100340655").isValid).toBe(false);
      expect(validateCedulaEcuador("").isValid).toBe(false);
    });

    it("debe rechazar cédulas con caracteres no numéricos", () => {
      expect(validateCedulaEcuador("171003406A").isValid).toBe(false);
    });

    it("debe rechazar cédulas con provincia inválida (> 24 y != 30, o 00)", () => {
      expect(validateCedulaEcuador("0010034065").isValid).toBe(false);
      expect(validateCedulaEcuador("2510034065").isValid).toBe(false);
      expect(validateCedulaEcuador("9910034065").isValid).toBe(false);
    });

    it("debe rechazar cédulas cuyo tercer dígito sea >= 6 (no persona natural)", () => {
      expect(validateCedulaEcuador("1760034065").isValid).toBe(false);
      expect(validateCedulaEcuador("1790034065").isValid).toBe(false);
    });

    it("debe rechazar cédulas con dígito verificador erróneo", () => {
      // 1710034065 es válida, 1710034069 debe ser rechazada
      const res = validateCedulaEcuador("1710034069");
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("dígito verificador");
    });
  });

  describe("validatePasaporte", () => {
    it("debe aceptar pasaportes alfanuméricos de entre 5 y 20 caracteres", () => {
      expect(validatePasaporte("A1234567").isValid).toBe(true);
      expect(validatePasaporte("ECU987654321").isValid).toBe(true);
      expect(validatePasaporte("PA-123-45").isValid).toBe(true);
    });

    it("debe rechazar pasaportes demasiado cortos o con caracteres inválidos", () => {
      expect(validatePasaporte("AB1").isValid).toBe(false);
      expect(validatePasaporte("").isValid).toBe(false);
    });
  });

  describe("validateDocument (Dispatcher)", () => {
    it("debe despachar correctamente según tipo de documento", () => {
      expect(validateDocument("CEDULA", "1710034065").isValid).toBe(true);
      expect(validateDocument("PASAPORTE", "A1234567").isValid).toBe(true);
      expect(validateDocument("OTRO", "ID-99999").isValid).toBe(true);
    });
  });

  describe("calculateDocumentHash (HMAC)", () => {
    it("debe generar un hash HMAC determinista para el mismo documento normalizado", () => {
      const secret = "test-secret-key-123";
      const hash1 = calculateDocumentHash("CEDULA", "171-003-406-5", "EC", secret);
      const hash2 = calculateDocumentHash("CEDULA", "1710034065", "EC", secret);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("debe generar hashes distintos para diferentes tipos de documento o países", () => {
      const secret = "test-secret-key-123";
      const hashCedula = calculateDocumentHash("CEDULA", "1710034065", "EC", secret);
      const hashPasaporte = calculateDocumentHash("PASAPORTE", "1710034065", "EC", secret);
      const hashColombia = calculateDocumentHash("CEDULA", "1710034065", "CO", secret);

      expect(hashCedula).not.toBe(hashPasaporte);
      expect(hashCedula).not.toBe(hashColombia);
    });
  });
});
