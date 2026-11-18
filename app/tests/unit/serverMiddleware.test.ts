import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import http from "http";
import type { Request, Response, NextFunction } from "express";
import {
  publicDirectoryRateLimiterMiddleware,
  resetRateLimiterStore,
  getStoreSize,
  getStoreKeys,
  stopPeriodicCleanup,
  normalizeIp,
  evictLRU,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_MAX_STORE_SIZE,
} from "../../src/server/publicDirectoryRateLimiter";
import {
  serverMiddlewareFn,
  resetTrustProxyFlagForTesting,
  getAllowedOrigins,
} from "../../src/server/serverMiddleware";

function createMockReqRes({
  method = "POST",
  path = "/operations/get-public-specialists-directory",
  originalUrl = "/operations/get-public-specialists-directory",
  ip = "192.168.1.50",
  headers = {},
}: {
  method?: string;
  path?: string;
  originalUrl?: string;
  ip?: string;
  headers?: Record<string, string>;
} = {}) {
  const req = {
    method,
    path,
    originalUrl,
    ip,
    headers: { ...headers },
    socket: { remoteAddress: ip },
    app: {
      get: vi.fn((key: string) => (key === "trust proxy" ? 1 : undefined)),
      set: vi.fn(),
    },
  } as unknown as Request;

  const resHeaders: Record<string, string> = {};
  let statusCode = 200;
  let responseBody: any = null;

  const res = {
    setHeader: vi.fn((key: string, val: string) => {
      resHeaders[key.toLowerCase()] = String(val);
    }),
    getHeader: vi.fn((key: string) => resHeaders[key.toLowerCase()]),
    status: vi.fn((code: number) => {
      statusCode = code;
      return res;
    }),
    json: vi.fn((body: any) => {
      responseBody = body;
      return res;
    }),
    sendStatus: vi.fn((code: number) => {
      statusCode = code;
      return res;
    }),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return {
    req,
    res,
    next,
    getStatusCode: () => statusCode,
    getBody: () => responseBody,
    getHeaders: () => resHeaders,
  };
}

describe("serverMiddleware — Límite de tasa, CORS y Anti-Falsificación", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetRateLimiterStore();
    stopPeriodicCleanup();
    resetTrustProxyFlagForTesting();
  });

  afterEach(() => {
    stopPeriodicCleanup();
    resetRateLimiterStore();
    vi.useRealTimers();
  });

  describe("Política de Límite de Tasa", () => {
    it("permite hasta 60 peticiones consecutivas dentro de la ventana de 60 segundos", () => {
      for (let i = 1; i <= RATE_LIMIT_MAX_REQUESTS; i++) {
        const { req, res, next, getStatusCode } = createMockReqRes({ ip: "192.168.1.100" });
        publicDirectoryRateLimiterMiddleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(getStatusCode()).toBe(200);
      }
    });

    it("bloquea la petición número 61 con código HTTP 429 y JSON sin detalles internos", () => {
      for (let i = 1; i <= RATE_LIMIT_MAX_REQUESTS; i++) {
        const { req, res, next } = createMockReqRes({ ip: "192.168.1.100" });
        publicDirectoryRateLimiterMiddleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
      }

      const { req, res, next, getStatusCode, getBody } = createMockReqRes({ ip: "192.168.1.100" });
      publicDirectoryRateLimiterMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatusCode()).toBe(429);
      expect(getBody()).toEqual({
        message: "Demasiadas peticiones. Intenta nuevamente en breve.",
      });
    });

    it("calcula la cabecera Retry-After en segundos con base en la petición más antigua", () => {
      const firstReq = createMockReqRes({ ip: "10.0.0.1" });
      publicDirectoryRateLimiterMiddleware(firstReq.req, firstReq.res, firstReq.next);

      vi.advanceTimersByTime(25_000);

      for (let i = 2; i <= RATE_LIMIT_MAX_REQUESTS; i++) {
        const { req, res, next } = createMockReqRes({ ip: "10.0.0.1" });
        publicDirectoryRateLimiterMiddleware(req, res, next);
      }

      const blockedReq = createMockReqRes({ ip: "10.0.0.1" });
      publicDirectoryRateLimiterMiddleware(blockedReq.req, blockedReq.res, blockedReq.next);

      expect(blockedReq.getStatusCode()).toBe(429);
      expect(blockedReq.getHeaders()["retry-after"]).toBe("35");
    });

    it("reinicia el límite tras expirar la ventana de 60 segundos", () => {
      for (let i = 1; i <= RATE_LIMIT_MAX_REQUESTS; i++) {
        const { req, res, next } = createMockReqRes({ ip: "10.0.0.2" });
        publicDirectoryRateLimiterMiddleware(req, res, next);
      }

      const blocked = createMockReqRes({ ip: "10.0.0.2" });
      publicDirectoryRateLimiterMiddleware(blocked.req, blocked.res, blocked.next);
      expect(blocked.getStatusCode()).toBe(429);

      vi.advanceTimersByTime(61_000);

      const allowedAfterWindow = createMockReqRes({ ip: "10.0.0.2" });
      publicDirectoryRateLimiterMiddleware(
        allowedAfterWindow.req,
        allowedAfterWindow.res,
        allowedAfterWindow.next
      );
      expect(allowedAfterWindow.next).toHaveBeenCalledTimes(1);
      expect(allowedAfterWindow.getStatusCode()).toBe(200);
    });

    it("garantiza aislamiento estricto entre diferentes IPs", () => {
      for (let i = 1; i <= RATE_LIMIT_MAX_REQUESTS; i++) {
        const { req, res, next } = createMockReqRes({ ip: "1.1.1.1" });
        publicDirectoryRateLimiterMiddleware(req, res, next);
      }

      const ipABlocked = createMockReqRes({ ip: "1.1.1.1" });
      publicDirectoryRateLimiterMiddleware(ipABlocked.req, ipABlocked.res, ipABlocked.next);
      expect(ipABlocked.getStatusCode()).toBe(429);

      const ipB = createMockReqRes({ ip: "2.2.2.2" });
      publicDirectoryRateLimiterMiddleware(ipB.req, ipB.res, ipB.next);
      expect(ipB.next).toHaveBeenCalledTimes(1);
      expect(ipB.getStatusCode()).toBe(200);
    });

    it("agrupa direcciones IPv6 por prefijo /64 evitando evasión por rotación", () => {
      const ip1 = "2001:db8:1234:5678:0000:0000:0000:0001";
      const ip2 = "2001:db8:1234:5678:ffff:ffff:ffff:ffff";

      expect(normalizeIp(ip1)).toBe("2001:db8:1234:5678::/64");
      expect(normalizeIp(ip2)).toBe("2001:db8:1234:5678::/64");

      // Consumir 30 peticiones con ip1
      for (let i = 1; i <= 30; i++) {
        const { req, res, next } = createMockReqRes({ ip: ip1 });
        publicDirectoryRateLimiterMiddleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
      }

      // Consumir 30 peticiones con ip2 (total 60 para el prefijo /64)
      for (let i = 1; i <= 30; i++) {
        const { req, res, next } = createMockReqRes({ ip: ip2 });
        publicDirectoryRateLimiterMiddleware(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
      }

      // La petición 61 debe ser bloqueada para cualquier dirección en el mismo prefijo /64
      const ip3 = "2001:db8:1234:5678:aaaa:bbbb:cccc:dddd";
      const blocked = createMockReqRes({ ip: ip3 });
      publicDirectoryRateLimiterMiddleware(blocked.req, blocked.res, blocked.next);

      expect(blocked.getStatusCode()).toBe(429);
      expect(blocked.next).not.toHaveBeenCalled();
    });

    it("comprueba exactamente qué entrada se expulsa en la política LRU al alcanzar el tope", () => {
      const reqOldest = createMockReqRes({ ip: "10.0.0.1" });
      publicDirectoryRateLimiterMiddleware(reqOldest.req, reqOldest.res, reqOldest.next);

      vi.advanceTimersByTime(1000);

      const reqSecond = createMockReqRes({ ip: "10.0.0.2" });
      publicDirectoryRateLimiterMiddleware(reqSecond.req, reqSecond.res, reqSecond.next);

      const evicted = evictLRU();
      expect(evicted).toBe("10.0.0.1");
      expect(getStoreKeys()).not.toContain("10.0.0.1");
      expect(getStoreKeys()).toContain("10.0.0.2");
    });
  });

  describe("Pruebas de Integración con Express Real y Anti-Falsificación (Requisito 3a y 3b)", () => {
    it("anti-falsificación con Express real: un atacante que falsifica X-Forwarded-For no evade el límite", async () => {
      vi.useRealTimers();

      const app = express();
      const middlewareMap = new Map();
      const configuredMap = serverMiddlewareFn(middlewareMap);

      for (const mw of configuredMap.values()) {
        app.use(mw);
      }

      app.post("/operations/get-public-specialists-directory", (_req, res) => {
        res.status(200).json({ ok: true });
      });

      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}/operations/get-public-specialists-directory`;

      const realAttackerIp = "198.51.100.99";

      try {
        // Enviar 60 peticiones donde el atacante inventa una IP falsa distinta en cada una,
        // pero el proxy de Render coloca la IP real al final de X-Forwarded-For
        for (let i = 1; i <= RATE_LIMIT_MAX_REQUESTS; i++) {
          const fakeIp = `203.0.113.${i}`;
          const res = await fetch(baseUrl, {
            method: "POST",
            headers: {
              // El atacante envió fakeIp; Render añadió realAttackerIp al final
              "X-Forwarded-For": `${fakeIp}, ${realAttackerIp}`,
            },
          });
          expect(res.status).toBe(200);
        }

        // Petición 61: El atacante vuelve a inventar otra IP, pero el proxy coloca su IP real
        const blockedRes = await fetch(baseUrl, {
          method: "POST",
          headers: {
            "X-Forwarded-For": `8.8.8.8, ${realAttackerIp}`,
          },
        });

        // Debe devolver HTTP 429 porque Express con trust proxy = 1 identificó a realAttackerIp
        expect(blockedRes.status).toBe(429);
        const body = await blockedRes.json();
        expect(body).toEqual({
          message: "Demasiadas peticiones. Intenta nuevamente en breve.",
        });
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it("prueba integrada: una respuesta HTTP 429 con Origin válido incluye Access-Control-Allow-Origin", async () => {
      vi.useRealTimers();

      const app = express();
      const middlewareMap = new Map();
      const configuredMap = serverMiddlewareFn(middlewareMap);

      for (const mw of configuredMap.values()) {
        app.use(mw);
      }

      app.post("/operations/get-public-specialists-directory", (_req, res) => {
        res.status(200).json({ ok: true });
      });

      const server = http.createServer(app);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}/operations/get-public-specialists-directory`;

      const validOrigin = "https://doctoria.linkear.net";

      try {
        // Llenar la cuota
        for (let i = 1; i <= RATE_LIMIT_MAX_REQUESTS; i++) {
          await fetch(baseUrl, {
            method: "POST",
            headers: { Origin: validOrigin },
          });
        }

        // Petición 61 bloqueada por límite de tasa
        const res429 = await fetch(baseUrl, {
          method: "POST",
          headers: { Origin: validOrigin },
        });

        expect(res429.status).toBe(429);
        // Debe llevar Access-Control-Allow-Origin para que el navegador no bloquee el 429
        expect(res429.headers.get("access-control-allow-origin")).toBe(validOrigin);
        expect(res429.headers.get("vary")).toBe("Origin");
        expect(res429.headers.get("retry-after")).toBeTruthy();
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });
  });

  describe("CORS Estricto y Orden de Middleware (Requisito 3d y 4)", () => {
    it("la prueba de orden parte del mapa de middleware por defecto de Wasp", () => {
      // Simular defaultGlobalMiddlewareConfig de Wasp 0.25
      const waspDefaultMap = new Map<string, express.RequestHandler>([
        ["helmet", ((_req, _res, next) => next()) as express.RequestHandler],
        ["cors", ((_req, _res, next) => next()) as express.RequestHandler],
        ["logger", ((_req, _res, next) => next()) as express.RequestHandler],
        ["express.json", ((_req, _res, next) => next()) as express.RequestHandler],
        ["express.urlencoded", ((_req, _res, next) => next()) as express.RequestHandler],
        ["cookieParser", ((_req, _res, next) => next()) as express.RequestHandler],
      ]);

      const configuredMap = serverMiddlewareFn(waspDefaultMap);
      const keys = Array.from(configuredMap.keys());

      const corsIdx = keys.indexOf("cors");
      const rateLimiterIdx = keys.indexOf("rateLimiter");
      const trustProxyIdx = keys.indexOf("trustProxySetup");

      expect(trustProxyIdx).toBe(0); // Configura trust proxy al inicio
      expect(corsIdx).toBeGreaterThanOrEqual(1);
      expect(rateLimiterIdx).toBeGreaterThan(corsIdx); // rateLimiter siempre después de cors
    });

    it("rechaza orígenes maliciosos como https://localhost.atacante.com y https://x.onrender.com", () => {
      const allowedOrigins = getAllowedOrigins();

      // Orígenes prohibidos que antes pasaban por endsWith o includes
      expect(allowedOrigins).not.toContain("https://localhost.atacante.com");
      expect(allowedOrigins).not.toContain("https://x.onrender.com");
      expect(allowedOrigins).not.toContain("https://malicious.linkear.net");
      expect(allowedOrigins).not.toContain("http://127.0.0.1.attacker.io");

      // Comprobar con la función de middleware
      const maliciousReq = createMockReqRes({
        headers: { origin: "https://localhost.atacante.com" },
      });
      const mockMap = new Map();
      const configuredMap = serverMiddlewareFn(mockMap);
      const corsMiddleware = configuredMap.get("cors")!;

      corsMiddleware(maliciousReq.req, maliciousReq.res, maliciousReq.next);

      // No debe emitir Access-Control-Allow-Origin
      expect(maliciousReq.getHeaders()["access-control-allow-origin"]).toBeUndefined();
      // Siempre debe emitir Vary: Origin
      expect(maliciousReq.getHeaders()["vary"]).toBe("Origin");
    });
  });
});
