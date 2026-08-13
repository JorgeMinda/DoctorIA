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
- Pendiente de Semana 4: deploy a staging (proveedor/cuenta por definir con el sponsor), HTTPS+SSL, smoke test y reporte de QA.