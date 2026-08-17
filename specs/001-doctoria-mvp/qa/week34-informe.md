# DOCTORIA
# Informe detallado de las Semanas 3 y 4

## Desarrollo del Core, QA y despliegue a producción

- **SEMANA 3 CERRADA** — Núcleo clínico en staging
- **SEMANA 4 CERRADA** — HTTPS, QA 5/5, producción y cierre documental

**Proyecto**: DoctorIA
**Elaborado para**: Equipo DoctorIA
**Fecha de corte**: 16 de agosto de 2026
**Carácter**: Informe consolidado de evidencia, decisiones, avances, limitaciones y pendientes
**Fuentes principales**: `spec.md`, `plan.md`, `tasks.md` (T001–T031), `CONTEXT.md`, `qa/week4-qa-report.md`, `checklists/production.md`, `research.md`, historial de Git (`git log` del 09 al 16 de agosto), sesiones de verificación por API contra producción.

---

## Control del documento

| Versión | Fecha | Estado | Observación |
|:--|:--|:--|:--|
| 1.0 | 16 de agosto de 2026 | Emitido | Consolidación fiel de las Semanas 3–4 hasta el cierre documental con E2E del flujo clínico completo. |

---

## Contenido

1. Resumen ejecutivo y estado actual
2. Requisitos de las Semanas 3 y 4 según el Manual Técnico
3. Principios de trabajo adoptados
4. Entorno inicial y restricciones técnicas
5. Desarrollo del Core (módulo clínico, landing, datos, voz)
6. Suite de tests unitarios (Vitest)
7. Suite E2E (Playwright)
8. Code review cruzado
9. Polish de la landing
10. Integración de IA (Gemini → OpenRouter)
11. Asistente de voz (Web Speech API)
12. Feedback de UI (toasts)
13. Despliegue a staging/producción (Render)
14. QA de Semana 4 (5/5 flujos)
15. Verificación E2E del flujo clínico completo por API
16. Hallazgos con severidad
17. Estado exacto del repositorio y artefactos
18. Desfase de calendario (documentado)
19. Cumplimiento de entregables de las Semanas 3–4
20. Deudas técnicas y pendientes
21. Próxima secuencia
22. Anexos técnicos

---

## 1. Resumen ejecutivo y estado actual

Las Semanas 3 y 4 convirtieron la especificación de DoctorIA (spec.md, 29 RF / 13 RNF) en un **MVP funcional y desplegado**. Se construyó el módulo clínico completo (nota estructurada, epicrisis, RBAC, adendas, auditoría), se adoptó el voice-first (dictado asistido con reconocimiento de voz real), se integró IA estructuradora vía OpenRouter tras bloqueo de Gemini, se dejó el producto accesible por **HTTPS con certificado SSL** en Render y se ejecutó el QA con **5/5 flujos superados** y checklist de producción al 100%.

Posteriormente, un cierre complementario (14–16 de agosto) agregó toasts de confirmación, reconociendo de voz **real** (Web Speech API), parseo robusto de pacientes por nombre y una **verificación E2E del flujo clínico completo por API contra producción** (6/6 pasos) que dejó documentados tres hallazgos con severidad (1 CRITICAL, 1 MAJOR, 1 MINOR).

**Estado de fase**: Semanas 3 y 4 **CERRADAS** en su gate documental. Quedan abiertas solo deudas técnicas (ver sección 20) y la firma formal del equipo, pendiente de revisión conforme a la dinámica de la Semana 4.

---

## 2. Requisitos de las Semanas 3 y 4 según el Manual Técnico

| Semana | Entregable | Requisito | Estado al corte |
|:--|:--|:--|:--|
| S3 | MVP funcional en staging | Core construido con agentes de IA y registro en `tasks.md` | ✅ Cumplido — módulo clínico + landing + suites verdes (T001–T020) |
| S3 | `tasks.md` | Registro de tareas por Doer y code review cruzado | ✅ Cumplido — T001–T031 con fases y conclusiones de review |
| S4 | HTTPS + SSL | Producto accesible por HTTPS con certificado válido | ✅ Cumplido — Render free tier (TLS automático) |
| S4 | Reporte de QA (Browser Subagent) | Pruebas E2E documentadas | ✅ Cumplido — `week4-qa-report.md` (5/5) |
| S4 | Checklist de producción 100% | Lista verificada de producción | ✅ Cumplido — `checklists/production.md` |

**Requisito transversal** (Principio 1 de la Constitución): no escribir código antes de investigación, especificación, aclaraciones, plan y diseño. El plan técnico (`plan.md`) y el diseño aprobado (`DESIGN.md` + aprobación `8f2b717`) antecedieron a la implementación clínica commit `3ee8df6`.

---

## 3. Principios de trabajo adoptados

1. Conservar Open SaaS/Wasp y evitar reemplazos injustificados.
2. IA como ejecutor, revisión humana de cada cambio (no se integró cambio sin verificación de suites).
3. IA **exclusivamente asistiva** en el flujo clínico (Constitución P4): nunca confirma, diagnostica ni prescribe.
4. Solo datos sintéticos; sin PII ni secretos en Git (Constitución P5).
5. Toda tarea con tests verdes y QA documentado (Constitución P7).
6. Commits pequeños, descriptivos y auditables.
7. Registro por Doer en `tasks.md` con code review cruzado.
8. No declarar cerrada una fase sin evidencia verificable (se evitó falsear fechas del calendario; ver sección 18).

---

## 4. Entorno inicial y restricciones técnicas

| Elemento | Estado verificado | Decisión / precaución |
|:--|:--|:--|
| Sistema | Windows 11 + WSL2 (Ubuntu nativo en `/home/minda/DoctorIA`) | Copia respaldo push en `C:\Users\minda\Desktop\doctoria\doctoria` |
| Git | 2.x | Repo remoto oficial confirmado: `github.com/JorgeMinda/DoctorIA` |
| Node.js | v24.19.0 (WSL) | Usado para `wasp build` y tests |
| Wasp CLI | 0.25.0 | Stack Open SaaS |
| Prisma / Postgres | Prisma sobre PostgreSQL 18 (Render `doctoria-db`) | Base separada; migraciones en `startCommand` |
| Playwright | Chromium | E2E desde Windows contra `localhost:3000/3001` vía WSL2 forwarding |
| Render | free tier, 3 servicios (`client`, `server`, `db`) | Deploy manual del client requerido (registrado como caveat) |
| IA | OpenRouter `openai/gpt-oss-20b:free` | Gemini bloqueado (403); `OPENROUTER_API_KEY` configurada en Render |
| Voz | Web Speech API (navegador) | Chrome/Edge operativos; Safari/Firefox con soporte parcial |

**Hallazgo de entorno**: la instalación nativa WSL produjo *bindings* rolldown Linux y WSL quedó caído durante parte del desarrollo; los tests unitarios se ejecutaron desde Windows (`node node_modules\vitest\dist\cli.js run`), documentado en `tasks.md` Notas.

---

## 5. Desarrollo del Core (módulo clínico, landing, datos, voz)

### 5.1 Kickoff de implementación (base)
- **`3ee8df6` (09-ago)** — `feat: implement DoctorIA MVP clinical module (001-doctoria-mvp)`: modelo de datos (Patient, ClinicalNote, PatientAccess, AuditLog), máquina de estados de nota (`DRAFT_MANUAL → DRAFT_AI_ASSISTED → REVIEWED → CONFIRMED`), adendas (`ADDENDUM`), RBAC (`ensureMedico`/`ensureAdmin`), contratos serializados al front.
- **`caeeeb5`, `33c092c`, `1c676bd` (09-ago)** — ajustes de seeds (credenciales demo) y documentación README.

### 5.2 Landing con voz ambiental
- **`f7e3867` (10-ago)** — branding DoctorIA: reemplazo del contenido de plantilla Open SaaS.
- **`69392e6` (10-ago)** — módulo de asistente de voz y rediseño ambiental de la landing (voice-first).

### 5.3 Datos sembrados
- 6 pacientes sintéticos **PAC-001..PAC-006** (sin PAC-DEMO), 12 accesos médico↔paciente, cuentas seed verificadas (`admin@doctoria.com`, `medico1/2@doctoria.com` / `Doctoria2026!`).

---

## 6. Suite de tests unitarios (Vitest)

**Propósito**: cobertura unitaria del core clínico (voz, IA, RBAC y validación) al 100% verde. **Resultado: 43/43** (T001–T009).

| Archivo | Tests | Cubre |
|:--|:--|:--|
| `voiceAssistant.test.ts` | 15 | Parseo de consulta, resolución paciente por nombre, fallbacks PAC-NNN |
| `aiService.test.ts` | 7 | Estructuración IA, `originalTextPreserved`, secciones reales |
| `guards.test.ts` | 11 | RBAC, roles excluyentes, `ensureMedico`/`ensureAdmin` |
| `noteValidation.test.ts` | 10 | Validación de secciones obligatorias, "No aplica", confirmación acumulativa |

**Bugfixes derivados de tests**: regex de voz (orden de alternancias), `ensureAdmin` que no rechazaba médicos con flag admin, alineación de mocks de IA.

---

## 7. Suite E2E (Playwright)

**Propósito**: reflejar el producto real (landing rediseñada + auth). **Resultado: 10/10** (T010–T014).

- 2 tests de *auth redirect* (guard → `/login`).
- 8 tests de landing/cookie (selectores reales del rediseño: título /DoctorIA/, links `Comenzar`\|`Iniciar Sesión`, hero, features, FAQ, testimonios, cookie consent).
- Corrección clave: `SKIP_EMAIL_VERIFICATION_IN_DEV=true` para e2e de auth en desarrollo.

---

## 8. Code review cruzado

| Tarea | Autor | Revisor | Estado |
|:--|:--|:--|:--|
| Bugfixes voz + RBAC + tests IA/voz | Doer A | Doer B | ✅ Aprobado |
| Suite unitaria (4 archivos) | Doer A | Doer C | ✅ Aprobado |
| Corrección e2e landing + instalación | Doer A | Doer D | ✅ Aprobado |
| Config de verificación de email en dev | Doer A | Doer E | ✅ Aprobado |

**Conclusión del review**: sin observaciones pendientes; suites verdes después del merge (T006–T008, T010–T014).

---

## 9. Polish de la landing

- **`c49bcde` (12-ago)** — layout compacto: hero ~80vh, grid 1.05fr/0.95fr, orbe reducido, escala de espaciado intencional, `FinalCTA.tsx`, grid de características reconstruido sin `row-span`.
- Verificación: `tsc` limpio, e2e 10/10, vitest 43/43 (T015–T020).

---

## 10. Integración de IA (Gemini → OpenRouter)

- **`6581ade` (14-ago)** — Gemini 1.5 Flash con Structured Outputs (PD-01). **Bloqueado (403)** por la cuenta.
- **`954e54f` (14-ago)** — intento de resolución del error de Gemini / Structured Outputs.
- **`ccfad3c` (15-ago)** — **migración a OpenRouter** (`https://openrouter.ai/api/v1/chat/completions`, modelo `openai/gpt-oss-20b:free`). `OPENROUTER_API_KEY` configurada en Render.
- Configuración de resiliencia: `AI_TIMEOUT_MS = 30_000` (RNF-011), `AI_MAX_RETRIES = 2` con re-intentos ante 429/5xx respetando `Retry-After`.
- **RNF-008** verificado en producción: si la IA falla, la nota permanece `DRAFT_MANUAL` con el texto intacto.

---

## 11. Asistente de voz (Web Speech API)

- **`a038455` (15-ago)** — reconocimiento de voz **real**: microfono → transcripción → query del asistente (parseo y resolución de paciente).
- Correcciones consecutivas (15-ago): no auto-ejecutar query demo fantasma en Modo real (`653b4e6`), distinguir Modo demo vs real con pacientes asignados reales (`bfcd2bb`), respuesta instantánea + control manual (`f7ace59`), eliminar duplicación del transcript intermedio (`5414a6f`), enviar al terminar la escucha (`a1de1d2`), y ampliar palabras clave/parseo sin tildes + soporte PAC-NNN (`68be06b`).
- Parser probado con Node: "Dame información de Andrés Núñez" → PAC-006; "PAC-003" → María Torres.

---

## 12. Feedback de UI (toasts)

- **`6300a14` (15-ago)** — toasts de confirmación vía `@radix-ui/react-toast` en las acciones clínicas: guardar nota, estructuración IA, confirmación, adenda y epicrisis; mensajes destructivos con variante error (TOAST_LIMIT=1).
- Sustituye `alert()` nativos en detalle de paciente.

---

## 13. Despliegue a staging/producción (Render)

- **`faaef56` (13-ago)** — blueprint `render.yaml`: `doctoria-server` (Node/Wasp), `doctoria-client` (Vite estático + `200.html`), `doctoria-db` (Postgres 18).
- **`cdcec92`, `65b71e6` (13-ago)** — `startCommand` con `prisma migrate deploy` + `WASP_DB_SEED_NAME=seedSyntheticClinicalData` (semillas idempotentes en cada deploy).
- **`4deb429` (13-ago)** — resend provisional (`onboarding@resend.dev`) como remitente staging.
- **`63eb4d4`, `b4a96ab`** — promoción del MVP a `main` (Render despliega desde `main`).
- **URLs**: client `https://doctoria-client.onrender.com`; API `https://doctoria-server.onrender.com`.
- Variables de entorno configuradas: `DATABASE_URL`, `JWT_SECRET`, `WASP_SERVER_URL`, `WASP_WEB_CLIENT_URL`, `RESEND_API_KEY`, `ADMIN_EMAILS`, `REACT_APP_API_URL`, `OPENROUTER_API_KEY`.

---

## 14. QA de Semana 4 (5/5 flujos)

- **`94b6fe0` (13-ago)** — fix CTA `Comenzar` → `ClinicalVoiceRoute` (`/clinical/voice`), auth guard a `/login` en vez de signup (hallazgo D-01, severidad Alta).
- **`2d2614f` (13-ago)** — cierre documental: `checklists/production.md` (100%) + `week4-qa-report.md`.
- Resultado: **5/5 flujos superados** contra staging: (1) Home→Comenzar→intake, (2) entry points, (3) login desde home, (4) sesión persistente, (5) credenciales inválidas controladas.
- Suites locales: Vitest 43/43, Playwright 10/10.

---

## 15. Verificación E2E del flujo clínico completo por API

**Fecha**: 16-ago · **Método**: flujo por API contra producción (`/operations/<kebab>` con auth Bearer + superjson `{"json": ...}`), paciente **PAC-004** (Pedro Salazar), nota `3a527988-f4d6-40e4-a0b0-4021f5a91d12`. (T030)

| Paso | Estado | Detalle |
|:--|:--|:--|
| Login API (`auth/email/login`) | ✅ PASS | 200 → `sessionId` (sin cookie) |
| `create-clinical-note` | ✅ PASS | `DRAFT_MANUAL`; `originalText` preservado (RNF-004) |
| `request-aistructuring` (reintento) | ✅ PASS | 200 en 25 s → `DRAFT_AI_ASSISTED`, 5 secciones; `valoracionClinica` `null` (no estaba en el texto) |
| Edición (`update-clinical-note-draft`) | ✅ PASS | `REVIEWED` al completar obligatorias |
| `confirm-clinical-note` (incompleto) | ✅ PASS (validación) | **422** "Secciones obligatorias incompletas: Valoración clínica" (RF-026/027) |
| `confirm-clinical-note` (completo) | ✅ PASS | 200 → `CONFIRMED` con `confirmedById`/`confirmedAt` |
| `get-audit-log` | ✅ PASS | `CREATE_NOTE → REQUEST_AI_STRUCTURING → REVIEW_NOTE → CONFIRM_NOTE` (+ `VOICE_ASSISTANT_QUERY`, `VIEW_PATIENT` de sesión previa) |

**Comportamiento correcto verificado**: RNF-008 (falla IA deja DRAFT_MANUAL, texto intacto), RNF-004 (originalText inmutable), validación de confirmación descriptiva y auditoría completa.

---

## 16. Hallazgos con severidad

| # | Hallazgo | Severidad | Detalle |
|:--|:--|:--|:--|
| H-01 | **Race que sobrescribe ediciones del médico** (`actions.ts:197-210`) | 🔴 CRITICAL | Una llamada IA en vuelo (colgada >120 s client-side, activa server-side) escribió ~5 s después de una edición manual y **reemplazó `valoracionClinica`/`examenFisico`** por texto IA; la confirmación posterior quedó sobre contenido no revisado. `requestAIStructuring` valida el estado solo al inicio (L185) y escribe sin re-validar. |
| H-02 | **Latencia IA ~120–130 s** (`aiService.ts:41,54,122,130-138`) | 🟠 MAJOR | 3 intentos × timeout 30 s + backoff del modelo free (observado 25 s en caliente vs >120 s en cold/rate-limit). El "fallback de 30 s" es por intento, no fin-a-fin; el usuario ve un spinner indefinido. |
| H-03 | **IA no determinista** | 🟡 MINOR | Dos corridas devolvieron divisiones distintas (TA/FC/EVA se movieron a `examenFisico`, `motivoConsulta` cambió). Aceptable como asistiva, pero amplifica H-01. |
| H-04 (citado) | CTA `Comenzar` → signup en vez de intake | Alta (corregido) | D-01 de `week4-qa-report.md`, resuelto en `94b6fe0`. |

---

## 17. Estado exacto del repositorio y artefactos

| Dato | Estado confirmado |
|:--|:--|
| Remoto | `github.com/JorgeMinda/DoctorIA` (usuario `JorgeMinda`) |
| Rama de trabajo | `001-doctoria-mvp` — promovida a `main` (deploy de Render) |
| HEAD local y remoto | `b87b387` (docs cierre S3–S4) = `main` (fast-forward) |
| Marcadores | Sin `[NEEDS CLARIFICATION]` en `spec.md` |
| Aplicación | Cambios desplegados en `main` (client + server) |
| Artículos de diseño | `DESIGN.md` en raíz; aprobación `8f2b717` (PD-03) |
| Documentos | `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/clinical-operations.md` |
| Tareas | `tasks.md` T001–T031 |

```
specs/001-doctoria-mvp/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/clinical-operations.md
├── checklists/{requirements.md, production.md}
├── qa/week4-qa-report.md
├── qa/week34-informe.md     ← este documento
├── tasks.md (T001–T031)
└── week5-commercial-plan.md
```

---

## 18. Desfase de calendario (documentado)

| Semana | Fechas del programa | Ejecución real | Desfase |
|:--|:--|:--|:--|
| S2 (especificación) | 20–26 jul | 02–08 ago | Desfase documentado en `CONTEXT.md` (spec/plan fechados 08-ago) |
| S3 (core) | 27 jul–02 ago | 09–12 ago | +1 semana |
| S4 (QA y producción) | 03–09 ago | 13–16 ago | +1 semana |

El desfase se declaró de forma transparente (Principio 8) y no genera deuda falsa de "cierre": los gates se consideran cerrados con evidencia verificable, no por fecha calendario.

---

## 19. Cumplimiento de entregables de las Semanas 3–4

| Componente | Semana | Estado | Observación |
|:--|:--|:--|:--|
| MVP funcional en staging | S3 | ✅ Cumplido | Módulo clínico + landing (commits 09–12-ago) |
| `tasks.md` con tareas por Doer | S3 | ✅ Cumplido | T001–T031 con fases y review cruzado |
| Code review cruzado | S3 | ✅ Cumplido | 4 revisiones firmadas, 0 pendientes |
| Suites unitaria/E2E | S3 | ✅ Cumplido | Vitest 43/43, Playwright 10/10 |
| HTTPS + SSL | S4 | ✅ Cumplido | Render free tier (TLS automático) |
| QA Browser Subagent + reporte | S4 | ✅ Cumplido | `week4-qa-report.md`, 5/5 |
| Checklist de producción | S4 | ✅ Cumplido | `production.md`, 100% (pendientes documentados) |
| Cierre documental S3–S4 | S4 | ✅ Cumplido | este informe + `tasks.md` Fase 6 |
| Firma del equipo | S4 | ⏳ Pendiente | Dinámica de revisión en equipo |

---

## 20. Deudas técnicas y pendientes

| # | Deuda | Severidad | Fix sugerido |
|:--|:--|:--|:--|
| 1 | Race en `requestAIStructuring` | 🔴 CRITICAL | Revalidar estado/`updatedAt` justo antes de escribir → 409/412 si cambió (optimistic locking) |
| 2 | Latencia IA ~120–130 s | 🟠 MAJOR | Reducir `AI_MAX_RETRIES` a 1 o mover IA a job/cola con progreso |
| 3 | Email verificado en Resend | 🟠 MAJOR | Dominio verificado para pilotos |
| 4 | DB free expira en 30 días | 🟠 MAJOR | Plan pagado o backups |
| 5 | Entrevistas Semana 1 (5/8) | 🟡 DEUDA | Completar con pilotos |
| 6 | Deploy manual del client | 🟡 MINOR | Verificar trigger en Render antes del siguiente deploy |
| 7 | IA no determinista | 🟡 MINOR | `temperature` baja / bloquear campo editado |

**Gaps de verificación**: toasts en UI, micrófono real y flujo "No aplica" verificados por API/estructura, no con navegador (sin capturas).

---

## 21. Próxima secuencia

1. (En curso) Semana 5 — plan de adquisición de clientes + agenda de 5 contactos (`week5-commercial-plan.md`).
2. Preparar demo (landing + flujo clínico con cuentas seed).
3. Fix CRITICAL del race en `requestAIStructuring` (deuda técnica priorizada).
4. Iterar con feedback de pilotos (Semana 7).

---

## 22. Anexos técnicos

### Anexo A. Registro cronológico de commits (S3–S4, 09–16 ago)

| Fecha | Commit | Actividad |
|:--|:--|:--|
| 09-ago | `3ee8df6` | Implementación del módulo clínico MVP |
| 09-ago | `caeeeb5`/`33c092c`/`1c676bd` | Seeds demo + README |
| 10-ago | `f7e3867`/`69392e6` | Landing DoctorIA + módulo de voz |
| 12-ago | `b34688f`/`c49bcde`/`22f8ac0` | Suite unitaria, bugfixes, polish landing (T001–T020) |
| 13-ago | `faaef56`/`63eb4d4`/`4deb429`/`cdcec92`/`65b71e6`/`94b6fe0`/`2d2614f` | Deploy Render + QA 5/5 + checklist (T021–T029) |
| 13-ago | `ecbdbcd`/`cd7a1fe` | AGENTS.md + CONTEXT.md |
| 14-ago | `6581ade`/`954e54f` | IA Gemini (403) |
| 15-ago | `ccfad3c`/`919260d` | Migración OpenRouter + PD-03 Stitch |
| 15-ago | `6300a14` | Toasts (radix) |
| 15-ago | `bfcd2bb`→`68be06b` | Voz real + 6 fix (Web Speech, parseo, dedup) |
| 16-ago | `b87b387` | E2E flujo clínico + deuda CRITICAL (T030/T031) |

### Anexo B. Comandos clave

```bash
npm ci                                    # dependencias (app y e2e-tests)
node node_modules\vitest\dist\cli.js run  # vitest (Windows, workdir app/)
npx playwright test --config=playwright.local.config.ts  # e2e (workdir e2e-tests/)
wasp build                                # build server (WSL)
# Deploy: push a main → Render deploya (client manual en esta iteración)
```

### Anexo C. Verificación por API (flujo clínico)

```bash
curl -X POST https://doctoria-server.onrender.com/auth/email/login -d '{"json":{...}}'
curl -X POST .../operations/create-clinical-note -H "Authorization: Bearer <sessionId>" ...
curl -X POST .../operations/request-aistructuring    # 3 intentos × 30 s
curl -X POST .../operations/confirm-clinical-note   # 422 si faltan obligatorias
curl -X POST .../operations/get-audit-log
```

### Anexo D. Riesgos técnicos y de proceso

| Riesgo | Estado | Mitigación |
|:--|:--|:--|
| Race IA/edición (H-01) | Activo | Fix de locking pendiente (deuda #1) |
| Latencia IA free | Activo | Reducir reintentos o cola de IA |
| DB free 30 días | Activo | Plan pagado para pilotos |
| Cold start free tier (~30–50 s) | Controlado | RNF-013 documentado |
| Sleep/desfase de calendario | Controlado | Transparencia en `CONTEXT.md` |
| Seguridad clínica | Controlado | IA asistiva, CONFIRMED inmutable, adendas |
| Datos | Controlado | Solo sintéticos (P5) |

### Fuentes de evidencia

- `spec.md` (29 RF / 13 RNF), `plan.md`, `research.md`, `contracts/clinical-operations.md`
- `tasks.md` (T001–T031), `CONTEXT.md`, `qa/week4-qa-report.md`, `checklists/production.md`
- `git log` del 09 al 16 de agosto de 2026 (rama `001-doctoria-mvp` ≡ `main`)
- Verificaciones por API contra `doctoria-server.onrender.com` (16-ago)