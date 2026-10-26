import { cors } from "cors";

const allowedOrigin = process.env.WASP_WEB_CLIENT_URL ?? "https://doctoria-client.onrender.com";

export const corsMiddleware = cors({
  origin: allowedOrigin,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
});