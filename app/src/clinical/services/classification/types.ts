// Tipos para la integración con la API oficial de la OMS para ICD-11.
// Fuente: https://icd.who.int/icdapi
// La API usa OAuth2 Client Credentials y búsqueda lineal MMS.

/**
 * Resultado normalizado de una búsqueda ICD-11.
 * Representa una entidad de la clasificación oficial de la OMS.
 */
export type ICD11Result = {
  /** Código CIE-11 (ej. "1A00", "5A11") */
  code: string;
  /** Título/descripción de la entidad */
  title: string;
  /** URI completa de la entidad en la API de la OMS */
  uri: string;
};

/**
 * Token OAuth2 cacheado con su fecha de expiración.
 */
export type ICD11TokenCache = {
  token: string;
  expiresAt: number;
};

/**
 * Respuesta cruda de la API de búsqueda ICD-11 (MMS linearization).
 */
export type ICD11SearchResponse = {
  destinationEntities?: Array<{
    id?: string;
    code?: string;
    title?: {
      "@value"?: string;
    };
    iris?: string[];
  }>;
};

/**
 * Configuración del servicio ICD-11.
 */
export type ICD11Config = {
  clientId: string;
  clientSecret: string;
  baseUrl?: string;
  tokenEndpoint?: string;
  language?: string;
  release?: string;
  timeoutMs?: number;
};
