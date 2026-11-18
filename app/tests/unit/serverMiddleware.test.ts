import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import {
  publicDirectoryRateLimiterMiddleware,
  resetRateLimiterStore,
  getStoreSize,
  stopPeriodicCleanup,
  startPeriodicCleanup,
  purgeExpired,
  evictLRU,
  resolveClientIp,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_MAX_STORE_SIZE,
} from "../../src/server/publicDirectoryRateLimiter";
import { serverMiddlewareFn } from "../../src/server/serverMiddleware";

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

describe("serverMiddleware — Límite de tasa para getPublicSpecialistsDirectory", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetRateLimiterStore();
    stopPeriodicCleanup();
  });

  afterEach(() => {
    stopPeriodicCleanup();
    resetRateLimiterStore();
    vi.useRealTimers();
  });

  it("permite hasta 60 peticiones consecutivas dentro de la ventana de 60 segundos", () => {
    for (let i = 1; i <= RATE_LIMIT_MAX_REQUESTS; i++) {
      const { req, res, next, getStatusCode } = createMockReqRes({ ip: "192.168.1.100" });
      publicDirectoryRateLimiterMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(getStatusCode()).toBe(200);
    }
  });

  it("bloquea la petición número 61 con código HTTP 429 y JSON sin detalles internos", () => {
    // 60 peticiones permitidas
    for (let i = 1; i <= RATE_LIMIT_MAX_REQUESTS; i++) {
      const { req, res, next } = createMockReqRes({ ip: "192.168.1.100" });
      publicDirectoryRateLimiterMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    }

    // Petición 61 bloqueada
    const { req, res, next, getStatusCode, getBody } = createMockReqRes({ ip: "192.168.1.100" });
    publicDirectoryRateLimiterMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(getStatusCode()).toBe(429);
    expect(getBody()).toEqual({
      message: "Demasiadas peticiones. Intenta nuevamente en breve.",
    });
  });

  it("calcula la cabecera Retry-After en segundos con base en la petición más antigua", () => {
    // Primera petición en t = 0
    const firstReq = createMockReqRes({ ip: "10.0.0.1" });
    publicDirectoryRateLimiterMiddleware(firstReq.req, firstReq.res, firstReq.next);

    // Avanzamos 25 segundos (t = 25.000 ms)
    vi.advanceTimersByTime(25_000);

    // Completamos hasta 60 peticiones
    for (let i = 2; i <= RATE_LIMIT_MAX_REQUESTS; i++) {
      const { req, res, next } = createMockReqRes({ ip: "10.0.0.1" });
      publicDirectoryRateLimiterMiddleware(req, res, next);
    }

    // Petición 61 en t = 25.000 ms. Como la primera fue en t = 0, restan 60s - 25s = 35s
    const blockedReq = createMockReqRes({ ip: "10.0.0.1" });
    publicDirectoryRateLimiterMiddleware(blockedReq.req, blockedReq.res, blockedReq.next);

    expect(blockedReq.getStatusCode()).toBe(429);
    expect(blockedReq.getHeaders()["retry-after"]).toBe("35");
  });

  it("reinicia el límite tras expirar la ventana de 60 segundos", () => {
    // Llenar cuota de 60
    for (let i = 1; i <= RATE_LIMIT_MAX_REQUESTS; i++) {
      const { req, res, next } = createMockReqRes({ ip: "10.0.0.2" });
      publicDirectoryRateLimiterMiddleware(req, res, next);
    }

    // Confirmar que la 61 está bloqueada
    const blocked = createMockReqRes({ ip: "10.0.0.2" });
    publicDirectoryRateLimiterMiddleware(blocked.req, blocked.res, blocked.next);
    expect(blocked.getStatusCode()).toBe(429);

    // Avanzar 61 segundos (ventana completa expirada)
    vi.advanceTimersByTime(61_000);

    // Debe permitirse nuevamente
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
    // Agotar cuota para IP A
    for (let i = 1; i <= RATE_LIMIT_MAX_REQUESTS; i++) {
      const { req, res, next } = createMockReqRes({ ip: "1.1.1.1" });
      publicDirectoryRateLimiterMiddleware(req, res, next);
    }

    // IP A bloqueada
    const ipABlocked = createMockReqRes({ ip: "1.1.1.1" });
    publicDirectoryRateLimiterMiddleware(ipABlocked.req, ipABlocked.res, ipABlocked.next);
    expect(ipABlocked.getStatusCode()).toBe(429);

    // IP B debe poder realizar peticiones con normalidad
    const ipB = createMockReqRes({ ip: "2.2.2.2" });
    publicDirectoryRateLimiterMiddleware(ipB.req, ipB.res, ipB.next);
    expect(ipB.next).toHaveBeenCalledTimes(1);
    expect(ipB.getStatusCode()).toBe(200);
  });

  it("no aplica límite a peticiones OPTIONS ni cuenta para la cuota", () => {
    for (let i = 1; i <= 100; i++) {
      const { req, res, next, getStatusCode } = createMockReqRes({
        method: "OPTIONS",
        ip: "10.0.0.3",
      });
      publicDirectoryRateLimiterMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(getStatusCode()).toBe(200);
    }
    expect(getStoreSize()).toBe(0);
  });

  it("no aplica límite a otras rutas de operaciones ni a consultas distintas", () => {
    for (let i = 1; i <= 80; i++) {
      const { req, res, next, getStatusCode } = createMockReqRes({
        method: "POST",
        path: "/operations/get-patients",
        originalUrl: "/operations/get-patients",
        ip: "10.0.0.4",
      });
      publicDirectoryRateLimiterMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(getStatusCode()).toBe(200);
    }
    expect(getStoreSize()).toBe(0);
  });

  it("tope de 10.000 IPs: purga primero entradas vencidas y luego expulsa la menos reciente (LRU)", () => {
    // 1. Insertamos 10.000 IPs en t = 0
    for (let i = 1; i <= RATE_LIMIT_MAX_STORE_SIZE; i++) {
      const { req, res, next } = createMockReqRes({ ip: `10.0.${Math.floor(i / 256)}.${i % 256}` });
      publicDirectoryRateLimiterMiddleware(req, res, next);
    }
    expect(getStoreSize()).toBe(RATE_LIMIT_MAX_STORE_SIZE);

    // Avanzamos el tiempo para que las primeras 10.000 IPs expiren
    vi.advanceTimersByTime(RATE_LIMIT_WINDOW_MS + 1000);

    // Insertamos una nueva IP: debe purgar las vencidas y mantener el tamaño acotado
    const newIpReq = createMockReqRes({ ip: "172.16.0.1" });
    publicDirectoryRateLimiterMiddleware(newIpReq.req, newIpReq.res, newIpReq.next);

    expect(newIpReq.next).toHaveBeenCalledTimes(1);
    // El tamaño debe haberse reducido drásticamente tras la purga
    expect(getStoreSize()).toBe(1);

    // 2. Probamos expulsión LRU cuando ninguna entrada ha vencido aún
    resetRateLimiterStore();
    for (let i = 1; i <= RATE_LIMIT_MAX_STORE_SIZE; i++) {
      const { req, res, next } = createMockReqRes({ ip: `10.1.${Math.floor(i / 256)}.${i % 256}` });
      publicDirectoryRateLimiterMiddleware(req, res, next);
    }
    expect(getStoreSize()).toBe(RATE_LIMIT_MAX_STORE_SIZE);

    // Accedemos a la IP 10.1.0.2 para renovar su uso
    const touchReq = createMockReqRes({ ip: "10.1.0.2" });
    publicDirectoryRateLimiterMiddleware(touchReq.req, touchReq.res, touchReq.next);

    // Ahora insertamos una IP que obligue a expulsar por LRU
    const overflowReq = createMockReqRes({ ip: "192.168.254.1" });
    publicDirectoryRateLimiterMiddleware(overflowReq.req, overflowReq.res, overflowReq.next);

    // El tamaño se mantiene en 10.000
    expect(getStoreSize()).toBe(RATE_LIMIT_MAX_STORE_SIZE);
  });

  it("no permite evadir el límite mediante cabeceras X-Forwarded-For falsificadas", () => {
    // Un atacante con IP real 198.51.100.77 intenta inyectar IPs falsas en X-Forwarded-For
    for (let i = 1; i <= RATE_LIMIT_MAX_REQUESTS; i++) {
      const fakeSpoofedIp = `203.0.113.${i}`; // Atacante falsifica una IP distinta en cada request
      const { req, res, next } = createMockReqRes({
        ip: "198.51.100.77", // IP resuelta por Express (o agregada por el proxy de Render al final)
        headers: {
          "x-forwarded-for": `${fakeSpoofedIp}, 198.51.100.77`,
        },
      });
      publicDirectoryRateLimiterMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    }

    // La petición 61, aunque envíe una nueva IP falsa como prefijo, sigue teniendo la IP real al final
    const attackReq61 = createMockReqRes({
      ip: "198.51.100.77",
      headers: {
        "x-forwarded-for": `1.2.3.4, 198.51.100.77`,
      },
    });
    publicDirectoryRateLimiterMiddleware(attackReq61.req, attackReq61.res, attackReq61.next);

    // Es bloqueado porque la IP evaluada es 198.51.100.77 y no el prefijo falsificado
    expect(attackReq61.getStatusCode()).toBe(429);
    expect(attackReq61.next).not.toHaveBeenCalled();
  });

  it("demuestra que serverMiddlewareFn registra el rateLimiter DESPUÉS de cors en el Map", () => {
    const mockMap = new Map();
    serverMiddlewareFn(mockMap);

    const keys = Array.from(mockMap.keys());
    const corsIndex = keys.indexOf("cors");
    const rateLimiterIndex = keys.indexOf("rateLimiter");

    expect(corsIndex).toBeGreaterThanOrEqual(0);
    expect(rateLimiterIndex).toBeGreaterThan(corsIndex);
  });
});
