import type { Request, Response, NextFunction } from "express";

/**
 * Constantes de configuración de la política de límite de tasa (Rate Limiting).
 * Política: Ventana deslizante de 60s, máximo 60 peticiones por IP/subred para POST a /operations/get-public-specialists-directory.
 * Tope de memoria: 10.000 IPs con estrategia de purga de entradas vencidas y expulsión LRU.
 */
export const RATE_LIMIT_WINDOW_MS = 60_000; // 60 segundos
export const RATE_LIMIT_MAX_REQUESTS = 60; // 60 peticiones
export const RATE_LIMIT_MAX_STORE_SIZE = 10_000; // Máximo 10.000 entradas en memoria
export const RATE_LIMIT_TARGET_PATH = "/operations/get-public-specialists-directory";

export interface RateLimitEntry {
  timestamps: number[];
  lastSeen: number;
}

/**
 * Normaliza una dirección IP para mitigar evasiones:
 * - Para IPv6: agrupa por prefijo /64 (primeros 64 bits) de acuerdo con RFC 6146.
 *   Esto previene que un cliente con un bloque /64 evada el límite rotando direcciones efímeras.
 * - Para IPv4 mapeadas en IPv6 (::ffff:x.x.x.x): extrae la dirección IPv4 pura.
 * - Para IPv4 estándar: normaliza espacios y retorna la IP exacta.
 */
export function normalizeIp(ip: string): string {
  if (!ip) return "127.0.0.1";
  const trimmed = ip.trim();

  // Limpiar IPv4 mapeada en IPv6
  if (trimmed.startsWith("::ffff:")) {
    return trimmed.slice(7);
  }

  // IPv6: contiene dos puntos
  if (trimmed.includes(":")) {
    const cleanIp = trimmed.replace(/^\[|\]$/g, "");
    const parts = cleanIp.split("::");
    let hextets: string[] = [];

    if (parts.length === 2) {
      const left = parts[0] ? parts[0].split(":") : [];
      const right = parts[1] ? parts[1].split(":") : [];
      const missing = 8 - (left.length + right.length);
      const middle = Array(Math.max(0, missing)).fill("0");
      hextets = [...left, ...middle, ...right];
    } else {
      hextets = cleanIp.split(":");
    }

    // Tomar los primeros 4 hextetos (64 bits) y normalizar
    const prefixHextets = hextets.slice(0, 4).map((h) => h.toLowerCase() || "0");
    return `${prefixHextets.join(":")}::/64`;
  }

  return trimmed;
}

/**
 * Almacén en memoria de claves normalizadas y sus marcas de tiempo.
 * NOTA DE ARQUITECTURA:
 * El límite es por instancia de proceso (in-memory store) y no es compartido si Render escala
 * horizontalmente a múltiples réplicas. Para un entorno distribuido se requeriría un almacén
 * centralizado (ej. Redis/Upstash), el cual está fuera del alcance actual del MVP.
 */
const store = new Map<string, RateLimitEntry>();

let periodicCleanupTimer: NodeJS.Timeout | null = null;

/**
 * Purga del almacén todas las entradas cuyos timestamps hayan expirado fuera de la ventana.
 */
export function purgeExpired(now: number = Date.now()): void {
  for (const [key, entry] of store.entries()) {
    const validTimestamps = entry.timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
    if (validTimestamps.length === 0) {
      store.delete(key);
    } else {
      entry.timestamps = validTimestamps;
    }
  }
}

/**
 * Expulsa la entrada menos recientemente usada (LRU).
 * Decisión de diseño:
 * Gracias a que el Map de ECMAScript preserva el orden de inserción y actualizamos cada entrada
 * reinsertándola (delete -> set) en cada acceso, la clave retornada por `store.keys().next().value`
 * es garantizadamente la menos recientemente utilizada (LRU) en tiempo O(1).
 * Retorna la clave expulsada para fines de verificación y auditoría.
 */
export function evictLRU(): string | undefined {
  const oldestKey = store.keys().next().value;
  if (oldestKey !== undefined) {
    store.delete(oldestKey);
    return oldestKey;
  }
  return undefined;
}

/**
 * Obtiene el número actual de IPs registradas en el almacén (para pruebas e inspección).
 */
export function getStoreSize(): number {
  return store.size;
}

/**
 * Obtiene las claves actualmente registradas en el almacén (para pruebas e inspección).
 */
export function getStoreKeys(): string[] {
  return Array.from(store.keys());
}

/**
 * Reinicia completamente el almacén en memoria (utilizado principalmente en pruebas).
 */
export function resetRateLimiterStore(): void {
  store.clear();
}

/**
 * Inicia el temporizador de purga periódica liberable (unref) para evitar retener el proceso.
 */
export function startPeriodicCleanup(intervalMs: number = 60_000): void {
  if (!periodicCleanupTimer) {
    periodicCleanupTimer = setInterval(() => {
      purgeExpired(Date.now());
    }, intervalMs);
    if (typeof periodicCleanupTimer.unref === "function") {
      periodicCleanupTimer.unref();
    }
  }
}

/**
 * Detiene el temporizador de purga periódica (para evitar temporizadores abiertos en pruebas).
 */
export function stopPeriodicCleanup(): void {
  if (periodicCleanupTimer) {
    clearInterval(periodicCleanupTimer);
    periodicCleanupTimer = null;
  }
}

/**
 * Resuelve la clave de red del cliente con protección anti-falsificación:
 * 1. Confía en la resolución nativa de Express (req.ip) cuando trust proxy está configurado (1 salto en Render).
 * 2. Si req.ip no está resuelto, toma estrictamente la última entrada de X-Forwarded-For
 *    (la estampada por el reverse proxy perimetral de Render), descartando cualquier prefijo falsificado.
 * 3. Normaliza IPv6 al prefijo /64 para evitar evasión mediante rotación de direcciones efímeras.
 * 4. REGLA DE PRIVACIDAD: Jamás se registran direcciones IP en logs ni en auditoría.
 */
export function resolveClientIp(req: Request): string {
  // 1. IP resuelta por Express con trust proxy configurado
  if (req.ip && req.ip !== "::1" && req.ip !== "127.0.0.1") {
    return normalizeIp(req.ip);
  }

  // 2. Fallback defensivo: tomar la última entrada de X-Forwarded-For (salto de Render)
  const rawForwarded = req.headers?.["x-forwarded-for"];
  if (typeof rawForwarded === "string" && rawForwarded.trim()) {
    const parts = rawForwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      return normalizeIp(parts[parts.length - 1]);
    }
  }

  const rawFallback = req.ip || req.socket?.remoteAddress || "127.0.0.1";
  return normalizeIp(rawFallback);
}

/**
 * Middleware de límite de tasa para la operación getPublicSpecialistsDirectory.
 * Debe ejecutarse DESPUÉS de CORS para que las cabeceras de CORS estén presentes y el navegador
 * pueda procesar la respuesta HTTP 429 con Retry-After.
 */
export function publicDirectoryRateLimiterMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 1. Excluir peticiones OPTIONS (preflight CORS)
  if (req.method === "OPTIONS") {
    return next();
  }

  // 2. Solo aplicar a peticiones POST dirigidas a la operación getPublicSpecialistsDirectory
  const pathWithoutQuery = (req.originalUrl || req.path || "").split("?")[0];
  const isMatch =
    pathWithoutQuery === RATE_LIMIT_TARGET_PATH ||
    req.path === RATE_LIMIT_TARGET_PATH ||
    (req.baseUrl === "/operations" && req.path === "/get-public-specialists-directory");

  if (req.method !== "POST" || !isMatch) {
    return next();
  }

  const now = Date.now();
  const normalizedClientKey = resolveClientIp(req);

  let entry = store.get(normalizedClientKey);

  if (!entry) {
    // Si alcanzamos el tope de memoria de 10.000 entradas:
    if (store.size >= RATE_LIMIT_MAX_STORE_SIZE) {
      purgeExpired(now);
      if (store.size >= RATE_LIMIT_MAX_STORE_SIZE) {
        evictLRU();
      }
    }
    entry = { timestamps: [], lastSeen: now };
  } else {
    // Filtrar marcas de tiempo fuera de la ventana deslizante
    entry.timestamps = entry.timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  }

  // Si se superó el umbral de 60 peticiones en la ventana
  if (entry.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldestTimestamp = entry.timestamps[0];
    const remainingMs = oldestTimestamp + RATE_LIMIT_WINDOW_MS - now;
    const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));

    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({
      message: "Demasiadas peticiones. Intenta nuevamente en breve.",
    });
    return;
  }

  // Registrar petición y actualizar orden LRU
  entry.timestamps.push(now);
  entry.lastSeen = now;

  // Actualizar en el Map (reinsertar al final para mantener LRU en O(1))
  store.delete(normalizedClientKey);
  store.set(normalizedClientKey, entry);

  next();
}
