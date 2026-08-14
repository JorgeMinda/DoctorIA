# DoctorIA — app/ (módulo Wasp)

Override específico del módulo `app/`. Para las reglas globales del proyecto (dominio, arquitectura, docs), lee primero `../AGENTS.md` en la raíz del repo.

## Específico de `app/`

- Build del proyecto Wasp (genera `.wasp/out`): ejecutar desde `app/` con el binario de Wasp del PATH (Node v24.19.0 via nvm en WSL).
- Tests unitarios: Vitest (43 tests) — `node node_modules/vitest/dist/cli.js run` (desde `app/`, en la copia de trabajo).
- E2E: Playwright desde `e2e-tests/` contra la app levantada en `localhost:3000/3001` (dev) o contra staging.
- No editar `.wasp/out/` (build generado).