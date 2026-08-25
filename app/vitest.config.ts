import { defineConfig } from "vitest/config";
import { config as loadEnv } from "dotenv";
import { expand } from "dotenv-expand";

// Carga .env.server (mismo archivo que usa `wasp start`) para que los tests
// que importan `wasp/server` pasen la validación de variables de entorno.
loadEnv({ path: ".env.server", quiet: true });
expand(loadEnv({ path: ".env.server", quiet: true }));

// El schema de env de Wasp solo acepta NODE_ENV=development|production;
// vitest inyecta "test", así que se normaliza antes de importar wasp/server.
process.env.NODE_ENV = "development";
if (!process.env.RESEND_API_KEY) process.env.RESEND_API_KEY = "";

export default defineConfig({
  // Los tests importan componentes .tsx; el tsconfig de la app usa
  // jsx:"preserve" (para el build con Vite), así que aquí se compila JSX.
  // Vite 8 transforma con oxc (las opciones de esbuild se ignoran).
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});
