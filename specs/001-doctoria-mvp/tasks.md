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

## Sesión nov-2026 (5–8 nov): Asistente de voz flotante + asistencia híbrida

**Contexto**: trabajo directo en `main` desde la copia Windows (sin `wasp` local; builds y migraciones validados en Render).

- [X] T048 Fix agenda: `NewAppointmentModal` faltante en la rama de vista del médico (`f43264d`)
- [X] T049 Docs: Constitución P5 → "Protección de Datos Clínicos" v2.0.0 — datos reales cifrados en prod, sintéticos en dev/demo (`6a4d2c9`)
- [X] T050 Eliminar botón "Dictar" por sección en la nota clínica — la voz vive solo en el widget flotante (`2910f08`)
- [X] T051 Crear asistente de voz flotante: Web Speech API + router de intención + TTS de respaldo (`4e02a7d`)
- [X] T052 Adaptar el flotante al comportamiento de referencia: frase única, navegación filtrada, dictado, TTS (`60458e7`)
- [X] T053 Restyle del botón flotante con estética VoiceOrb: glow ambiental, anillo cónico, núcleo oscuro (`33139d9`)
- [X] T054 Búsqueda de pacientes insensible a tildes — fold de acentos server-side (`fc277ce`)
- [X] T055 Fix voz: aceptar "busca"/"buscar", `stopListening()` explícito tras cada resultado y guard de estado obsoleto en `toggleListening` — micrófono no se congela (`33de436`)
- [X] T056 Fix voz: "agenda cita" abre el modal; limpiar `?new=1` al abrir para reabrir en cada comando; overlay flotante `z-[100]` con `pointer-events-none` + `stopPropagation` sobre modales Radix (`6cc34e2`)
- [X] T057 Asistente híbrido: el flotante ejecuta RF-030 (`getVoiceAssistantResponse` → panel expandido `w-80` con aviso P4) y RF-031 (`createNoteFromVoice` → panel + TTS + enlace) solo para médico; gates `wantsCreateNote`/`wantsPatientSummary` en `floatingVoice.ts` con tests unitarios (`eb3faf5`)
- [X] T058 Ocultar "Asistente de voz" del sidebar/topbar/detalle de paciente — la ruta queda por CTA de landing, comando de voz y URL directa con título de sección (`8b6245a`)
- [X] T059 QA de la sesión: Vitest **195/195** (13 archivos) + `tsc --noEmit` limpio, sin regresiones
- [X] T060 Actualizar `CONTEXT.md` y `tasks.md` con el estado de la sesión (P10 Gobierno) — esta actualización
- [X] T061 Extender los badges unificados a toda la UI de citas: componente compartido `CitaBadge.tsx` + `STATUS_CONFIG` fuente única en panel médico, lista de agenda (4 vistas), calendario (día + detalle, con iniciales) y portal del paciente (labels desde `STATUS_CONFIG`, casos "Por confirmar/Confirmada" de secretaría conservados); label COMPLETED unificado a **"Completada"** (decisión del usuario, 8-nov)
- [X] T062 Completar `CitaBadge` en las 2 últimas vistas con texto plano: detalle de paciente (vista médico y secretaría, con iniciales del paciente) y panel de admin (reemplaza `AdminCitaBadge`/`citaBadgeVariant` locales por el componente compartido)
- [X] T063 Suite de tests +52 → **247/247** (19 archivos): ICS del portal (8), `manageCitaByMedico` (14), vinculación `requestPatientLink` (7), calendario (11; helpers puros extraídos a `services/calendarFormat.ts`), `aiQueue` (5) y `requestAIStructuring` (7); `vitest.config.ts` con clave Resend dummy para poder importar `wasp/server` real en tests de acciones
- [X] T064 `aiDraft` en el conflicto CAS (human-in-the-loop): `requestAIStructuring` devuelve `{status:"CONFLICT", aiDraft}` en P2025 (audita `status:CONFLICT`, ya no lanza 409 tras pagar la IA) y el cliente ofrece "Aplicar borrador IA" vs "Conservar mis cambios" con `useConfirm`
- [X] T065 Cola IA single-slot con progreso: `services/aiQueue.ts` (FIFO en memoria, sin tablas nuevas) envuelve la llamada IA; `getClinicalNote` expone `aiProgress` (QUEUED/RUNNING + posición + startedAt) y la página refresca la nota cada 1.5 s mostrando cola, posición, segundos transcurridos y barra de progreso
- [X] T066 Captura guiada conversacional (FSM Formulario 002 MSP → secciones SOAP): máquina de estados pura `client/voice/captureFsm.ts` (IDLE→ASK→LISTEN→CONFIRM→COMMIT/DONE/CANCELLED) con guion de 6 campos (motivo, antecedentes, enfermedad actual, examen físico, diagnóstico, plan), eco TTS + confirmación sí/no, reemplazo de valor en CONFIRM, comandos «omitir/cancelar/terminar», anti-falsos-positivos («sí»/«no» solo confirman en CONFIRM) y anexo a secciones con prefijos (`applyCaptureAnswer`, RNF-004). Parser local sin IA (`normalizeCaptureTranscript`, `normalizeNumberWords` reservado para vitales fase 2). Host en `ClinicalNotePage`: botón "Captura guiada (Form. 002)", barge-in con mic pausado durante TTS y reanudado vía `TTS_DONE`, commits vía `persistDraft`, panel campo N/6 con Omitir/Cancelar; dictado, IA y confirmación deshabilitados durante la captura. Decisiones: vitales §5 → fase 2 (sin rehacer), fallback IA por turno → fase 2, entrada por botón (explícita). Tests **271/271** (T066 +24)
- [X] T067 Rebrand institucional **** 2026 (Manual de Marca **** — derechos de marca pendientes, decisión del usuario): rampa `--color-wine-300..900` + `--primary` vino (light `#8e183e` exacto / dark tinte claro `#e04879` para contraste) + neutros gris corporativo en `Main.css`; **Montserrat** reemplaza a Hanken Grotesk (`head.wasp.ts` + `--font-sans`); gradiente auth `from-wine-600 via-violet-900 to-[#58595b]` y `ambientAuthTheme` brand/accent vino; bulk replace de glows cian → `rgba(224,72,121` y clases `cyan/sky/teal/indigo` → `wine` en ~19 archivos (VoiceOrb, FloatingVoiceAssistant, DoctorMascot con fix de contraste `text-white`, botones, modales, páginas clínicas). **Regla de consistencia**: marca → wine; semánticos conservados (emerald éxito/approbación con hovers `emerald-500`, amber warning, destructive); estados orbe: listening wine / processing violet / responding emerald. Limitación: JPG HUD cian no recolorable (overlays en tinte cálido) — imagen luego eliminada en 9aa396 (fondos solo con gradiente). QA: `tsc` + **271/271**
- [X] T068 Footer + agendamiento del portal paciente: fat footer en landing (marca + contacto Quito/horario + redes placeholder, columnas Aplicación/Proyecto/Legal, acento gradiente wine, sub-footer oscuro © DoctorIA (marca ajena omitida — derechos pendientes)) y barras compartidas `AppFooterBar` en `ClinicalLayout` y `PatientDashboard`; `MonthCalendar` visual (`ui/month-calendar.tsx`, grid lu–do, minDate hoy) reemplaza el input date nativo en `RequestAppointmentModal` conservando las píldoras de horario en tiempo real; selector de necesidades de atención `patient/patientCategories.ts` (6 categorías estáticas, keywords sin acento, catch-all Especialidades) con chips + conteo que filtran el select de médicos. Directorio de médicos (foto/horarios/ubicación) **diferido** hasta contar con datos (decisión del usuario, 10-nov). Tests +6 → **277/277**
- [X] T069 CTA "Comenzar" con destino por rol (fix landing): el usuario reportó que `/clinical/voice` "ya no existe" tras login→logout→login. Reproducido con Playwright en producción (cuentas admin y médico): el ciclo de sesión en localStorage (`wasp:sessionId`) funciona bien — la causa real es el `RoleGuard allowedRoles=["medico"]` de `ClinicalVoicePage.tsx` (rebote silencioso a `/clinical/patients` para no-médicos); `/clinical/voice` es ruta oculta (entrada solo por CTA/voz). Fix decisión del usuario ("home según rol"): helper puro `client/roleHome.ts` `getRoleHomePath(role)` — sin sesión → `/login`, médico → `/clinical/voice`, admin/secretaria → `/clinical/patients`, paciente → `/patient/dashboard`; consumido por `Hero.tsx`, `FinalCTA.tsx` y el link "Panel clínico" del `Footer.tsx`. Tests +5 → **282/282**
- [X] T070 Card de pre-reserva de cita por voz/texto (secretaría, seguimiento del mapeo del usuario "conversacional para médico/secretaría/admin"): parser puro `client/voice/appointmentDraft.ts` — `parseAppointmentDraft` detecta la intención agendar y extrae paciente ("para/cita de"), médico con título (dr./dra./doctor, sin tragarse fechas), fecha relativa (hoy/mañana/pasado mañana/día de semana) o absoluta ("25 de noviembre"), hora ("a las 10:30", "10 y media", "de la tarde") y `matchByName` prellena solo si el nombre resuelve a UNA entidad (ambigüedad → null, nunca adivinar paciente; acepta nombre/email/`PAC-NNN`). Orbe flotante y `/clinical/voice` → `/clinical/agenda?new=1&draft=<json>`; `ClinicalAgendaPage` lee/limpia el parámetro y lo pasa al `NewAppointmentModal` con banner **"Pre-reserva detectada"** (cita hablada + chips Paciente/Médico/Fecha/Hora + teléfono del paciente + aviso "nada se guarda hasta Aceptar"), prefills, hora aplicada solo si el turno está libre (si no, aviso amber) y botón **"Aceptar y crear cita"** → `manageCita` (admin/médico/secretaria ya soportados server-side). **Costo fuera de alcance**: `Cita` no tiene ese campo en el modelo. Tests +20 → **302/302** (23 archivos); `tsc` + `wasp build` OK

**Checkpoint**: asistente flotante operativo y híbrido (navegación + RF-030 + RF-031, solo médico), captura guiada por voz en la nota clínica, rebrand aplicado, footer y portal paciente con agendamiento visual, CTA de landing con destino por rol, card de pre-reserva de cita por voz (T070), **302/302 tests verdes**, docs de gobierno al día. Cerrados el 8-nov: `documento @unique` (`f756540`), badges en toda la UI de citas (T061–T062), cobertura de tests de citas/vínculo/calendario/IA (T063), `aiDraft` en conflicto 409 (T064) y cola IA con progreso (T065); 9-nov: FSM de captura guiada Formulario 002 (T066); 10-nov: rebrand **** 2026 (T067) + footer/agendamiento portal paciente (T068) + CTA por rol (T069) + pre-reserva de cita por voz (T070).

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
- Sesión nov-2026 en curso (5–10 nov): asistente de voz flotante + híbrido RF-030/RF-031 + captura guiada FSM (T048–T066) + rebrand **** (T067) + footer/agendamiento portal paciente (T068) + CTA por rol (T069) + card de pre-reserva de cita por voz (T070), **302/302 tests**; cerrados el 8-nov: `documento @unique` (`f756540`), badges en toda la UI de citas (T061–T062), cobertura de tests (T063), `aiDraft` en conflicto 409 (T064) y cola IA con progreso (T065); 9-nov: FSM Formulario 002 (T066); 10-nov: rebrand **** 2026 (T067) + footer/agendamiento portal paciente (T068) + CTA por rol (T069) + pre-reserva de cita por voz (T070)