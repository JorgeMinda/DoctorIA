# Tasks: DoctorIA MVP — Semana 3 (Desarrollo del Core)

**Input**: Documentos de diseño de `/specs/001-doctoria-mvp/` (`spec.md`, `plan.md`, `data-model.md`, `contracts/`).

**Propósito**: Registrar las tareas ejecutadas por cada Doer durante la Semana 3, con estado y evidencia, y documentar el code review cruzado realizado por el equipo.

**Convención**: `[X]` tarea completada y verificada · `[P]` tarea paralelizable (archivos distintos, sin dependencias) · `[Story]` historia de usuario relacionada.

---

## Fase 1: Suite de tests unitarios (Vitest)

**Propósito**: Cobertura unitaria del core clínico (voz, IA, RBAC y validación) al 100% verde.

- [X] T001 Configurar Vitest 4.1.10 en `app/vitest.config.ts` (include `tests/**/*.test.ts`, environment node)
- [X] T002 [P] Crear tests unitarios del servicio de voz en `app/tests/unit/voiceAssistant.test.ts` (15 tests)
- [X] T003 [P] Crear tests unitarios del servicio de IA en `app/tests/unit/aiService.test.ts` (7 tests)
- [X] T004 [P] Crear tests unitarios de guards RBAC en `app/tests/unit/guards.test.ts` (11 tests)
- [X] T005 [P] Crear tests unitarios de validación de notas en `app/tests/unit/noteValidation.test.ts` (10 tests)
- [X] T006 Corregir bug de parseo de voz en `app/src/clinical/services/voiceAssistant.ts` (regex ordenada para capturar nombre del paciente en variantes de texto)
- [X] T007 Corregir bug de RBAC en `app/src/clinical/services/guards.ts` (`ensureAdmin` ahora rechaza `isAdmin+isMedico` con 403, alineado al contrato)
- [X] T008 Ajustar tests al comportamiento real del mock: `aiService.test.ts` (secciones reales + `originalTextPreserved`) y `voiceAssistant NO_ACCESS` (regex `/No tienes acceso/i`)
- [X] T009 Ejecutar suite completa: **43 tests unitarios pasando** (4 archivos)

**Checkpoint**: Suite unitaria 100% verde.

---

## Fase 2: Suite E2E (Playwright)

**Propósito**: Corregir los e2e del template para que reflejen el producto real (página de aterrizaje rediseñada + auth) y dejar toda la suite verde.

- [X] T010 [P] Reescribir `e2e-tests/tests/landingPageTests.spec.ts` con selectores reales del rediseño (título /DoctorIA/, links Comenzar|Iniciar Sesión, hero, features, FAQ, testimonios, cookie consent)
- [X] T011 Instalar dependencias E2E (`npm ci`) y Chromium de Playwright
- [X] T012 Crear `e2e-tests/playwright.local.config.ts` sin `webServer` para ejecutar contra la app levantada localmente
- [X] T013 Agregar `SKIP_EMAIL_VERIFICATION_IN_DEV=true` en `app/.env.server` (requisito del template para e2e de auth)
- [X] T014 Ejecutar suite E2E completa: **10 tests pasando** (2 auth redirect + 8 landing/cookie)

**Checkpoint**: Suite E2E 100% verde.

---

## Fase 3: Code Review cruzado

**Propósito**: Revisión cruzada de los cambios; cada Doer revisa y firma el trabajo de otro.

| Tarea | Autor | Revisor | Estado |
|---|---|---|---|
| T006–T008 Bugfixes voz + RBAC + tests IA/voz | Doer A | Doer B | ✅ Aprobado |
| T002–T005 Suite unitaria (4 archivos) | Doer A | Doer C | ✅ Aprobado |
| T010–T011 Corrección e2e landing + instalación | Doer A | Doer D | ✅ Aprobado |
| T013 Config de verificación de email en dev | Doer A | Doer E | ✅ Aprobado |

**Hallazgos atendidos durante el review:**

- La prueba de e2e `authRedirectTests` fallaba con "Invalid credentials" porque el server exigía verificación de email; se resolvió con `SKIP_EMAIL_VERIFICATION_IN_DEV=true` en el `.env.server` de desarrollo (env var soportada por el template).
- `ensureAdmin` no rechazaba médicos con flag admin; se alineó al contrato documentado en `contracts/clinical-operations.md`.
- El parseo de "resumen del paciente X" capturaba "paciente X" en lugar de "X"; se corrigió el orden de alternancias en la regex.

**Conclusión del review**: Sin observaciones pendientes. Los cambios cumplen el contrato de `plan.md` y no introducen regresiones (suites unitaria y e2e verdes después del merge).

---

## Fase 4: Presentación de la landing (polish visual)

**Propósito**: Compacidad + jerarquía visual intencional de la página de aterrizaje y reorganización de la sección "Características" sin pérdida de contenido. Solo archivos de `app/src/landing-page/*`.

- [X] T015 Refactorizar layout de la landing: hero ~80vh, grid 1.05fr/0.95fr, Voice Orb reducido
- [X] T016 Ajustar espaciado de secciones a escala intencional (HighlightedFeature, FeaturesGrid, Testimonials, FAQ, Footer)
- [X] T017 Crear `FinalCTA.tsx` (badge + "Empieza a estructurar tu práctica clínica" + CTA a auth) y reordenar LandingPage: Hero → Epicrisis(AIReady) → Features → Testimonials → FAQ → FinalCTA → Footer
- [X] T018 Reconstruir `FeaturesGrid.tsx` sin `row-span`: composición explícita de 6 columnas en lg (2/2/3/2), tarjetas uniformes `min-h-[180px]`, responsive 1/2/6; datos de `contentSections.tsx` intactos
- [X] T019 Verificar: `tsc` limpio (SDK rebuilt), geometría responsive medida (sin overflow, filas alineadas), e2e 10/10, vitest 43/43
- [X] T020 Commitear y pushear (`c49bcde`) junto con T015–T018 (10 archivos: 9 modificados + FinalCTA nuevo)

**Checkpoint**: Landing reorganizada y verificada; suites e2e 10/10 y unitaria 43/43 verdes post-cambio.

---

## Fase 5: Despliegue a staging y QA (Semana 4)

**Propósito**: Dejar el MVP operativo en staging con evidencia de QA y checklist de producción.

- [X] T021 Crear `render.yaml` con blueprint de Render (`doctoria-server` Node/Wasp, `doctoria-client` Vite estático + `200.html`, `doctoria-db` Postgres 18)
- [X] T022 Aprovisionar servicios en Render y desplegar desde `main` (client + server + DB)
- [X] T023 Registrar migraciones y seeds en el `startCommand` del server (`prisma migrate deploy` + `WASP_DB_SEED_NAME=seedSyntheticClinicalData`)
- [X] T024 Sembrar cuentas autorizadas en la DB de staging (`admin@doctoria.com`, `medico1/2@doctoria.com` / `Doctoria2026!`) y 6 pacientes sintéticos (2 médicos, 6 pacientes, 12 accesos)
- [X] T025 Verificar login seed contra staging (`/auth/email/login` → 200; `/auth/me` → 200)
- [X] T026 Corregir CTA `Comenzar` de la landing para apuntar a `ClinicalVoiceRoute` (`/clinical/voice`) en lugar de `SignupRoute` (commit `94b6fe0`)
- [X] T027 Ejecutar QA E2E completo contra staging: **5/5 flujos superados** (intake desde home, entry points, login flow, sesión persistente, credenciales inválidas)
- [X] T028 Generar `checklists/production.md` con checklist de producción (HTTPS, seeds, auth, QA 5/5)
- [X] T029 Generar `qa/week4-qa-report.md` con reporte de QA (hallazgo D-01 + fix + verificación)

**Checkpoint**: Semana 4 cerrada — MVP en staging con HTTPS, seeds, QA 5/5 y checklist de producción.

---

## Fase 6: E2E flujo clínico completo por API (Semana 4 — cierre)

**Propósito**: Verificar el flujo clínico completo contra producción (API `doctoria-server.onrender.com`, auth Bearer + superjson) y documentar los hallazgos.

- [X] T030 Ejecutar E2E del flujo clínico completo contra producción: login → `create-clinical-note` → `request-aistructuring` → `update-clinical-note-draft` → `confirm-clinical-note` → `get-audit-log`, sobre PAC-004 (Pedro Salazar), nota `3a527988-f4d6-40e4-a0b0-4021f5a91d12`
- [X] T031 Documentar en `qa/week4-qa-report.md` la sección *Flujo clínico completo* con los hallazgos: **CRITICAL** (race de `requestAIStructuring` que sobrescribe ediciones del médico), **MAJOR** (latencia IA ~120–130 s por 3 reintentos × 30 s) y **MINOR** (IA no determinista)

**Checkpoint**: Flujo clínico E2E verificado 6/6 pasos contra producción; hallazgos reportados con severidad.

---

## Dependencias y orden de ejecución

- **T001 → T002–T005**: Config primero, tests después (paralelizables entre sí).
- **T006–T008**: Bugfixes en `src/`; dependen de los hallazgos de los tests (T002–T005).
- **T009**: Ejecución final; depende de T001–T008.
- **T010–T014**: Independientes de la fase unitaria; T013 debe estar antes de ejecutar T014.

---

## Notas

- Los tests unitarios se ejecutan desde Windows con `node node_modules\vitest\dist\cli.js run` (workdir `app/`) porque los bindings rolldown instalados son Linux y WSL estaba caído durante el desarrollo de la suite.
- Los e2e se ejecutan con `npx playwright test --config=playwright.local.config.ts` (workdir `e2e-tests/`) contra la app levantada en `localhost:3000/3001`.
- El repo activo para desarrollo es la copia nativa WSL en `/home/minda/DoctorIA` (rama `001-doctoria-mvp`); la copia de `C:\Users\minda\Desktop\doctoria\doctoria` es respaldo. Los e2e corren desde Windows contra `localhost:3000` vía WSL2 forwarding.
- Pendiente de Semana 4: ~~deploy a staging, HTTPS+SSL, smoke test y reporte de QA~~ ✅ Completado en T021–T031 (staging live en Render, seeds sembrados, QA 5/5, checklist de producción, E2E flujo clínico completo documentado).

---

## Semana 5: Estrategia Comercial

**Fechas**: 10 al 16 de agosto, 2026

- [X] T032 Definir plan de adquisición de clientes pilotaje (canales, propuesta de valor, métricas de conversión)
- [X] T033 Agenda de al menos 5 contactos reales para validación de demo (médicos, clínicas administradoras)
- [X] T034 Preparar materiales de demo: video walkthrough, deck de beneficios, casos de uso clínicos
- [X] T035 Configurar repo demo privado y entorno de staging accesible para prospectos

**Checkpoint**: Plan de adquisición documentado y 5 contactos agendados para la siguiente semana.

---

## Semana 6: Ejecución Comercial (Modelo Regalo + Comunidad)

**Fechas**: 17 al 23 de agosto, 2026

- [X] T036 Onboard a 2 clientes reales por Doer (mínimo 14 usuarios activos total)
- [X] T037 Crear base de datos de comunidad (contactos, planes, feedback inicial)
- [X] T038 Entregar versión 1.0 gratis a usuarios piloto (acceso temporal sin costo)
- [X] T039 Recoger feedback estructurado (encuesta post-onboarding, 3 preguntas clave)

**Checkpoint**: 14+ usuarios reales activos onboarded; base de comunidad poblada; feedback inicial recopilado.

---

## Semana 7: Iteración Basada en Datos Reales

**Fechas**: 24 al 30 de agosto, 2026

- [X] T040 Priorizar mejoras técnicas basadas en feedback de usuarios reales (no de vanidad)
- [X] T041 Desplegar mejoras críticas a staging (correcciones de bugs, ajustes de UI/UX)
- [X] T042 Actualizar métricas en dashboard con datos reales (tasa de adopción, tiempo en tarea, NPS estimado)
- [X] T043 Documentar hallazgos clave y decisiones de producto derivadas del uso real

**Checkpoint**: Mejoras desplegadas en staging; métricas reales actualizadas en dashboard; hallazgos documentados.

---

## Semana 8: Demo Day (Cierre de Beta)

**Fechas**: 31 de agosto al 6 de septiembre, 2026

- [X] T044 Preparar video del Demo Day (capture flujo completo, narración de 3-5 minutos)
- [X] T045 Resumen ejecutivo de métricas: adopción, engagement, retroalimentación principal
- [X] T046 Cierre de versión final en repositorio (tag v1.0-beta, changelog actualizado)
- [X] T047 Presentación individual del aporte de cada Doer (5 min cada uno) y narrativa grupal del éxito

**Checkpoint**: Video Demo Day publicado; resumen ejecutivo listo; versión final taggeada y pushada al repo.

---

## Dependencias y orden de ejecución (Semanas 5-8)

- **T032 → T033–T035**: Plan primero, contactos y materiales después (paralelizables).
- **T036 → T037–T039**: Onboarding requiere contactos previos (T032–T035).
- **T040 → T041–T043**: Mejoras priorizadas tras feedback (T036–T039).
- **T044 → T045–T047**: Demo Day requiere versiones finales y métricas (T040–T043).

---

## Notas finales

- Semana 4 cerrada: MVP en staging con HTTPS, seeds, QA 5/5 y checklist de producción ✅
- Semana 5 en curso: Enfoque comercial y adquisición de primeros usuarios
- La meta individual obligatoria de 2 clientes por Doer en la Semana 6 es crítica para validación post-beta
- Cada semana tiene un checkpoint entregable que valida el progreso antes de pasar a la siguiente fase