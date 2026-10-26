import type { MiddlewareConfigFn } from "wasp/server/middleware";

export const serverMiddlewareFn: MiddlewareConfigFn = (middlewareConfig) => {
  middlewareConfig.set("cors", (req, res, next) => {
    const origin = req.headers.origin as string | undefined;

    const allowedExactOrigins = [
      "https://doctoria-client.onrender.com",
      "https://doctoria.linkear.net",
      "https://doctoria-server.onrender.com",
      process.env.WASP_WEB_CLIENT_URL,
    ]
      .filter((u): u is string => Boolean(u))
      .map((u) => u.replace(/\/$/, ""));

    const isAllowed =
      !origin ||
      allowedExactOrigins.includes(origin) ||
      origin.endsWith(".onrender.com") ||
      origin.endsWith(".linkear.net") ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1");

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
      res.sendStatus(204);
      return;
    }

    next();
  });

  return middlewareConfig;
};
