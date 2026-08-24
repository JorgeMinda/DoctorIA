import { defineConfig } from "vitest/config";

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
