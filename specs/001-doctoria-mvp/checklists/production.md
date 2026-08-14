# Production Checklist: DoctorIA MVP (Staging)

**Purpose**: Verificar que el MVP está desplegado y operativo en staging, listo para validación y pilotos.
**Date**: 2026-08-13
**Branch**: `main` (deploy de Render)
**Feature**: [spec.md](../spec.md) · [tasks.md](../tasks.md) · [QA report](../qa/week4-qa-report.md)

---

## 1. Despliegue e Infraestructura

- [x] Staging accesible por HTTPS con certificado SSL válido (Render free tier, TLS automático)
  - Client: `https://doctoria-client.onrender.com`
  - Server API: `https://doctoria-server.onrender.com`
- [x] Base de datos PostgreSQL 18 en Render (`doctoria-db`), migraciones aplicadas en cada deploy (`prisma migrate deploy` en `startCommand`)
- [x] `render.yaml` blueprint con 3 servicios: `doctoria-server` (Node/Wasp), `doctoria-client` (Vite estático + `200.html` SPA fallback), `doctoria-db` (Postgres 18)
- [x] Deploy automático desde `main` (webhook push); deploy manual del client requerido en esta iteración (ver Notas)
- [x] Variables de entorno configuradas: `DATABASE_URL`, `JWT_SECRET`, `WASP_SERVER_URL`, `WASP_WEB_CLIENT_URL`, `RESEND_API_KEY`, `ADMIN_EMAILS`, `REACT_APP_API_URL`

## 2. Seeds y Datos Sintéticos

- [x] Cuentas autorizadas sembradas en staging (email verificado, password `Doctoria2026!`):
  - `admin@doctoria.com` (Admin)
  - `medico1@doctoria.com` (Médico)
  - `medico2@doctoria.com` (Médico)
- [x] Seed idempotente (`upsert`) ejecutado en el arranque del server vía `WASP_DB_SEED_NAME=seedSyntheticClinicalData` + `bundle/dbSeed.js`
- [x] 6 pacientes sintéticos (PAC-001 .. PAC-006) con historia clínica, alergias y 12 accesos médico↔paciente
- [x] Cero PII real en datos (Constitución P5)

## 3. Autenticación y Sesión

- [x] Login con cuentas seed devuelve HTTP 200 vía `/auth/email/login`
- [x] `/auth/me` responde 200 (health)
- [x] Sesión persiste entre páginas (cookie firmada)
- [x] Credenciales inválidas devuelven error controlado (401 + mensaje, sin crash)
- [x] Redirección post-login correcta a `/clinical/patients`

## 4. QA — Flujos de Usuario (Browser Subagent + verificación E2E)

- [x] **5/5 pruebas de flujo superadas** contra staging (ver [QA report](../qa/week4-qa-report.md)):
  1. Home → `Comenzar` → intake guiado (`/clinical/voice`, auth guard a `/login`)
  2. Entry points de la home visibles
  3. Inicio de sesión desde la home
  4. Continuidad de sesión tras sign-in
  5. Recuperación de credenciales inválidas
- [x] Fix QA aplicado: CTA `Comenzar` apunta a `ClinicalVoiceRoute` (commit `94b6fe0`)

## 5. Alineación a Especificación (smoke)

- [x] Módulo clínico servido en rutas `/clinical/*` (authRequired)
- [x] RBAC: guard `ensureMedico` / `ensureAdmin` con roles mutuamente excluyentes
- [x] Inmutabilidad de registros CONFIRMED vía adendas (implementado en `services/immutability.ts`)

## 6. No aplica / Pendiente (documentado)

- [ ] Email de verificación en producción: `onboarding@resend.dev` es remitente provisional (entrega solo a la cuenta Resend registrada). Para pilotos se requiere dominio verificado en Resend.
- [ ] Checklist de producción para entorno `prod` final con dominio propio (los planes free no permiten custom domain; plan pagado requerido)

## Notas

- **Deploy del client**: en esta iteración el push a `main` no disparó el redeploy automático del client; se requirió **Manual Deploy** desde el dashboard de Render. Recomendado: verificar trigger configurado antes del siguiente deploy.
- **Sleep free tier**: el server free se duerme tras ~15 min de inactividad; el primer request puede tardar ~30–50 s (wake). Registrado como RNF-013.
- **Expiración**: la DB free expira a los 30 días; plan pagado necesario para persistencia de largo plazo en pilotos.

**Result**: ✅ MVP operativo en staging — Semana 4 cerrada. Firma pendiente de revisión en equipo (dinámica Semana 4).