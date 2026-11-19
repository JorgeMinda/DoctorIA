import type { Request, Response, NextFunction } from "express";
import net from "net";

/**
 * Constantes de configuración de la política de límite de tasa (Rate Limiting).
 * Política: Ventana deslizante de 60s, máximo 60 peticiones por IP/subred para POST a /operations/get-public-specialists-directory.
 * Tope de memoria: 10.000 IPs con estrategia de purga de entradas vencidas y expulsión LRU.
 */
export const RATE_LIMIT_WINDOW_MS = 60_000; // 60 segundos
export const RATE_LIMIT_MAX_REQUESTS = 60; // 60 peticiones
export const RATE_LIMIT_MAX_STORE_SIZE = 10_000; // Máximo 10.000 entradas en memoria
export const RATE_LIMIT_TARGET_PATH = "/operations/get-public-specialists-directory";
export const PURGE_THROTTLE_MS = 1000; // Máximo una purga por segundo

export interface RateLimitEntry {
  timestamps: number[];
  lastSeen: number;
}

/**
 * Normaliza la ruta solicitada colapsando barras repetidas, removiendo barra final y convirtiendo a minúsculas.
 * Previene evasiones de ruta como //operations//get-public-specialists-directory/ o /OPERATIONS/...
 */
export function normalizePath(rawPath: string): string {
  if (!rawPath) return "";
  const withoutQuery = rawPath.split("?")[0];
  const collapsed = withoutQuery.replace(/\/+/g, "/");
  const trimmed = collapsed.length > 1 && collapsed.endsWith("/") ? collapsed.slice(0, -1) : collapsed;
  return trimmed.toLowerCase();
}

/**
 * Canonicaliza una dirección IP utilizando el módulo nativo 'net' de Node.js:
 * - Para IPv6: expande y normaliza notación comprimida y ceros iniciales, agrupando por prefijo /64 (RFC 6146).
 * - Para IPv4 mapeadas en IPv6 (::ffff:x.x.x.x): extrae la dirección IPv4 pura.
 * - Para IPv4 estándar: normaliza espacios y retorna la IP exacta.
 */
export function canonicalizeAndGroupIp(rawIp: string): string {
  if (!rawIp) return "127.0.0.1";
  let ip = rawIp.trim();

  // Limpiar IPv4 mapeada en IPv6
  if (ip.startsWith("::ffff:")) {
    ip = ip.slice(7);
  }

  const ipFamily = net.isIP(ip);
  if (ipFamily === 4) {
    return ip;
  }

  if (ipFamily === 6) {
    const cleanIp = ip.replace(/^\[|\]$/g, "");
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

    // Canonicalizar cada hexteto eliminando ceros a la izquierda y convirtiendo a minúsculas
    const canonicalHextets = hextets.map((h) => {
      const parsed = parseInt(h || "0", 16);
      return isNaN(parsed) ? "0" : parsed.toString(16);
    });

    // Los primeros 4 hextetos representan los primeros 64 bits (/64)
    const prefix64 = canonicalHextets.slice(0, 4).join(":");
    return `${prefix64}::/64`;
  }

  return ip;
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
let lastPurgeTimestamp = 0;

/**
 * Purga del almacén todas las entradas cuyos timestamps hayan expirado fuera de la ventana.
 * Limitado a un máximo de una ejecución por segundo (throttle de 1.000 ms) para proteger CPU.
 */
export function purgeExpired(now: number = Date.now(), force: boolean = false): boolean {
  if (!force && now - lastPurgeTimestamp < PURGE_THROTTLE_MS) {
    return false; // Omitir ejecución por throttle
  }
  lastPurgeTimestamp = now;

  for (const [key, entry] of store.entries()) {
    const validTimestamps = entry.timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
    if (validTimestamps.length === 0) {
      store.delete(key);
    } else {
      entry.timestamps = validTimestamps;
    }
  }
  return true;
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

export function getStoreSize(): number {
  return store.size;
}

export function getStoreKeys(): string[] {
  return Array.from(store.keys());
}

export function resetRateLimiterStore(): void {
  store.clear();
  lastPurgeTimestamp = 0;
}

export function startPeriodicCleanup(intervalMs: number = 60_000): void {
  if (!periodicCleanupTimer) {
    periodicCleanupTimer = setInterval(() => {
      purgeExpired(Date.now(), true);
    }, intervalMs);
    if (typeof periodicCleanupTimer.unref === "function") {
      periodicCleanupTimer.unref();
    }
  }
}

export function stopPeriodicCleanup(): void {
  if (periodicCleanupTimer) {
    clearInterval(periodicCleanupTimer);
    periodicCleanupTimer = null;
  }
}

/**
 * Resuelve la clave de red del cliente con protección anti-falsificación:
 * 1. Prioriza la cabecera CF-Connecting-IP establecida por Cloudflare Edge (si existe, Cloudflare no permite falsificarla).
 * 2. Si no existe CF-Connecting-IP, utiliza la resolución de Express (req.ip con trust proxy).
 * 3. Fallback estricto sobre X-Forwarded-For tomando el salto confiable.
 * 4. Canonicaliza IPv6 agrupando por /64 con el módulo net.
 */
export function resolveClientIp(req: Request): string {
  // 1. Cabecera confiable inyectada por Cloudflare Edge (no falsificable desde el cliente)
  const cfConnectingIp = req.headers?.["cf-connecting-ip"];
  if (typeof cfConnectingIp === "string" && cfConnectingIp.trim()) {
    return canonicalizeAndGroupIp(cfConnectingIp);
  }

  // 2. IP resuelta por Express con trust proxy configurado
  if (req.ip && req.ip !== "::1" && req.ip !== "127.0.0.1") {
    return canonicalizeAndGroupIp(req.ip);
  }

  // 3. Fallback defensivo sobre X-Forwarded-For
  const rawForwarded = req.headers?.["x-forwarded-for"];
  if (typeof rawForwarded === "string" && rawForwarded.trim()) {
    const parts = rawForwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      return canonicalizeAndGroupIp(parts[parts.length - 1]);
    }
  }

  const rawFallback = req.ip || req.socket?.remoteAddress || "127.0.0.1";
  return canonicalizeAndGroupIp(rawFallback);
}

/**
 * Middleware de límite de tasa para la operación getPublicSpecialistsDirectory.
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

  // 2. Normalización estricta de ruta y validación de método POST
  const normalizedPath = normalizePath(req.originalUrl || req.path || "");
  const isMatch =
    normalizedPath === RATE_LIMIT_TARGET_PATH ||
    normalizedPath === "/get-public-specialists-directory";

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

  store.delete(normalizedClientKey);
  store.set(normalizedClientKey, entry);

  next();
}
