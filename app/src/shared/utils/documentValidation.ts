import crypto from "crypto";

export type DocumentType = "CEDULA" | "PASAPORTE" | "OTRO";

export interface DocumentValidationResult {
  isValid: boolean;
  error?: string;
  normalizedDocument: string;
}

/**
 * Normaliza un documento de identidad:
 * - Remueve espacios, guiones y caracteres no alfanuméricos
 * - Convierte a mayúsculas
 */
export function normalizeDocument(doc: string): string {
  if (!doc) return "";
  return doc.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/**
 * Validador oficial de Cédula de Identidad Ecuatoriana (Módulo 10).
 * Reglas:
 * 1. Exactamente 10 dígitos numéricos.
 * 2. Código de provincia (dos primeros dígitos) entre 01 y 24, o 30.
 * 3. Tercer dígito menor a 6 (persona natural).
 * 4. Algoritmo de Luhn modificado (coeficientes [2, 1, 2, 1, 2, 1, 2, 1, 2]).
 * 5. Dígito verificador igual al décimo dígito.
 */
export function validateCedulaEcuador(cedulaRaw: string): DocumentValidationResult {
  const cedula = normalizeDocument(cedulaRaw);

  if (!/^\d{10}$/.test(cedula)) {
    return {
      isValid: false,
      error: "La cédula debe contener exactamente 10 dígitos numéricos.",
      normalizedDocument: cedula,
    };
  }

  const provincia = parseInt(cedula.substring(0, 2), 10);
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) {
    return {
      isValid: false,
      error: "El código de provincia de la cédula no es válido.",
      normalizedDocument: cedula,
    };
  }

  const tercerDigito = parseInt(cedula.charAt(2), 10);
  if (tercerDigito >= 6) {
    return {
      isValid: false,
      error: "El tercer dígito de la cédula para persona natural debe ser menor a 6.",
      normalizedDocument: cedula,
    };
  }

  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;

  for (let i = 0; i < 9; i++) {
    let valor = parseInt(cedula.charAt(i), 10) * coeficientes[i];
    if (valor >= 10) {
      valor -= 9;
    }
    suma += valor;
  }

  const digitoVerificadorCalculado = (10 - (suma % 10)) % 10;
  const digitoVerificadorReal = parseInt(cedula.charAt(9), 10);

  if (digitoVerificadorCalculado !== digitoVerificadorReal) {
    return {
      isValid: false,
      error: "El dígito verificador de la cédula es incorrecto.",
      normalizedDocument: cedula,
    };
  }

  return {
    isValid: true,
    normalizedDocument: cedula,
  };
}

/**
 * Validador de Pasaporte internacional.
 * Reglas:
 * 1. Alfanumérico de entre 5 y 20 caracteres.
 */
export function validatePasaporte(pasaporteRaw: string): DocumentValidationResult {
  const pasaporte = normalizeDocument(pasaporteRaw);

  if (!/^[A-Z0-9]{5,20}$/.test(pasaporte)) {
    return {
      isValid: false,
      error: "El pasaporte debe tener entre 5 y 20 caracteres alfanuméricos.",
      normalizedDocument: pasaporte,
    };
  }

  return {
    isValid: true,
    normalizedDocument: pasaporte,
  };
}

/**
 * Validador genérico según tipo de documento.
 */
export function validateDocument(
  tipo: DocumentType,
  documentoRaw: string,
): DocumentValidationResult {
  if (tipo === "CEDULA") {
    return validateCedulaEcuador(documentoRaw);
  }
  if (tipo === "PASAPORTE") {
    return validatePasaporte(documentoRaw);
  }
  const norm = normalizeDocument(documentoRaw);
  if (norm.length < 3) {
    return {
      isValid: false,
      error: "El documento ingresado es demasiado corto.",
      normalizedDocument: norm,
    };
  }
  return {
    isValid: true,
    normalizedDocument: norm,
  };
}

/**
 * Genera un HMAC-SHA256 determinista para búsqueda exacta en base de datos.
 * Evita exponer el número de cédula o pasaporte como clave pública en la base de datos o índices abiertos.
 * 
 * Formato canónico: PAIS|TIPO|DOCUMENTO_NORMALIZADO
 * Ej: "EC|CEDULA|1712345678"
 */
export function calculateDocumentHash(
  tipo: DocumentType,
  documentoRaw: string,
  pais: string = "EC",
  secretKey?: string,
): string {
  const secret = secretKey || process.env.JWT_SECRET || process.env.DOCUMENT_LOOKUP_SECRET || "doctoria-default-lookup-key-2026";
  const normalized = normalizeDocument(documentoRaw);
  const canonicalString = `${pais.toUpperCase()}|${tipo.toUpperCase()}|${normalized}`;

  return crypto
    .createHmac("sha256", secret)
    .update(canonicalString)
    .digest("hex");
}
