import type { Request, Response, NextFunction } from "express";

/**
 * Constantes de configuración de la política de límite de tasa (Rate Limiting).
 * Política: Ventana deslizante de 60s, máximo 60 peticiones por IP para POST a /operations/get-public-specialists-directory.
 * Tope de memoria: 10.000 IPs con estrategia de purga de entradas vencidas y expulsión LRU.
 */
export const RATE_LIMIT_WINDOW_MS = 60_000; // 60 segundos
export const RATE_LIMIT_MAX_REQUESTS = 60; // 60 peticiones por IP
export const RATE_LIMIT_MAX_STORE_SIZE = 10_000; // Máximo 10.000 IPs en memoria
export const RATE_LIMIT_TARGET_PATH = "/operations/get-public-specialists-directory";

export interface RateLimitEntry {
  timestamps: number[];
  lastSeen: number;
}

/**
 * Almacén en memoria de IPs y sus marcas de tiempo.
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
  for (const [ip, entry] of store.entries()) {
    const validTimestamps = entry.timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
    if (validTimestamps.length === 0) {
      store.delete(ip);
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
 */
export function evictLRU(): void {
  const oldestKey = store.keys().next().value;
  if (oldestKey !== undefined) {
    store.delete(oldestKey);
  }
}

/**
 * Obtiene el número actual de IPs registradas en el almacén (para pruebas e inspección).
 */
export function getStoreSize(): number {
  return store.size;
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
    // .unref() asegura que el temporizador no impida que Node.js finalice el proceso limpiamente
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
 * Resuelve la dirección IP del cliente sin confiar ciegamente en cabeceras falsificables.
 * - En Render, existe exactamente 1 salto de reverse proxy administrado (Cloudflare/Render Edge).
 * - Se configura 'trust proxy' = 1 en Express para que req.ip evalúe el salto de proxy legítimo.
 * - Si un cliente inyecta cabeceras X-Forwarded-For previas, Express (y el fallback estricto)
 *   toma la última IP agregada por el proxy perimetral de Render, ignorando las IPs falsificadas.
 * - REGLA DE SEGURIDAD Y PRIVACIDAD: Jamás se registran direcciones IP en logs.
 */
export function resolveClientIp(req: Request): string {
  // Asegurar trust proxy = 1 si la instancia de Express está disponible
  if (req.app && typeof req.app.get === "function" && typeof req.app.set === "function") {
    if (!req.app.get("trust proxy")) {
      req.app.set("trust proxy", 1);
    }
  }

  // Si req.ip fue resuelto por Express con proxy de confianza
  if (req.ip && req.ip !== "::1" && req.ip !== "127.0.0.1") {
    return req.ip;
  }

  // Fallback con lógica estricta de 1 salto (Render edge proxy):
  // X-Forwarded-For contiene: <cliente-falsificado-o-previo>, <ip-real-agregada-por-render>
  // La IP confiable del cliente es la última entrada antes de nuestro servidor.
  const rawForwarded = req.headers?.["x-forwarded-for"];
  if (typeof rawForwarded === "string" && rawForwarded.trim()) {
    const parts = rawForwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }

  return req.ip || req.socket?.remoteAddress || "127.0.0.1";
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
  const clientIp = resolveClientIp(req);

  let entry = store.get(clientIp);

  if (!entry) {
    // Si alcanzamos el tope de memoria de 10.000 IPs:
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
  store.delete(clientIp);
  store.set(clientIp, entry);

  next();
}
