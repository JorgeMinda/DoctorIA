import type { MiddlewareConfigFn, MiddlewareConfig } from "wasp/server/middleware";
import type { RequestHandler } from "express";
import {
  publicDirectoryRateLimiterMiddleware,
  startPeriodicCleanup,
} from "./publicDirectoryRateLimiter";

// Iniciar temporizador de purga periódica liberable (.unref) para el almacén en memoria
startPeriodicCleanup();

let isTrustProxyInitialized = false;

export function resetTrustProxyFlagForTesting(): void {
  isTrustProxyInitialized = false;
}

/**
 * Lista blanca estricta de orígenes autorizados para CORS.
 * En producción: solo los dominios institucionales exactos.
 * En desarrollo (NODE_ENV !== "production"): se admiten orígenes locales estándar.
 */
export function getAllowedOrigins(): string[] {
  const isProduction = process.env.NODE_ENV === "production";

  const exactOrigins = [
    "https://doctoria-client.onrender.com",
    "https://doctoria.linkear.net",
    "https://doctoria-server.onrender.com",
    process.env.WASP_WEB_CLIENT_URL,
  ]
    .filter((u): u is string => Boolean(u))
    .map((u) => u.replace(/\/$/, ""));

  if (!isProduction) {
    exactOrigins.push(
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001"
    );
  }

  return Array.from(new Set(exactOrigins));
}

export const serverMiddlewareFn: MiddlewareConfigFn = (middlewareConfig) => {
  // 1. Reconstruir Map para insertar trustProxySetup en la primera posición absoluta
  const orderedMap: MiddlewareConfig = new Map<string, RequestHandler>();

  orderedMap.set("trustProxySetup", (req, _res, next) => {
    if (!isTrustProxyInitialized && req.app && typeof req.app.set === "function") {
      req.app.set("trust proxy", 1);
      isTrustProxyInitialized = true;
    }
    next();
  });

  // 2. Copiar los middlewares previos preservando la configuración base
  for (const [key, handler] of middlewareConfig.entries()) {
    orderedMap.set(key, handler);
  }

  // 3. Reemplazar 'cors' con lista exacta y Vary: Origin
  orderedMap.set("cors", (req, res, next) => {
    // Requisito de seguridad: Emitir siempre Vary: Origin
    res.setHeader("Vary", "Origin");

    const origin = req.headers.origin as string | undefined;
    const allowedExactOrigins = getAllowedOrigins();

    const isAllowed = origin ? allowedExactOrigins.includes(origin) : true;

    if (origin && isAllowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS"
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With, sentry-trace, baggage"
      );
    }

    if (req.method === "OPTIONS") {
      if (origin && !isAllowed) {
        // Rechazar preflight de orígenes no autorizados
        res.sendStatus(403);
        return;
      }
      res.sendStatus(204);
      return;
    }

    next();
  });

  // 4. Límite de tasa por IP / prefijo IPv6 /64 para getPublicSpecialistsDirectory (DESPUÉS de CORS)
  orderedMap.set("rateLimiter", publicDirectoryRateLimiterMiddleware);

  return orderedMap;
};
