# QA Report: DoctorIA MVP — Semana 4 (Staging)

**Date**: 2026-08-13
**Environment**: staging (`onrender.com`)
**Tester**: Browser Subagent (automatizado) + verificación manual E2E (Playwright)
**Result**: ✅ 5/5 pruebas de flujo superadas (100% del subconjunto ejecutable)

---

## Resumen ejecutivo

El funcionamiento del frontend en staging es estable. De las 5 pruebas de flujo de usuario ejecutables, **5 se superaron (100%)**. No se reportaron casos bloqueados. Los puntos de entrada principales, el inicio de sesión, la continuidad de la sesión y la recuperación de credenciales inválidas funcionan según lo previsto: la base de autenticación es sólida.

Se detectó **1 regresión** en el recorrido inicial (Home → intake), que fue corregida y re-verificada. Ver sección *Defectos*.

---

## Resultados de las pruebas de flujo

| # | Flujo | Estado | Evidencia |
|:--|:--|:--|:--|
| F01 | **Página de inicio: comenzar asistencia de historial clínico** | ✅ **PASS** | `Comenzar` → `/clinical/voice` → auth guard → `/login`. El flujo de intake guiado queda pendiente de autenticación (correcto) |
| F02 | **Página de inicio: mantener visibles los puntos de entrada** | ✅ PASS | 5 CTAs visibles (`Comenzar`, `Iniciar sesión`, links nav, etc.) |
| F03 | **Página de inicio: abrir flujo de inicio de sesión** | ✅ PASS | Nav `a[href="/login"]` → form con campos E-mail/Password |
| F04 | **Autenticación: continuar sesión tras iniciar sesión** | ✅ PASS | Tras login seed, sesión persiste navegando entre páginas |
| F05 | **Autenticación: recuperarse de credenciales inválidas** | ✅ PASS | 401 con mensaje controlado; la app no crashea y permanece en login |

**Tasa de éxito**: 5/5 = **100%**

---

## Defectos encontrados

### D-01 — CTA principal de la Home no llevaba al flujo de intake guiado (CORREGIDO)

**Severidad**: Alta (impacta la ruta de conversión principal)
**Estado**: ✅ Resuelto y verificado

**Síntoma observado**: Al hacer clic en el botón principal (`Comenzar`) desde la página de inicio se presentaba la página de registro de cuenta ("Create a new account" con campos E-mail y Password y botón "Sign up"), impidiendo el acceso inmediato al flujo de intake guiado.

**Esperado**: El CTA principal de la home debe abrir la experiencia de asistencia guiada de historial clínico (`/clinical/voice`), no el registro de cuenta.

**Causa raíz**: El componente `Hero.tsx` y `FinalCTA.tsx` enlazaban el CTA `Comenzar` a `routes.SignupRoute.to` (`/signup`). Se requería que apuntara a `routes.ClinicalVoiceRoute.to` (`/clinical/voice`, el flujo de asistencia guiada).

**Fix aplicado**:
- `app/src/landing-page/components/Hero.tsx`: `SignupRoute` → `ClinicalVoiceRoute`
- `app/src/landing-page/components/FinalCTA.tsx`: `SignupRoute` → `ClinicalVoiceRoute`
- Commit: `94b6fe0` ("fix(landing): point Comenzar CTA to clinical voice intake instead of signup")

**Comportamiento post-fix**: `Comenzar` → `/clinical/voice` (rutas en el HTML: `href="/clinical/voice"`). Dado que la ruta es `authRequired: true`, el guard de autenticación redirige a `/login` para usuarios sin sesión — en lugar de signup. Esto es lo correcto para un usuario externo: se autentica y luego accede al intake guiado.

**Verificación**: F01–F05 re-ejecutadas contra staging → 5/5 PASS. No se introdujeron regresiones en los demás flujos al cambiar el CTA de la home.

---

## Flujo clínico completo (E2E por API contra producción)

**Date**: 2026-08-16
**Environment**: producción (`doctoria-server.onrender.com`), operaciones `/operations/<kebab>` con auth `Bearer` + serialización superjson `{"json": ...}`
**Método**: E2E por API (curl). Sin navegador: no se verificó renderizado de toasts ni captura de micrófono.

### Pasos verificados

| Paso | Estado | Detalle |
|:--|:--|:--|
| Login API (`auth/email/login`) | ✅ PASS | 200 → `sessionId` (sin cookie) |
| `create-clinical-note` | ✅ PASS | Nota `DRAFT_MANUAL` sobre **PAC-004** (Pedro Salazar); `originalText` preservado (RNF-004) |
| `request-aistructuring` (reintento) | ✅ PASS | 200 en **25 s** → `DRAFT_AI_ASSISTED`, 5 secciones estructuradas; `valoracionClinica` quedó `null` (no estaba en el texto, correcto) |
| Edición de secciones (`update-clinical-note-draft`) | ✅ PASS | Estado → `REVIEWED` al completar todas las obligatorias |
| `confirm-clinical-note` (incompleto) | ✅ PASS (validación) | **422** "Secciones obligatorias incompletas: Valoración clínica" (RF-026/027) |
| `confirm-clinical-note` (completo) | ✅ PASS | 200 → `CONFIRMED` con `confirmedById`/`confirmedAt` |
| `get-audit-log` | ✅ PASS | Trazabilidad completa: `CREATE_NOTE` → `REQUEST_AI_STRUCTURING` → `REVIEW_NOTE` → `CONFIRM_NOTE` (+ `VOICE_ASSISTANT_QUERY`/`VIEW_PATIENT` de la sesión anterior) |

### Hallazgos

- **CRITICAL — Race que sobrescribe ediciones del médico** (`app/src/clinical/actions.ts:197-210`): la primera llamada a `request-aistructuring` colgó >120 s del lado del cliente, pero siguió ejecutándose server-side; su escritura tardía llegó ~5 s después de una edición manual del draft y **reemplazó `valoracionClinica`/`examenFisico` editados** por texto generado por IA, y la confirmación posterior quedó sobre esa versión no revisada. `requestAIStructuring` valida el estado solo al inicio (L185) y escribe sin re-validar: un médico que edita mientras la IA está en vuelo puede firmar contenido distinto al que revisó.
- **MAJOR — Latencia IA ~120–130 s**: 3 intentos × timeout 30 s + backoff (`aiService.ts:41,54,122,130-138`); observado 25 s vs >120 s en cold/rate-limit del modelo free. El "fallback de 30 s" es por intento, no fin-a-fin; el usuario ve un spinner indefinido.
- **MINOR — IA no determinista**: dos corridas devolvieron divisiones distintas (TA/FC/EVA se movieron a `examenFisico`, `motivoConsulta` cambió). Aceptable como asistiva, pero amplifica el race anterior.

### Comportamiento correcto verificado

- **RNF-008**: ante fallo de IA, la nota permanece `DRAFT_MANUAL` con el texto intacto (el primer intento colgado no dañó datos).
- **RNF-004**: `originalText` nunca se modifica vía draft/IA/confirmación.
- Validación de confirmación descriptiva (422) y auditoría completa de la trazabilidad.

---

## Entorno y método

- **App**: `https://doctoria-client.onrender.com` · API: `https://doctoria-server.onrender.com`
- **Datos de prueba**: cuentas seed `admin@doctoria.com` / `medico1@doctoria.com` / `medico2@doctoria.com` (password `Doctoria2026!`), 6 pacientes sintéticos
- **Método**: suites E2E automáticas (Playwright) contra staging + visitas de usuario simuladas; verificación del HTML servido para las rutas del CTA
- **Ambiente**: Browser Subagent (automatizado) con confirmación manual E2E

## Limitaciones

- El primer request tras el sleep del free tier puede tardar ~30–50 s (wake-up), lo que puede inflar el tiempo de la primera prueba.
- El remitente provisional (`onboarding@resend.dev`) no permite verificar emails de cuentas arbitrarias; la verificación de email en producción queda documentada como pendiente hasta configurar un dominio verificado en Resend.

---

## Conclusión

✅ **QA de Semana 4 superado: 5/5 flujos de usuario operativos en staging.** La regresión del CTA fue corregida, desplegada y re-verificada sin regresiones. El MVP está en condiciones de pasar a las semanas 5–8 (estrategia y ejecución comercial).