# CONTEXT: DoctorIA MVP — Estado actual del proyecto (para IA colaboradora)

**Última actualización**: 2026-11-08 · **Rama de trabajo**: `main` directo (desde la sesión nov-2026; antes `001-doctoria-mvp` → `main`)
**Autor de este contexto**: agente principal del equipo DoctorIA

> **Reglas de comportamiento para agentes** (dominio, arquitectura, off-limits, comandos): ver [AGENTS.md](AGENTS.md) en la raíz. Este `CONTEXT.md` documenta el **estado mutable** del proyecto (cambia cada sesión); `AGENTS.md` documenta lo **casi-estático**.

Este documento resume el estado completo del proyecto para que una IA colaboradora entre en contexto rápido sin perder los lineamientos (Constitución P1–P10, especificación, plan técnico, y el avance real del sprint).

---

## 1. Qué es DoctorIA

MVP de un **SaaS de asistencia de IA para historias clínicas** en español. El médico dicta/escribe texto libre y DoctorIA lo estructura en secciones predefinidas de la nota clínica (y epicrisis). La IA es **exclusivamente asistiva**: nunca confirma, diagnostica ni prescribe (Constitución P4). En producción opera con datos de pacientes reales protegidos; dev/demo usan datos sintéticos (Constitución P5).

### Estructura de 8 semanas (curso de emprendimiento, 7 Doers)

| Semana | Fechas | Estado |
|:--|:--|:--|
| 1. Investigación (campo/mercado) | 13–19 jul | ⚠️ Parcial — 5/8 entrevistas; cuadro competitivo e investigación técnica documentadas |
| 2. Especificación | 20–26 jul | ✅ spec.md + plan.md + research.md (fechados 08-ago, desfase documentado) |
| 3. Desarrollo del Core | 27 jul–2 ago | ✅ CERRADA — MVP funcional en staging + tasks.md T001–T020 |
| 4. QA y Producción | 3–9 ago | ✅ CERRADA — HTTPS, QA 5/5, production-checklist |
| 5. Estrategia comercial | 10–16 ago | ✅ según tasks.md (T032–T035) — plan de adquisición + agenda de 5 contactos (`week5-commercial-plan.md`) |
| 6. Ejecución comercial | 17–23 ago | ✅ según tasks.md (T036–T039) |
| 7. Iteración con datos | 24–30 ago | ✅ según tasks.md (T040–T043) |
| 8. Demo Day | 31 ago–6 sep | ✅ según tasks.md (T044–T047) |

---

## 2. Stack y arquitectura

- **Framework**: Wasp 0.25.0 (template Open SaaS) — app monolítica, TypeScript 6.0.3, Node ≥24.14.1 (local WSL: Node v24.19.0 vía nvm)
- **Frontend**: React 19.2.x, TailwindCSS 4.x, Radix UI, lucide-react
- **Backend**: Express (Wasp), Prisma 5.19.1 + PostgreSQL
- **Pruebas**: Vitest 4.1.x (unit/integration, 195 tests / 13 archivos), Playwright 1.55.1 (E2E)
- **Despliegue**: Render (blueprint `render.yaml`) — client estático Vite + server Node + Postgres 18 free tier
- **Email**: Resend (remitente provisional `onboarding@resend.dev`; solo entrega a la cuenta Resend registrada)

### Estructura del código (`app/`)

```
app/
├── main.wasp.ts              # Composición de la app (app, auth, db.seeds, emailSender, routes)
├── schema.prisma             # Modelos: User(+isMedico), SyntheticPatient, ClinicalNote, Epicrisis, AuditLog, MedicoPatientAccess
├── src/
│   ├── auth/                 # Auth email/password + ADMIN_EMAILS (isAdmin por signup)
│   ├── clinical/             # MÓDULO CLÍNICO (core del MVP)
│   │   ├── clinical.wasp.ts  # Routes/queries/actions spec (7 rutas /clinical/*)
│   │   ├── operations.ts     # Implementaciones server
│   │   ├── queries.ts / actions.ts
│   │   ├── services/         # authorization.ts (guards RBAC), ai-structuring.ts (contrato IA), audit.ts, immutability.ts, note-validation.ts, voiceAssistant.ts
│   │   └── pages/            # Patients, PatientDetail, Note, Epicrisis, Audit, Admin, Voice
│   ├── landing-page/         # Landing (Hero, FeaturesGrid, FinalCTA, Testimonials, FAQ, Footer, VoiceOrbHero)
│   ├── auth/                 # Auth email/password + layout "Ambient Voice Interface" (AuthPageLayout, ambientAuthTheme)
│   ├── user/                 # Operaciones de usuarios (admin)
│   ├── client/               # App root, componentes UI (ui/, clinical-layout/), layout
│   ├── server/               # env, scripts/dbSeeds.ts
│   └── shared/
├── .wasp/out/                # Build generado (SDK, server, web-app) — NO editar
└── e2e-tests/                # Playwright (corren desde Windows contra localhost:3000)
```

### Rutas clínicas (authRequired)

- `/clinical/patients` — listado y búsqueda de pacientes
- `/clinical/patients/:patientId` — detalle + historial
- `/clinical/notes/:noteId` — nota clínica
- `/clinical/epicrises/:epicrisisId` — epicrisis
- `/clinical/audit` — auditoría personal
- `/clinical/admin` — administración
- `/clinical/voice` — **asistencia guiada por voz (flujo de intake)**
- `/` — landing (prerender) · `/login`, `/signup` — auth

---

## 3. Modelo de roles y autorización (RBAC)

| isAdmin | isMedico | Rol funcional |
|:--|:--|:--|
| false | false | Autenticado sin acceso clínico |
| false | true | **Médico** — opera sobre pacientes autorizados |
| true | false | **Administrador** — gestión de cuentas, roles, pacientes sintéticos |
| true | true | INVÁLIDO — bloqueado por guards (403) |

Reglas clave:
- El signup es público; un usuario NO obtiene acceso clínico hasta que un admin habilite `isMedico`.
- `ensureMedico` (requiere isMedico && !isAdmin) y `ensureAdmin` en toda operación server.
- **Médico↔Paciente**: acceso por tabla `MedicoPatientAccess`; verificación server-side en cada operación patient-scoped.
- Registro clínico CONFIRMED es inmutable; corrección solo vía **adenda** (nuevo registro self-ref con `addendumReason` obligatorio).
- Auditoría funcional en `AuditLog` (sin contenido clínico); logs técnicos separados.

---

## 4. Estado de despliegue (staging)

- **Client**: `https://doctoria-client.onrender.com` (estático, SPA fallback `200.html`)
- **Server API**: `https://doctoria-server.onrender.com`
- **DB**: `doctoria-db` (Postgres 18, free — expira en 30 días)
- **Deploy**: Render con blueprint `render.yaml` (rootDir `app`, branch `main`). El `startCommand` del server ejecuta `prisma migrate deploy` + **seeds** + start.
- **Free tier caveats**: el server duerme tras ~15 min (primer request tarda 30–50 s); deploy del client a veces requiere Manual Deploy (verificado 13-ago).

### Cuentas de acceso (sembradas en staging)

| Rol | Email | Password |
|:--|:--|:--|
| Admin | `admin@doctoria.com` | `Doctoria2026!` |
| Médico | `medico1@doctoria.com` | `Doctoria2026!` |
| Médico | `medico2@doctoria.com` | `Doctoria2026!` |

Pacientes sintéticos: PAC-001 … PAC-006 (historia clínica + alergias). 12 accesos médico↔paciente.

---

## 5. QA (Semana 4 — cerrada)

- **5/5 flujos E2E superados** contra staging: (1) Home→Comenzar→intake, (2) entry points visibles, (3) login desde home, (4) sesión persistente, (5) credenciales inválidas controladas.
- **Defecto D-01 corregido** (commit `94b6fe0`): el CTA `Comenzar` (Hero + FinalCTA) apuntaba a `SignupRoute`; ahora apunta a `ClinicalVoiceRoute` (`/clinical/voice`), que redirige a `/login` por auth guard — en vez de signup.
- Documentos: `specs/001-doctoria-mvp/qa/week4-qa-report.md` y `specs/001-doctoria-mvp/checklists/production.md`.
- **E2E flujo clínico completo (16-ago)**: verificado por API contra producción (login → create-note → IA → edición draft → confirm → audit, 6/6 pasos). Hallazgo **CRITICAL**: `requestAIStructuring` (actions.ts L197-210) escribe sin revalidar el estado de la nota, de modo que una llamada IA que quedó en vuelo puede sobrescribir ediciones manuales del médico; reportado en `week4-qa-report.md` (sección *Flujo clínico completo*) — **corregido el 24-ago** (`daba56e`: CAS `expectedUpdatedAt` server-side + envío desde el cliente).
- Suites locales: Vitest **195/195** verde (13 archivos; era 43 al cierre de Semana 4), Playwright E2E 10/10 verde.

### Sesión nov-2026 (5–8 nov) — Asistente de voz flotante + asistencia híbrida — COMPLETO

- **Asistente de voz flotante** (`client/components/FloatingVoiceAssistant.tsx` + `client/voice/floatingVoice.ts`): botón-orbe fijo con Web Speech API (dictado), router de intención (navegación a rutas clínicas), TTS con respaldo; overlay `z-[100]` por encima de modales Radix (anillos decorativos `pointer-events-none`; `onMouseDown`/`onPointerDown` `stopPropagation` para no robar el foco del micrófono).
- **Correcciones de voz**: verbos `busca|abre|consulta|mostrar` + `agenda (una|la) cita`; `stopListening()` explícito tras cada resultado del recognizer (micrófono no se congela); guard de estado obsoleto en `toggleListening`; `?new=1` se limpia al abrir el modal para reabrir en cada comando.
- **Asistente híbrido (RF-030 + RF-031)**: el flotante —solo médico, gates `wantsCreateNote`/`wantsPatientSummary` en `floatingVoice.ts`— ejecuta `getVoiceAssistantResponse` (resumen de paciente en panel expandido `w-80`, viñetas, aviso P4, enlace "Ver ficha completa") y `createNoteFromVoice` (nota creada → panel + TTS + enlace a la nota). Ambas operations server-side con `ensureMedico` + auditoría (RNF-002). La página `/clinical/voice` se conserva (chips, sparkline, demo, transcripción progresiva).
- **Navegación**: link "Asistente de voz" retirado del sidebar/topbar (`nav-items.ts`, `NavBar/constants.ts`) y del detalle de paciente; `/clinical/voice` queda accesible por CTA de landing (`Hero`/`FinalCTA`), comando de voz y URL directa (con título de sección).
- **Búsqueda de pacientes sin tildes**: fold de acentos server-side — "andres" encuentra "Andrés" (`fc277ce`).
- **Docs**: Constitución P5 → "Protección de Datos Clínicos" v2.0.0 (prod con datos reales cifrados; dev/demo solo sintéticos) — `6a4d2c9`.
- **Validación**: Vitest **195/195** + `tsc --noEmit` limpio (copia Windows); builds/migraciones validados en Render tras cada push. Commits `f43264d`…`8b6245a` en `main`.
- **8-nov (cierre)**: deuda CRITICAL del race `requestAIStructuring` documentada como resuelta (ya implementada desde `daba56e`); `@unique` en `SyntheticPatient.documento` + migración `20261108235104` aplicada en local y staging (`f756540`; chequeo de duplicados OK, seeds upsert idempotentes, deploy verificado 200/200); badges de citas unificados con `STATUS_CONFIG` + iniciales + inmutabilidad en `MedicoAgendaPanel` (`8f368a5`); Docker apartado del flujo de BD (contenedor `doctoria-db` devuelto a su estado original; sin cambios estructurales pendientes).

### Rediseño visual "Clinical Intelligence" (frente de UI, 17–18 ago) — COMPLETO

- **Tokens + tipografía** (`app/src/client/Main.css`): paleta dark exacta de la referencia (#111318 fondo, #00daf3 primary, surfaces, outlines) + light adaptada; `@theme inline` con `surface`, `surface-container`, `surface-high`, `surface-highest`, `outline`, `outline-variant`, `primary-bright`; fuentes **Hanken Grotesk** (sans) + **JetBrains Mono** (mono) vía `head.wasp.ts`; utilities `glass-panel`, `text-glow-primary`, `mono-label`.
- **Layout clínico** (`app/src/client/components/clinical-layout/`): `Sidebar` (256px, grupos Clínica/Gestión, item activo cyan con glow, footer usuario), `Topbar` (título de sección + breadcrumb mono + dark mode + user dropdown), `ClinicalLayout` (sidebar desktop + Sheet móvil), `nav-items.ts` (`isClinicalNavItemActive`). `App.tsx`: `/clinical/*` → `ClinicalLayout`; landing y auth intactas.
- **Páginas clínicas rediseñadas** (misma lógica/queries/RBAC/rutas): Pacientes (dashboard con stats reales + tabla profesional + badges), Detalle de paciente (identidad + contadores + historial), Nota clínica (texto original inmutable RNF-004 + secciones + adendas), Epicrisis, Auditoría (timeline), Admin (tarjetas de gestión), Voz (pase de consistencia; orbe intacto).
- **Componentes nuevos**: `client/components/ui/badge.tsx`, `clinical/components/StatusBadge.tsx`, `clinical/services/clinicalFormat.ts`.
- **Auth "Ambient Voice Interface"** (`app/src/auth/`): fondo oscuro + gradientes cyan/violeta/verde + orbe decorativo + tarjeta glass (`AuthPageLayout`), formularios Wasp tematizados vía prop oficial `appearance` + CSS scoped (`ambientAuthTheme.ts`) en Login, Signup, Reset y Verify. **Solo capa visual** — no se tocó `useAuth`, validación, campos ni redirects.
- **Validación visual contra prod (18-ago)**: Playwright `e2e-tests/playwright.prod.config.ts` + `tests/redesignProdValidation.spec.ts` → **4/4 verde** contra `doctoria-client.onrender.com` (login ambiental, dashboard médico, detalle de paciente, auditoría + voz). `tsc -p tsconfig.src.json` limpio salvo el error preexistente `aiService.ts:57` (OPENROUTER_API_KEY del SDK); Vitest no-IA 36/36.
- Commits: `26be1fa` (tokens+layout), `3984528` (fix build crossorigin), `27fe648` (páginas clínicas), `61dca5b` (auth ambiental). Todos en `main`.

---

## 6. Repositorio y flujo de trabajo

- **Remote**: `https://github.com/JorgeMinda/DoctorIA` (user `JorgeMinda`)
- **Rama de trabajo**: `main` directo (desde la sesión nov-2026; antes se trabajaba en `001-doctoria-mvp` y se promovía a `main`). Render deploya `main` en ~2 min.
- **Copia activa (nov-2026)**: Windows `C:\Users\minda\Desktop\doctoria\doctoria` — desarrollo, commits y push desde aquí (Git Credential Manager). Tests: `node node_modules/vitest/dist/cli.js run` (workdir `app/`).
- **Copia WSL** `/home/minda/DoctorIA`: histórica; única conocida con `wasp` instalado (`wasp build`, `wasp db migrate dev`). En Windows NO hay `wasp` — build y migraciones se validan/aplican en Render. El WSL git NO tiene credenciales GitHub (push desde WSL queda colgado).

### Comandos útiles (desde WSL nativo `/home/minda/DoctorIA/app`)

```bash
# Build (genera .wasp/out)
export PATH=/home/minda/.nvm/versions/node/v24.19.0/bin:$PATH
wasp build
# Server local (dev): wasp start; e2e desde Windows contra localhost:3000/3001
```

### Documentación del feature (fuente de verdad)

```
specs/001-doctoria-mvp/
├── spec.md                # Especificación funcional (29 RF, 13 RNF, C-01..C-05)
├── plan.md                # Plan técnico + Constitution checks
├── research.md            # Decisiones técnicas (R-01..R-10)
├── data-model.md          # Modelo de datos + máquina de estados
├── quickstart.md          # Guía de validación E2E
├── contracts/clinical-operations.md  # Contratos de operaciones + AI service
├── checklists/
│   ├── requirements.md    # QA de la spec
│   └── production.md      # Checklist producción (Semana 4, 100%)
├── qa/week4-qa-report.md  # Reporte QA (D-01 + verificación 5/5 + flujo clínico completo 16-ago)
├── qa/week34-informe.md   # Informe detallado de las Semanas 3-4 (16-ago, mismo formato que Semana 2)
└── tasks.md               # Registro de tareas T001–T060 (Semanas 3–8 + sesión nov-2026)
```

---

## 7. Decisiones pendientes y deudas técnicas

| Proveedor de IA (PD-01) | ✅ **RESUELTO** — Integrado vía **OpenRouter** (`https://openrouter.ai/api/v1/chat/completions`, modelo `openai/gpt-oss-20b:free` en dev/demo). Gemini quedó bloqueado (403) en la cuenta; se migró a OpenRouter. `OPENROUTER_API_KEY` ya configurada en Render y server corriendo sin errores (15-ago). Para producción usar clave paga/BYOK y modelo superior. |
| Email verificado en Resend | PENDIENTE — `onboarding@resend.dev` no permite verificar cuentas arbitrarias; para pilotos se necesita dominio verificado |
| Entrevistas de Semana 1 | Deuda — 5/8; continúa validación con pilotos |
| Google Stitch (PD-03) | ✅ **HECHO** — pantallas del flujo clínico diseñadas e implementadas (UI directa validada, 15-ago) |
| Deploy manual del client | Documentado como caveat del free tier |
| Race en `requestAIStructuring` | ✅ **RESUELTO** (24-ago, `daba56e`, FASE 3+7) — CAS con `expectedUpdatedAt`: fail-fast 409 antes de gastar la llamada IA + `update` atómico `where:{id,updatedAt}` tras la IA (P2025→409); el cliente envía `expectedUpdatedAt` y maneja 409/502 con mensaje unificado (`ClinicalNotePage.tsx:317-324`) |
| Latencia IA (residual ~25–55 s) | PENDIENTE — **MAJOR, parcialmente mitigado**: ya `AI_MAX_RETRIES=1` y `AI_TIMEOUT_MS=25_000` en `aiService.ts` (máx. 2 intentos ≈ 55 s; el registro de 120–130 s era con 3×30 s, 16-ago). **8-nov**: cola single-slot FIFO en memoria (`services/aiQueue.ts`, sin tablas) + progreso visible en la nota (colado/posición/segundos vía `aiProgress` en `getClinicalNote`, T065). Sigue pendiente el techo de latencia del proveedor free |
| IA no determinista | ✅ **MITIGADO** (8-nov verificado) — `temperature: 0` ya aplicado en `aiService.ts` (L185, L315); queda solo variabilidad intrínseca del modelo free, seguimiento en QA manual |
| DB free expira 30 días | Requiere plan pagado para pilotos largos |
| CORS (fix `b62bf4e`) | ✅ **VERIFICADO EN VIVO** (8-nov) — `GET /auth/me` y preflight `OPTIONS /auth/email/login` responden desde producción: `access-control-allow-origin: https://doctoria-client.onrender.com` + `allow-credentials: true` + métodos/headers completos (200/204) |
| UX conflicto CAS: devolver `aiDraft` en 409 | ✅ **RESUELTO** (8-nov, T064) — `requestAIStructuring` devuelve `{status:"CONFLICT", aiDraft}` en P2025 (audita `status:CONFLICT`; el fail-fast pre-IA sigue lanzando 409) y `ClinicalNotePage` ofrece "Aplicar borrador IA" vs "Conservar mis cambios" con `useConfirm` |
| `schema.prisma`: `documento @unique` | ✅ **RESUELTO** (8-nov, `f756540`) — `SyntheticPatient.documento` con `@unique`; migración `20261108235104_add_unique_synthetic_patient_documento` generada con `prisma migrate diff` y aplicada en local + staging (deploy verificado 200/200); chequeo de duplicados OK; seeds idempotentes (upsert por `syntheticId`). Docker NO es requisito de la BD |
| UI badges de estado de cita | ✅ **RESUELTO** (8-nov) — componente compartido `clinical/components/CitaBadge.tsx` + `STATUS_CONFIG` como fuente única (label/short/variant): panel médico (`8f368a5`), **lista de agenda** (4 vistas, con iniciales), **calendario** (bloque de día + diálogo de detalle con iniciales), **portal del paciente** (píldora propia con labels desde `STATUS_CONFIG`; conserva los casos "Por confirmar/Confirmada" de secretaría), **detalle de paciente** (vista médico y secretaría) y **panel de admin** (T062, reemplaza `AdminCitaBadge` local). Label COMPLETED unificado a **"Completada"**. Descartado: campos `formCost/formObservation` (sin columnas nuevas en `Cita`, decisión 8-nov) |
| Email de vinculación de paciente | PENDIENTE — **MINOR**: `getPatientLinkEmailContent` (`auth/email-and-pass/emails.ts:28`) está definido pero NUNCA se usa; el flujo `PatientLinkRequest` no envía ningún email (la notificación es solo visual en UI) |
| Seeds: cuentas paciente sin vínculo | PENDIENTE — **MINOR**: `dbSeeds.ts:239-244` crea 6 cuentas (`PAC-008..013`) que no existen como pacientes (solo se siembran PAC-001..006) → esas cuentas quedan sin vínculo a ningún paciente (portal vacío). Corregir para que apunten a PAC-001..006 o crear esos pacientes |
| Cobertura de tests | ✅ **RESUELTO** (8-nov, T063) — **247/247 tests en 19 archivos**: se añadieron unitarias de ICS del portal, `manageCitaByMedico`, vinculación (`requestPatientLink`), calendario (helpers puros extraídos a `services/calendarFormat.ts`), `aiQueue` y `requestAIStructuring`. Opcional futuro: tests de render de componentes si se incorpora testing-library |

---

## 8. Próximos pasos

1. ✓ **Frente visual cerrado (17–18 ago)**: rediseño Clinical Intelligence + auth Ambient Voice Interface, validado 4/4 contra prod y en `main`.
2. **Estrategia comercial**: plan de adquisición de clientes + agenda de 5 contactos reales documentados en `specs/001-doctoria-mvp/week5-commercial-plan.md`.
3. Preparar demo de la aplicación (landing + flujo clínico con cuentas seed).
4. Iterar el MVP con feedback de pilotos (Semana 7).
5. ~~Fix pendiente (CRITICAL): revalidar `updatedAt` en `requestAIStructuring`~~ ✅ **RESUELTO** (`daba56e`, CAS `expectedUpdatedAt`); queda re-verificar en el próximo QA manual.
6. ~~Decisiones UI abiertas (8-nov): alcance de badges y label~~ ✅ **RESUELTO**: badges extendidos a calendario/lista/portal con `CitaBadge` compartido + label unificado **"Completada"** (T061).

> **Nota de despliegue (15-ago)**: la integración de IA migró de Gemini (bloqueado 403) a **OpenRouter**. El deploy de Render requiere la variable `OPENROUTER_API_KEY` configurada en el dashboard (el free tier `gpt-oss-20b:free` funciona para demo; para producción usar clave paga/BYOK).

## 9. Lineamientos que NO deben perderse (Constitución)

- **P1 Spec-Driven**: código siempre trazable a `spec.md` (RF/RNF).
- **P4 Seguridad clínica**: IA asistiva, nunca confirmatoria; registro CONFIRMED inmutable (adendas).
- **P5 Protección de datos**: datos reales en producción con cifrado; sintéticos en dev/demo; sin PII en logs; secrets fuera de git.
- **P3 Reutilización**: sin frameworks nuevos; usar Wasp/Prisma/Radix existentes.
- **P7 Calidad**: toda tarea con tests verdes (Vitest 195/195, Playwright 10) y QA documentado.
- **P10 Gobierno**: decisiones documentadas en `plan.md`/`research.md` (PD-01..03); tareas en `tasks.md` por Doer.
- **Idioma**: UI y documentos del equipo en español; código/comentarios en inglés.
- **No commitear** sin que el usuario lo pida explícitamente; commits/push directos desde la copia Windows en `main` (ver §6).
