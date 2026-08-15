# CONTEXT: DoctorIA MVP — Estado actual del proyecto (para IA colaboradora)

**Última actualización**: 2026-08-15 · **Rama de trabajo**: `001-doctoria-mvp` → se promueve a `main` (deploy de Render)
**Autor de este contexto**: agente principal del equipo DoctorIA

> **Reglas de comportamiento para agentes** (dominio, arquitectura, off-limits, comandos): ver [AGENTS.md](AGENTS.md) en la raíz. Este `CONTEXT.md` documenta el **estado mutable** del proyecto (cambia cada sesión); `AGENTS.md` documenta lo **casi-estático**.

Este documento resume el estado completo del proyecto para que una IA colaboradora entre en contexto rápido sin perder los lineamientos (Constitución P1–P10, especificación, plan técnico, y el avance real del sprint).

---

## 1. Qué es DoctorIA

MVP de un **SaaS de asistencia de IA para historias clínicas** en español. El médico dicta/escribe texto libre y DoctorIA lo estructura en secciones predefinidas de la nota clínica (y epicrisis). La IA es **exclusivamente asistiva**: nunca confirma, diagnostica ni prescribe (Constitución P4). Los datos son **100% sintéticos** (Constitución P5).

### Estructura de 8 semanas (curso de emprendimiento, 7 Doers)

| Semana | Fechas | Estado |
|:--|:--|:--|
| 1. Investigación (campo/mercado) | 13–19 jul | ⚠️ Parcial — 5/8 entrevistas; cuadro competitivo e investigación técnica documentadas |
| 2. Especificación | 20–26 jul | ✅ spec.md + plan.md + research.md (fechados 08-ago, desfase documentado) |
| 3. Desarrollo del Core | 27 jul–2 ago | ✅ CERRADA — MVP funcional en staging + tasks.md T001–T020 |
| 4. QA y Producción | 3–9 ago | ✅ CERRADA — HTTPS, QA 5/5, production-checklist |
| 5. Estrategia comercial | 10–16 ago | ⏳ **VIGENTE** — plan de adquisición + agenda de 5 contactos creados (ver `specs/001-doctoria-mvp/week5-commercial-plan.md`) |
| 6. Ejecución comercial | 17–23 ago | ⏳ Futuro |
| 7. Iteración con datos | 24–30 ago | ⏳ Futuro |
| 8. Demo Day | 31 ago–6 sep | ⏳ Futuro |

---

## 2. Stack y arquitectura

- **Framework**: Wasp 0.25.0 (template Open SaaS) — app monolítica, TypeScript 6.0.3, Node ≥24.14.1 (local WSL: Node v24.19.0 vía nvm)
- **Frontend**: React 19.2.x, TailwindCSS 4.x, Radix UI, lucide-react
- **Backend**: Express (Wasp), Prisma 5.19.1 + PostgreSQL
- **Pruebas**: Vitest 4.1.x (unit/integration, 43 tests), Playwright 1.55.1 (E2E)
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
│   ├── user/                 # Operaciones de usuarios (admin)
│   ├── client/               # App root, componentes UI, layout
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
- Suites locales: Vitest 43/43 verde, Playwright E2E 10/10 verde.

---

## 6. Repositorio y flujo de trabajo

- **Remote**: `https://github.com/JorgeMinda/DoctorIA` (user `JorgeMinda`)
- **Rama de trabajo**: `001-doctoria-mvp` — se promueve a `main` vía merge/push directo (Render deploya `main`)
- **Dos copias locales**:
  - **Activa para desarrollo**: WSL nativo `/home/minda/DoctorIA` (compila/builds, `wasp build`, tests unitarios)
  - **Respaldo + push**: Windows `C:\Users\minda\Desktop\doctoria\doctoria` (tiene Git Credential Manager; desde ahí se hacen los `git push origin 001-doctoria-mvp:main`)
- **Regla práctica para push**: los commits se preparan en WSL, se replican a la copia Windows (por archivo o `git`), y se pushean desde Windows con `git push origin 001-doctoria-mvp:main`.
- WSL git NO tiene credenciales GitHub (el push desde WSL queda colgado esperando password).

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
├── qa/week4-qa-report.md  # Reporte QA (D-01 + verificación 5/5)
└── tasks.md               # Registro de tareas T001–T029 (Semana 3–4)
```

---

## 7. Decisiones pendientes y deudas técnicas

| Proveedor de IA (PD-01) | ✅ **RESUELTO** — Integrado vía **OpenRouter** (`https://openrouter.ai/api/v1/chat/completions`, modelo `openai/gpt-oss-20b:free` en dev/demo). Gemini quedó bloqueado (403) en la cuenta; se migró a OpenRouter. Para producción usar clave paga/BYOK y modelo superior. |
| Email verificado en Resend | PENDIENTE — `onboarding@resend.dev` no permite verificar cuentas arbitrarias; para pilotos se necesita dominio verificado |
| Entrevistas de Semana 1 | Deuda — 5/8; continúa validación con pilotos |
| Google Stitch (PD-03) | PENDIENTE — diseño de 2-3 pantallas no realizado (se implementó UI directa) |
| Deploy manual del client | Documentado como caveat del free tier |
| DB free expira 30 días | Requiere plan pagado para pilotos largos |

---

## 8. Próximos pasos (Semana 5 — vigente)

1. **Estrategia comercial**: plan de adquisición de clientes + agenda de 5 contactos reales documentados en `specs/001-doctoria-mvp/week5-commercial-plan.md`.
2. Preparar demo de la aplicación (landing + flujo clínico con cuentas seed).
3. Iterar el MVP con feedback de pilotos (Semana 7).

> **Nota de despliegue (15-ago)**: la integración de IA migró de Gemini (bloqueado 403) a **OpenRouter**. El deploy de Render requiere la variable `OPENROUTER_API_KEY` configurada en el dashboard (el free tier `gpt-oss-20b:free` funciona para demo; para producción usar clave paga/BYOK).

## 9. Lineamientos que NO deben perderse (Constitución)

- **P1 Spec-Driven**: código siempre trazable a `spec.md` (RF/RNF).
- **P4 Seguridad clínica**: IA asistiva, nunca confirmatoria; registro CONFIRMED inmutable (adendas).
- **P5 Privacidad**: SOLO datos sintéticos; sin PII en logs; secrets fuera de git.
- **P3 Reutilización**: sin frameworks nuevos; usar Wasp/Prisma/Radix existentes.
- **P7 Calidad**: toda tarea con tests verdes (Vitest 43, Playwright 10) y QA documentado.
- **P10 Gobierno**: decisiones documentadas en `plan.md`/`research.md` (PD-01..03); tareas en `tasks.md` por Doer.
- **Idioma**: UI y documentos del equipo en español; código/comentarios en inglés.
- **No commitear** sin que el usuario lo pida explícitamente; respetar flujo WSL→Windows→push.
