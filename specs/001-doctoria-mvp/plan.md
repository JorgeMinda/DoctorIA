# Implementation Plan: MVP DoctorIA

**Branch**: `001-doctoria-mvp` | **Date**: 2026-08-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-doctoria-mvp/spec.md` — 29 RF, 13 RNF, clarifications C-01 to C-05 fully resolved.

---

## Summary

Transformar la especificación funcional del MVP DoctorIA en una solución técnica implementable dentro del stack existente de Open SaaS/Wasp. La arquitectura añade un único módulo clínico (`app/src/clinical/`) al proyecto existente, reutilizando autenticación, autorización, Prisma/PostgreSQL, Radix UI, y la estructura modular de Wasp. Se definen 5 nuevas entidades de datos (SyntheticPatient, ClinicalNote, Epicrisis, AuditLog, MedicoPatientAccess), 17 operaciones Wasp tipadas, y un contrato de servicio de IA desacoplado del proveedor. La inmutabilidad de registros confirmados se garantiza mediante registros auto-referenciados y bloqueo a nivel de aplicación.

---

## Technical Context

**Language/Version**: TypeScript 6.0.3 sobre Node.js 25.2.1

**Framework**: Wasp 0.25.0 (Open SaaS template)

**Primary Dependencies**: React 19.2.x, Prisma 5.19.1, Zod 4.3.x, TailwindCSS 4.x, Radix UI, lucide-react

**Storage**: PostgreSQL via Prisma (datasource ya configurado en `schema.prisma`)

**Testing**: Vitest 4.1.x (unit/integration), Playwright 1.55.1 (E2E), @faker-js/faker 8.3.1 (datos sintéticos)

**Target Platform**: Aplicación web (servidor Node.js + cliente React)

**Project Type**: Web application (SaaS monolítico)

**Performance Goals**: Navegación P95 ≤ 2s, IA P95 ≤ 15s, timeout no bloqueante 30s (staging)

**Constraints**: Puerto 5432 ocupado por otro PostgreSQL; solo datos sintéticos; IA exclusivamente asistiva

**Scale/Scope**: MVP con una estimación técnica inicial de ~7 pantallas, 2 roles funcionales, datos sintéticos y equipo de 7 Doers; el número final de pantallas se valida en Google Stitch

---

## Constitution Check — Pre-Design Gate

| # | Principio | Evaluación | Evidencia |
|:---|:---|:---|:---|
| P1 | Spec-Driven Development | ✅ Cumple | Planificación basada en especificación aprobada; no se genera código en esta fase |
| P2 | AI Director Mindset | ✅ Cumple | Artefactos atómicos y revisables; decisiones documentadas con alternativas |
| P3 | Reutilización de Stack | ✅ Cumple | Se reutiliza Wasp/Prisma/React/Radix; no se introduce framework nuevo |
| P4 | Seguridad Clínica y Supervisión | ✅ Cumple | IA nunca confirma; flujo exige confirmación humana explícita |
| P5 | Protección de Datos y Privacidad | ✅ Cumple | Exclusivamente datos sintéticos; sin PII en logs; secrets fuera de Git |
| P6 | Alcance Controlado del MVP | ✅ Cumple | Módulo clínico único; sin microservicios, K8s ni buses de eventos |
| P7 | Calidad y Pruebas Rigurosas | ✅ Cumple | Estrategia de pruebas definida con 12 niveles |
| P8 | Usabilidad y Accesibilidad | ✅ Cumple | Google Stitch gate mantenido; WCAG AA vía Radix UI |
| P9 | Trazabilidad Integral | ✅ Cumple | Modelo AuditLog separado de logs técnicos |
| P10 | Gobierno del Proyecto | ✅ Cumple | 7 Doers documentados; decisiones pendientes explícitas |

**Gate result**: ✅ PASS técnico interno — no autoriza el siguiente gate hasta la revisión humana del plan.

---

## Architecture Overview

### Reused Open SaaS Capabilities

| Capacidad | Módulo existente | Reutilización |
|:---|:---|:---|
| Autenticación email + verificación + password reset | `src/auth/` | Directa — sin cambios |
| Modelo de usuario con `isAdmin` | `schema.prisma` → `User` | Extendido con `isMedico`, `fullName`, `specialty` y relaciones clínicas |
| Panel de administración (rutas, layout) | `src/admin/` | Extendido para gestión de datos sintéticos y auditoría admin |
| Validación de inputs con Zod | `src/server/validation.ts` | Directa — `ensureArgsSchemaOrThrowHttpError` |
| Validación de variables de entorno | `src/env.ts` | Extendido con schema clínico |
| Configuración de sesiones y cookies | Wasp built-in | Directa |
| Componentes UI (Radix, Tailwind, icons) | `src/client/components/ui/` | Directa |
| Navbar, dark mode, layout | `src/client/components/` | Directa |
| Seed de datos de prueba | `main.wasp.ts` → `seeds[]` | Extendido con `seedSyntheticClinicalData` |
| E2E testing infra (Playwright) | `e2e-tests/` | Extendido con escenarios clínicos |
| Estructura modular Wasp (`.wasp.ts` specs) | Todos los módulos | Patrón seguido para módulo clínico |

**Capacidades preservadas sin modificación**: Payment (Stripe/LemonSqueezy/Polar), file upload (S3), analytics, demo-ai-app, landing page. Permanecen funcionales pero fuera del alcance clínico.

### New Clinical Module

```text
app/src/clinical/
├── clinical.wasp.ts           # Routes, queries, actions spec
├── operations.ts              # Server-side operation implementations
├── services/
│   ├── authorization.ts   # ensureMedico, ensureAdmin, ensurePatientAccess guards
│   ├── ai-structuring.ts      # AI service contract + mock implementation
│   ├── audit.ts               # Audit log creation helper
│   ├── note-validation.ts     # RF-026/RF-027 confirmation validators
│   └── immutability.ts        # State transition guards
├── pages/
│   ├── PatientListPage.tsx    # Patient search and listing
│   ├── PatientDetailPage.tsx  # Patient profile + history timeline
│   ├── ClinicalNoteEditor.tsx # Unified text + AI + review + confirm
│   ├── EpicrisisPage.tsx      # Epicrisis view/edit/confirm
│   └── AuditPage.tsx          # Personal audit trail
└── components/
    ├── PatientCard.tsx         # Patient list item
    ├── NoteStatusBadge.tsx     # Visual state indicator
    ├── AIProgressIndicator.tsx # Loading state with 2s threshold
    ├── SectionEditor.tsx      # Individual section editor with N/A toggle
    ├── ConfirmationDialog.tsx  # Confirmation summary modal
    ├── HistoryTimeline.tsx     # Chronological note/epicrisis view
    └── AddendumForm.tsx        # Addendum creation with reason
```

### Module Integration

El módulo clínico se integra siguiendo el patrón establecido:

1. `clinical.wasp.ts` exporta `clinicalSpec` (array de routes, queries, actions).
2. `main.wasp.ts` importa `clinicalSpec` y lo incluye en el array `spec`.
3. Las entidades clínicas se definen en `schema.prisma` junto a las existentes.
4. `authConfig.onAuthSucceededRedirectTo` se actualiza de `/demo-app` a la ruta clínica principal.

---

## Data Model

Referencia completa: [data-model.md](data-model.md)

### Resumen de entidades

| Entidad | Tipo | Registros estimados (seed) |
|:---|:---|:---|
| `User` | Existente + extensión (`isMedico`, `fullName`, `specialty`) | estimación técnica: 5–10 (médicos + admins + usuarios sin habilitar; no es un requisito validado) |
| `SyntheticPatient` | **Nuevo** | estimación técnica: 5–10 pacientes sintéticos (no es un requisito validado) |
| `MedicoPatientAccess` | **Nuevo** | estimación técnica: ~20–40 asignaciones médico↔paciente (no es un requisito validado) |
| `ClinicalNote` | **Nuevo** | 10–20 (notas de demostración) |
| `Epicrisis` | **Nuevo** | 2–5 (epicrisis de demostración) |
| `AuditLog` | **Nuevo** | Generado automáticamente por operaciones |

### Relaciones clave

- `User` 1:N `ClinicalNote` (como autor y como confirmador — relaciones separadas)
- `User` 1:N `Epicrisis` (ídem)
- `User` 1:N `MedicoPatientAccess` (como médico autorizado, y como administrador que otorga acceso)
- `SyntheticPatient` 1:N `ClinicalNote`
- `SyntheticPatient` 1:N `Epicrisis`
- `SyntheticPatient` 1:N `MedicoPatientAccess`
- `MedicoPatientAccess` N:1 `User` (médico), N:1 `SyntheticPatient`, N:1 `User` (admin otorgante)
- `ClinicalNote` → `ClinicalNote` (self-ref para adendas)
- `Epicrisis` → `Epicrisis` (self-ref para adendas)
- `AuditLog` N:1 `User`, N:1? `SyntheticPatient`, N:1? `ClinicalNote`, N:1? `Epicrisis`

### Máquina de estados

Referencia completa: [data-model.md § State Machine](data-model.md#3-state-machine--clinicalnote)

Transiciones válidas:
- `(nuevo)` → `DRAFT_MANUAL` → `DRAFT_AI_ASSISTED` → `REVIEWED` → `CONFIRMED`
- `DRAFT_MANUAL` → `CONFIRMED` (confirmación manual directa)
- `DRAFT_AI_ASSISTED` → `CONFIRMED` (sin edición)
- `CONFIRMED` → solo adenda (nuevo registro)

---

## Authorization Strategy

### Principio fundamental

La autorización se aplica en **cada operación del servidor**, no solo en rutas del cliente. Se requieren dos niveles de verificación: (1) habilitación del rol médico explícita, y (2) autorización Médico↔Paciente por tabla de acceso.

### Identificación de roles (research R-02)

Open SaaS permite signup público. `User.isAdmin` defaults to `false`. Por lo tanto, `!isAdmin` **NO** implica que el usuario sea profesional médico — solo que no es administrador. Se agrega un campo explícito `isMedico: Boolean @default(false)` al modelo `User`.

| `isAdmin` | `isMedico` | Estado funcional DoctorIA |
|:---|:---|:---|
| `false` | `false` | Usuario autenticado sin acceso funcional al módulo clínico |
| `false` | `true` | Médico — operaciones clínicas sobre pacientes autorizados |
| `true` | `false` | Administrador — gestión de cuentas, roles, datos sintéticos |
| `true` | `true` | Inválido — bloqueado por guards; roles mutuamente excluyentes |

Un usuario registrado NO obtiene acceso clínico hasta que un administrador habilite `isMedico = true`.

### Implementación

```text
┌───────────────────────────────────────────────────────────────────┐
│                   Operación Wasp (clínica)                        │
│                                                                   │
│  1. ¿context.user existe?             → No → HttpError(401)      │
│  2. ¿context.user.isMedico === true                               │
│     AND context.user.isAdmin === false? → No → HttpError(403)    │
│  3. ¿Operación requiere patientId?                                │
│     └→ Sí: ¿MedicoPatientAccess existe                            │
│            para (userId, patientId)?    → No → HttpError(403)    │
│     └→ Recurso derivado (nota/epicrisis):                         │
│            Resolver patientId del recurso,                        │
│            luego verificar MedicoPatientAccess                    │
│  4. Validar input con Zod                                         │
│  5. Ejecutar lógica de negocio                                    │
│  6. Crear AuditLog                                                │
│  7. Retornar resultado                                            │
└───────────────────────────────────────────────────────────────────┘
```

### Guards reutilizables

Dos funciones guard que encapsulan la lógica de autorización:

- `ensureMedico(context)` — verifica `context.user` exists AND `isMedico === true` AND `isAdmin === false`; lanza 401/403
- `ensureAdmin(context)` — verifica `context.user` exists AND `isAdmin === true`; lanza 401/403

Estas funciones se colocan al inicio de cada operación, siguiendo el patrón ya usado en `user/operations.ts`.

### Autorización Médico ↔ Paciente (research R-10)

RF-025 y C-03 establecen que un Médico accede a "pacientes autorizados" — no a todos los pacientes. La relación `MedicoPatientAccess` (tabla M:N con `medicoId`, `patientId`, `grantedAt`, `grantedById`) se verifica en servidor en **toda operación patient-scoped**:

- **Listado/búsqueda**: filtra resultados via `JOIN MedicoPatientAccess WHERE medicoId = context.user.id`.
- **Detalle/historial/notas/epicrisis**: verifica `MedicoPatientAccess` exists antes de retornar datos.
- **Recursos derivados (nota, epicrisis, adenda)**: resuelve `patientId` a través del recurso, luego verifica `MedicoPatientAccess`.
- **Respuesta de acceso denegado**: HTTP 403 o 404 sin revelar contenido clínico del paciente no autorizado.

El administrador gestiona las asignaciones Médico↔Paciente via la operación `manageMedicoPatientAccess` (solo admin).

### Módulo admin extendido

Las operaciones administrativas de DoctorIA (gestión de pacientes sintéticos, asignación de acceso médico↔paciente, auditoría administrativa) se integran en el módulo admin existente o en el módulo clínico con guard `ensureAdmin`. La ruta `/admin` existente ya verifica autenticación.

---

## AI Structuring Strategy

### Principio: IA exclusivamente asistiva

La IA **nunca** confirma, diagnostica, prescribe ni toma decisiones clínicas. Su función es exclusivamente estructurar texto libre en 5 secciones predefinidas.

### Contrato técnico

Referencia completa: [contracts/clinical-operations.md § AI Service Contract](contracts/clinical-operations.md#6-ai-service-contract-internal)

```text
  Médico escribe texto    →  originalText (preservado siempre)
          │
          ▼
  Solicitar IA            →  structureClinicalText(text, mode)
          │
     ┌────┴────┐
     │         │
  Éxito     Fallo/Timeout
     │         │
     ▼         ▼
  5 secciones   Alerta no bloqueante
  pobladas      + continuación manual
  + contenido   (originalText intacto)
  no clasificable
  marcado
          │
          ▼
  Médico revisa           →  Estado: REVIEWED (si edita)
          │
          ▼
  Médico confirma         →  Estado: CONFIRMED (con validación RF-026)
```

### Decisión de proveedor: PENDIENTE

| Aspecto | Estado |
|:---|:---|
| Contrato definido | ✅ Input/Output/Error tipados |
| Proveedor seleccionado | ❌ Pendiente (PD-01) |
| Dependencia `openai` existente | Solo para `demo-ai-app`, no para DoctorIA |
| Mock para desarrollo | ✅ Implementación determinista planificada |

El contrato interno (`structureClinicalText`) es una función TypeScript con firma tipada. No se diseña una abstracción multiproveedor compleja. Cuando se apruebe el proveedor, se implementa esa función con el SDK correspondiente. Si se elige OpenAI, la dependencia existente se comparte; si se elige otro proveedor, se agrega su SDK.

### Timeout y degradación

- **Client-side**: indicador de procesamiento visible después de 2 segundos.
- **Server-side**: timeout de 30 segundos en la llamada al proveedor.
- **Degradación**: ante timeout o error, la operación retorna error 504/503, el cliente muestra alerta no bloqueante y mantiene `originalText` intacto para continuación manual.

### Calidad de estructuración

Evaluación post-implementación sobre dataset de 30 notas sintéticas etiquetadas:
- 100% conservación del texto original (zero omissions).
- Contenido no clasificable marcado "Requiere revisión".
- Objetivo inicial: ≥ 90% de asignación correcta a las 5 secciones.
- Esto mide **estructuración de texto**, NO diagnóstico clínico.

---

## Immutability & Versioning Strategy

### Principio

Un registro clínico confirmado es **inmutable a nivel de aplicación**. Ninguna operación Wasp puede ejecutar UPDATE sobre un registro con `status = 'CONFIRMED'`.

### Mecanismo

1. **Guard de inmutabilidad**: toda operación de escritura sobre ClinicalNote o Epicrisis verifica `status !== 'CONFIRMED'` antes de proceder. Si el registro está confirmado → `HttpError(409, "Registro confirmado: solo se permite crear adenda")`.

2. **Adenda como nuevo registro**: la corrección crea un NUEVO registro con:
   - `noteType = 'ADDENDUM'`
   - `parentNoteId` / `parentEpicrisisId` → referencia al original
   - `addendumReason` (obligatorio, no puede estar vacío)
   - Autor, timestamp y contenido propio

3. **Cadena de trazabilidad**: la relación self-referencial permite reconstruir la cadena completa de versiones para cualquier nota o epicrisis.

4. **Visualización**: el historial del paciente muestra la cadena Original → Adenda(s) con links de navegación entre versiones.

### Validación de integridad

Tests específicos deben verificar:
- Que un UPDATE directo a Prisma sobre un registro confirmado sea rechazado por la lógica de negocio.
- Que la adenda preserve el registro original sin modificarlo.
- Que `addendumReason` sea obligatorio y no vacío.
- Que la cadena de versiones sea navegable en ambas direcciones.

---

## Audit Strategy

### Dos sistemas separados

| Aspecto | Auditoría funcional (AuditLog) | Logs técnicos (console/stdout) |
|:---|:---|:---|
| **Almacenamiento** | Tabla PostgreSQL | Stdout del servidor Wasp |
| **Contenido** | Acciones, IDs, timestamps, metadata no clínica | Errores, warnings, debug info |
| **Contiene texto clínico** | ❌ Nunca | ❌ Nunca |
| **Acceso** | Consulta desde la aplicación | Acceso a infraestructura/DevOps |
| **Retención** | Persistente en BD | Según configuración de infra |
| **Requisitos** | RF-019, RF-020, RNF-007 | Debugging y monitoreo operativo |

### Eventos auditados

Referencia completa: [data-model.md § AuditLog](data-model.md#auditlog)

13 tipos de acciones documentados. Cada acción registra:
- **Quién**: `userId` (referencia, no nombre completo)
- **Qué**: `action` (tipo de acción)
- **Sobre qué**: `resourceType` + `resourceId`
- **Cuándo**: `createdAt` (timestamp automático)
- **Metadata**: transiciones de estado, no contenido clínico

### Helper de auditoría

Una función helper (`createAuditEntry`) se invoca al final de cada operación de escritura, dentro de la misma transacción Prisma cuando sea posible, para garantizar atomicidad.

---

## Security & Privacy

| Control | Implementación |
|:---|:---|
| Solo datos sintéticos | `SyntheticPatient` con datos claramente ficticios; seed verificable |
| Ningún dato clínico real | Constitución P5; validación en reviews |
| Secrets fuera de Git | `.gitignore` ya incluye `.env`; `.env.*.example` con placeholders |
| Sin PII en logs | Console logs sin texto clínico; AuditLog sin contenido médico |
| Mínimo privilegio | Médico no accede a admin; Admin no accede a clínica |
| Separación de usuarios | Cada operación verifica `context.user.id` como autor |
| HTTPS | Requisito de despliegue futuro; no aplica en desarrollo local |
| Validación de inputs | Zod en toda operación (patrón existente) |
| No cumplimiento regulatorio declarado | Limitación de alcance; el MVP no declara cumplimiento regulatorio |

---

## Performance & Availability

### Objetivos en staging

| Métrica | Objetivo | Medición |
|:---|:---|:---|
| Navegación, carga, búsqueda | P95 ≤ 2s | Playwright timing assertions + DevTools Network |
| Procesamiento IA | P95 ≤ 15s | Timing en `requestAIStructuring` action |
| Indicador visual de IA | Visible después de 2s | E2E test con mock de latencia |
| Timeout no bloqueante | 30s → alerta + continuación manual | E2E test con mock de timeout |
| Disponibilidad staging | Registrar interrupciones (RNF-013) | Log manual de sesiones de prueba |
| SLA de producción | ❌ No definido todavía | Post-piloto |

### Medición en QA

- **Automatizada**: Playwright tests con assertions de timing (`expect(responseTime).toBeLessThan(2000)`).
- **Semi-automatizada**: Scripts que ejecutan las 30 notas sintéticas contra el servicio de IA y registran P95.
- **Manual**: Registro de interrupciones/inactividad durante sesiones de prueba en staging.

No se implementan herramientas de observabilidad en esta fase. Los tiempos se miden con las herramientas ya disponibles (Playwright, Browser DevTools, console timestamps).

---

## Testing Strategy

### Niveles de prueba

| Nivel | Herramienta | Cobertura | Cuándo |
|:---|:---|:---|:---|
| **Unitarias** | Vitest | Validadores, guards, state transitions, AI service mock | Durante implementación |
| **Validación** | Vitest | RF-026/RF-027 confirmation rules, Zod schemas | Durante implementación |
| **Autorización** | Vitest | `ensureMedico` / `ensureAdmin` guards; acceso negado cross-role | Durante implementación |
| **Integración** | Vitest + Prisma | Operaciones completas con BD de test | Post-implementación de operaciones |
| **Persistencia** | Vitest + Prisma | CRUD de entidades, cascadas, constraints | Post-schema |
| **Inmutabilidad** | Vitest + Prisma | UPDATE bloqueado en CONFIRMED; adenda crea nuevo registro | Post-implementación |
| **IA mocks** | Vitest | Respuestas deterministas, timeout, error, contenido no clasificable | Durante implementación de AI service |
| **Fallos/Timeouts** | Vitest + Playwright | Degradación grácil, UI no bloqueante, texto preservado | Post-UI |
| **E2E** | Playwright | 10 escenarios del [quickstart.md](quickstart.md) | Post-integración completa |
| **Accesibilidad** | Playwright + axe-core | WCAG AA compliance en componentes clínicos | Post-UI |
| **Rendimiento** | Playwright + timing | P95 assertions en staging | QA phase |
| **Visual QA** | Browser Subagent | Verificación visual de flujos, estados, responsive | QA phase |

### Datos de prueba

- **Unit/Integration**: Fixtures generados con `@faker-js/faker` (ya disponible).
- **E2E**: Datos del seed (`wasp db seed`).
- **AI Quality**: Dataset de 30 notas sintéticas etiquetadas (creado durante QA).

---

## Google Stitch Gate

### Secuencia obligatoria

```text
Plan técnico (este documento)
  → Revisión/aprobación humana
    → DESIGN.md (sistema de diseño clínico)
      → Google Stitch: 2-3 pantallas principales
        → Prototype conectado
          → Exportación a Antigravity
            → /speckit-tasks
              → Implementación
```

### Pantallas candidatas para Stitch

| # | Pantalla | Justificación |
|:---|:---|:---|
| 1 | **Lista de Pacientes y Búsqueda** | Punto de entrada principal post-login; define el patrón de navegación clínica |
| 2 | **Editor de Nota Clínica** | Pantalla más compleja: campo unificado + estados + IA + revisión + confirmación |
| 3 | **Historial del Paciente + Epicrisis** | Timeline cronológico, cadena de versiones, generación/confirmación de epicrisis |

Estas 3 pantallas están planteadas para representar los flujos clínicos principales (HU-01 a HU-07) y quedan sujetas a validación en Google Stitch y revisión humana. El diseño visual NO se realiza en esta fase.

---

## Risks & Pending Decisions

### Decisiones técnicas pendientes

| ID | Decisión | Impacto | Bloqueante para |
|:---|:---|:---|:---|
| PD-01 | Selección de proveedor de IA | Define SDK, costos, límites de API | Tareas de implementación de IA |
| PD-02 | Puerto/configuración de PostgreSQL para desarrollo | Entorno de desarrollo local | Configuración y primera conexión de la base de desarrollo |
| PD-03 | Diseño visual en Google Stitch | Define componentes UI específicos | Implementación de UI |

### Riesgos

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|:---|:---|:---|:---|:---|
| R-01 | Proveedor de IA seleccionado no cumple P95 ≤ 15s | Media | Alto | Contrato desacoplado permite cambio de proveedor; mock para desarrollo |
| R-02 | 30 notas sintéticas insuficientes para evaluar calidad | Baja | Medio | Dataset extensible; métrica inicial, no definitiva |
| R-03 | Puerto 5432 ocupado impide utilizar la base de desarrollo administrada por `wasp start db` | Baja | Medio | Usar una instancia PostgreSQL de desarrollo separada en un puerto libre y conectarla mediante `DATABASE_URL`; no detener la instancia existente |
| R-04 | Complejidad de inmutabilidad subestimada | Baja | Medio | Diseño simple (self-ref) con tests dedicados |
| R-05 | Equipo de 7 Doers vs. capacidad requerida | Media | Alto | Tareas atómicas; priorización por valor; P10 documenta excepción |

### Deuda de validación

- **Entrevistas**: 5 utilizables de un mínimo esperado de 8. La deuda continuará mediante validación con usuarios piloto. No se convierte en cumplimiento completo.
- **Hipótesis activas**: Ver [spec.md, sección 11 — Hipótesis Pendientes de Validación](spec.md#11-hipótesis-pendientes-de-validación). Las 7 hipótesis (H-01 a H-07) permanecen pendientes de validación con pilotos. Este plan no asume ninguna como verdadera.
- **No cumplimiento regulatorio declarado**: El MVP no declara cumplimiento con marcos regulatorios de salud. Esto constituye una limitación de alcance, no una hipótesis a validar.

### Dependencias externas

| Dependencia | Estado | Riesgo |
|:---|:---|:---|
| Wasp 0.25.0 | Estable, instalado | Bajo |
| Prisma 5.19.1 | Estable, instalado | Bajo |
| Proveedor de IA | No seleccionado | Alto — PD-01 |
| PostgreSQL local | Puerto conflictivo | Medio — PD-02 |
| Google Stitch | Disponible | Bajo |

---

## Constitution Check — Post-Design

| # | Principio | Evaluación | Evidencia en este plan |
|:---|:---|:---|:---|
| P1 | Spec-Driven Development | ✅ Cumple | Plan trazable a 29 RF + 13 RNF; no se genera código |
| P2 | AI Director Mindset | ✅ Cumple | Artefactos atómicos: research.md, data-model.md, contracts/, quickstart.md |
| P3 | Reutilización de Stack | ✅ Cumple | 11 capacidades reutilizadas; un solo módulo nuevo; cero frameworks adicionales |
| P4 | Seguridad Clínica | ✅ Cumple | IA desacoplada de confirmación; guards de inmutabilidad; validación RF-026 |
| P5 | Protección de Datos | ✅ Cumple | Solo datos sintéticos; AuditLog sin contenido clínico; logs técnicos limpios |
| P6 | Alcance Controlado | ✅ Cumple | Módulo clínico único; sin microservicios, K8s, buses, ni infra extra |
| P7 | Calidad y Pruebas | ✅ Cumple | 12 niveles de prueba; 10 escenarios E2E; dataset de 30 notas para IA |
| P8 | Usabilidad | ✅ Cumple | Stitch gate preservado; Radix UI para accesibilidad; WCAG AA |
| P9 | Trazabilidad | ✅ Cumple | AuditLog con 13 tipos de acción; cadena de versiones para adendas |
| P10 | Gobierno | ✅ Cumple | 3 decisiones pendientes documentadas; 5 riesgos identificados; deuda de validación visible |

**Gate result**: ✅ PASS técnico de los artefactos de planificación — sujeto a aprobación humana antes del siguiente gate.

---

## Project Structure

### Documentation (this feature)

```text
specs/001-doctoria-mvp/
├── spec.md                        # Especificación funcional (fuente de verdad)
├── plan.md                        # Este archivo (plan técnico)
├── research.md                    # Decisiones técnicas con alternativas
├── data-model.md                  # Modelo conceptual de datos
├── quickstart.md                  # Guía de validación E2E
├── contracts/
│   └── clinical-operations.md     # Contratos de operaciones Wasp + AI service
└── checklists/
    └── requirements.md            # Checklist de calidad de spec
```

### Source Code (repository root — cambios planificados, no ejecutados)

```text
app/
├── main.wasp.ts                   # [MODIFY] Agregar clinicalSpec al array spec
├── schema.prisma                  # [MODIFY] Agregar 5 entidades + extensiones User (isMedico)
├── src/
│   ├── clinical/                  # [NEW] Módulo clínico DoctorIA
│   │   ├── clinical.wasp.ts       # Routes, queries, actions
│   │   ├── operations.ts          # Server-side implementations
│   │   ├── services/
│   │   │   ├── authorization.ts   # ensureMedico, ensureAdmin, ensurePatientAccess
│   │   │   ├── ai-structuring.ts  # AI contract + mock
│   │   │   ├── audit.ts           # Audit helper
│   │   │   ├── note-validation.ts # RF-026/RF-027 validators
│   │   │   └── immutability.ts    # State transition guards
│   │   ├── pages/
│   │   │   ├── PatientListPage.tsx
│   │   │   ├── PatientDetailPage.tsx
│   │   │   ├── ClinicalNoteEditor.tsx
│   │   │   ├── EpicrisisPage.tsx
│   │   │   └── AuditPage.tsx
│   │   └── components/
│   │       ├── PatientCard.tsx
│   │       ├── NoteStatusBadge.tsx
│   │       ├── AIProgressIndicator.tsx
│   │       ├── SectionEditor.tsx
│   │       ├── ConfirmationDialog.tsx
│   │       ├── HistoryTimeline.tsx
│   │       └── AddendumForm.tsx
│   ├── env.ts                     # [MODIFY] Agregar clinicalEnvSchema
│   └── server/
│       └── scripts/
│           └── dbSeeds.ts         # [MODIFY] Agregar seedSyntheticClinicalData
│
└── e2e-tests/
    └── tests/
        └── clinical/              # [NEW] E2E tests para flujos clínicos
```

**Structure Decision**: Módulo clínico único (`src/clinical/`) con organización interna por responsabilidad (operations, services, pages, components). Sigue el patrón existente de `src/demo-ai-app/`, `src/admin/`, `src/auth/`.

---

## Complexity Tracking

No se identifican violaciones constitucionales que requieran justificación. Todas las decisiones de diseño se mantienen dentro de los límites de complejidad establecidos:

- ✅ Un solo módulo nuevo (no múltiples proyectos)
- ✅ Sin patrón Repository ni abstracciones innecesarias
- ✅ Sin ORM adicional ni base de datos adicional
- ✅ Sin microservicios ni comunicación entre servicios
- ✅ Sin dependencias nuevas obligatorias (el proveedor de IA es la única potencial)
