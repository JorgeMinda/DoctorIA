// Servicio desacoplado para la integración con la API oficial de la OMS
// para ICD-11 (CIE-11 en español).
// Fuente: https://icd.who.int/icdapi
//
// Arquitectura:
//   UI → Query/Action → icd11.service.ts → WHO ICD-11 API
//
// Responsabilidades:
//   1. Autenticación OAuth2 Client Credentials con cache de token.
//   2. Búsqueda normalizada contra la linealización MMS.
//   3. Manejo robusto de errores (red, HTTP, timeout, rate limiting).
//
// REGLAS:
//   - NUNCA hardcodear credenciales.
//   - NUNCA exponer el token al frontend.
//   - NUNCA generar códigos artificiales.
//   - Los resultados SIEMPRE provienen de la API oficial configurada.

import type {
  ICD11Config,
  ICD11Result,
  ICD11SearchResponse,
  ICD11TokenCache,
} from "./types";

// ─── Defaults ───────────────────────────────────────────────────────

const DEFAULT_BASE_URL = "https://id.who.int";
const DEFAULT_TOKEN_ENDPOINT =
  "https://icdaccessmanagement.who.int/connect/token";
const DEFAULT_LANGUAGE = "es"; // Español para contexto médico latino
const DEFAULT_RELEASE = "2024-01";
const DEFAULT_TIMEOUT_MS = 10_000;

// ─── Estado interno (módulo singleton) ───────────────────────────────

let tokenCache: ICD11TokenCache | null = null;

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Codifica credenciales en formato Basic Auth para OAuth2.
 */
function encodeBasicAuth(clientId: string, clientSecret: string): string {
  const credentials = `${clientId}:${clientSecret}`;
  return Buffer.from(credentials).toString("base64");
}

/**
 * Verifica si el token cacheado sigue siendo válido.
 * Se renueva 60 segundos antes de expirar para evitar errores de race condition.
 */
function isTokenValid(cache: ICD11TokenCache | null): cache is ICD11TokenCache {
  if (!cache) return false;
  const SAFETY_MARGIN_MS = 60_000; // 60 segundos de margen
  return Date.now() < cache.expiresAt - SAFETY_MARGIN_MS;
}

// ─── Token Management ───────────────────────────────────────────────

/**
 * Obtiene un token OAuth2 válido. Reutiliza el cacheado si aún es válido.
 *
 * Flujo:
 *   1. Si hay token cacheado y válido → retornarlo.
 *   2. Si no → solicitar nuevo token con Client Credentials.
 *   3. Almacenar en cache con su fecha de expiración.
 *
 * @throws Error si las credenciales son inválidas o la API no responde.
 */
async function getAccessToken(config: ICD11Config): Promise<string> {
  // Reutilizar token cacheado si es válido
  if (isTokenValid(tokenCache)) {
    return tokenCache!.token;
  }

  const tokenEndpoint = config.tokenEndpoint ?? DEFAULT_TOKEN_ENDPOINT;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${encodeBasicAuth(config.clientId, config.clientSecret)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=icdapi_access",
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `ICD-11 token error: HTTP ${response.status} — ${body.slice(0, 200)}`,
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
      token_type: string;
    };

    if (!data.access_token || typeof data.expires_in !== "number") {
      throw new Error("ICD-11 token error: respuesta inválida del servidor");
    }

    // Cache: token + expiración en milisegundos
    const expiresAt = Date.now() + data.expires_in * 1000;
    tokenCache = { token: data.access_token, expiresAt };

    return tokenCache.token;
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error(
        `ICD-11 token timeout: el servidor no respondió en ${(config.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000}s`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Búsqueda ───────────────────────────────────────────────────────

/**
 * Busca códigos CIE-11 en la linealización MMS de la OMS.
 *
 * @param query - Texto de búsqueda (ej. "dolor abdominal", "diabetes tipo 2")
 * @param config - Configuración con credenciales OAuth2
 * @returns Lista de resultados normalizados. Lista vacía si no hay coincidencias.
 *
 * @example
 * ```ts
 * const results = await searchICD11("dolor abdominal", {
 *   clientId: process.env.ICD11_CLIENT_ID!,
 *   clientSecret: process.env.ICD11_CLIENT_SECRET!,
 * });
 * // → [{ code: "MD12", title: "Dolor abdominal", uri: "..." }]
 * ```
 */
export async function searchICD11(
  query: string,
  config: ICD11Config,
): Promise<ICD11Result[]> {
  // Validación de entrada
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      "ICD-11 config error: ICD11_CLIENT_ID e ICD11_CLIENT_SECRET son requeridos",
    );
  }

  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const language = config.language ?? DEFAULT_LANGUAGE;
  const release = config.release ?? DEFAULT_RELEASE;

  // Obtener token (reutiliza cacheado)
  const token = await getAccessToken(config);

  // Construir URL de búsqueda (linealización MMS)
  const searchUrl = new URL(
    `/icd/release/11/${release}/mms/search`,
    baseUrl,
  );
  searchUrl.searchParams.set("q", trimmedQuery);
  searchUrl.searchParams.set("language", language);

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await fetch(searchUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Accept-Language": language,
      },
      signal: controller.signal,
    });

    // Rate limiting (429)
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      throw new Error(
        `ICD-11 rate limit: demasiadas solicitudes. Reintentar en ${retryAfter ?? "60"} segundos`,
      );
    }

    // Otros errores HTTP
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `ICD-11 search error: HTTP ${response.status} — ${body.slice(0, 200)}`,
      );
    }

    const data = (await response.json()) as ICD11SearchResponse;

    // Normalizar resultados
    const entities = data.destinationEntities ?? [];
    return entities
      .filter((e) => e.code && e.title?.["@value"])
      .map((e) => ({
        code: e.code!,
        title: e.title!["@value"]!,
        uri: e.iris?.[0] ?? `${baseUrl}/icd/release/11/${release}/mms/${e.code}`,
      }));
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error(
        `ICD-11 search timeout: la búsqueda "${trimmedQuery}" no respondió en ${(config.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000}s`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Utilidades ─────────────────────────────────────────────────────

/**
 * Limpia el cache de token. Útil para tests o cuando se sospeita
 * que el token expiró.
 */
export function clearTokenCache(): void {
  tokenCache = null;
}

/**
 * Verifica si el servicio está configurado (credenciales disponibles).
 */
export function isConfigured(config: ICD11Config): boolean {
  return Boolean(config.clientId && config.clientSecret);
}
