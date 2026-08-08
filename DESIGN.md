# DESIGN.md — Sistema de Diseño Clínico MVP DoctorIA

**Feature**: 001-doctoria-mvp
**Fecha**: 2026-08-08
**Fase**: 2 — Diseño (previo a Google Stitch)
**Tipo**: Contrato UX/UI — NO es implementación, NO reemplaza spec.md ni plan.md.

**Leyenda de trazabilidad**:

| Marcador | Significado |
|:---|:---|
| `[APROBADO]` | Decisión proveniente de spec.md o plan.md |
| `[REUTILIZADO]` | Componente o patrón verificado en el repositorio Open SaaS |
| `[PROPUESTA PARA STITCH]` | Decisión UX/UI nueva pendiente de validación visual |

---

## 1. Principios UX/UI de DoctorIA

### 1.1 Claridad clínica `[APROBADO]`

La interfaz debe comunicar el estado del sistema y del registro clínico de manera inequívoca en todo momento. El profesional médico no debe necesitar deducir en qué estado se encuentra una nota, si la IA actuó, o si un registro es editable o inmutable.

- Cada pantalla tiene un único foco de acción primaria.
- El estado del registro clínico es visible sin necesidad de interacción.
- Las acciones irreversibles (confirmación) requieren diálogo de confirmación explícita.

### 1.2 Baja carga cognitiva `[APROBADO]`

El módulo clínico maneja texto libre y estructurado en forma simultánea. La interfaz reduce la carga mediante:

- Progresión lineal de flujos (redactar → estructurar → revisar → confirmar).
- Contexto del paciente siempre visible durante la creación o edición de una nota.
- Campos no requeridos visualmente subordinados a los obligatorios.
- Indicadores de progreso para operaciones largas (IA).

### 1.3 Seguridad clínica `[APROBADO]`

La IA es asistiva, nunca decisoria. La interfaz debe reforzar esto visualmente:

- El texto original del médico (`originalText`) es siempre visible y diferenciado del texto estructurado por IA.
- La acción "Confirmar" es siempre explícita, con resumen de validación previa (RF-026/RF-027).
- Los registros confirmados son visualmente inmutables — sin controles de edición.
- La IA nunca muestra texto que parezca un diagnóstico, prescripción o recomendación autónoma.

### 1.4 Jerarquía de información `[PROPUESTA PARA STITCH]`

- Nivel 1: Identidad del paciente sintético (nombre, ID sintético) — siempre presente.
- Nivel 2: Estado del registro activo (badge de estado).
- Nivel 3: Contenido clínico (secciones, texto).
- Nivel 4: Metadatos (autor, timestamp, versión).
- Nivel 5: Acciones secundarias (adenda, auditoría).

### 1.5 Accesibilidad WCAG AA `[APROBADO]`

- Contraste mínimo 4.5:1 para texto normal, 3:1 para texto grande.
- Todos los estados visuales comunican mediante etiqueta de texto, icono Y color simultáneamente (nunca solo color).
- Foco de teclado visible en todos los controles interactivos (Radix UI gestiona esto nativamente).
- `aria-label` en todos los controles de icono.
- Mensajes de error descriptivos vinculados al campo por `aria-describedby`.
- Referencia: Radix UI primitives ya proveen semántica ARIA correcta. `[REUTILIZADO]`

### 1.6 Diseño responsivo `[PROPUESTA PARA STITCH]`

- **Desktop (≥ 1024px)**: Layout de dos columnas donde aplique (paciente + nota). Sidebar de navegación clínica.
- **Tablet (640–1023px)**: Layout de columna única con contexto del paciente colapsable.
- **Mobile (< 640px)**: Flujo vertical. Acciones críticas accesibles sin scroll horizontal. Contexto del paciente como banner compacto en la parte superior.

---

## 2. Navegación clínica

### 2.1 Separación Médico / Administración `[APROBADO + PROPUESTA PARA STITCH]`

La separación funcional entre Médico y Administración está aprobada. Un Médico habilitado (`isMedico = true` e `isAdmin = false`) accede únicamente a funciones clínicas autorizadas; un Administrador (`isAdmin = true`) accede a funciones administrativas y no posee acceso clínico por defecto. Las rutas concretas del módulo clínico aún no están implementadas y se consideran propuesta técnica/visual hasta su definición en la fase correspondiente.

```
/ (post-login, médico)   → ruta clínica principal (por definir)
/ (post-login, admin)    → /admin
/ (post-login, sin rol)  → /  (sin acceso clínico visible)
```

### 2.2 Estructura de navegación clínica `[PROPUESTA PARA STITCH]`

El módulo clínico propone una barra lateral inspirada en el patrón visual del admin de Open SaaS. `[REUTILIZADO COMO PATRÓN: app/src/admin/layout/Sidebar.tsx, DefaultLayout.tsx]`

```
Sidebar clínico:
  ├── Pacientes
  └── Mi Auditoría
```

La ruta `/admin` ya existe con Sidebar + Header + DefaultLayout. `[REUTILIZADO COMO PATRÓN]` El módulo clínico puede conservar esa composición visual, pero los componentes administrativos existentes no se reutilizan directamente: `DefaultLayout` exige `isAdmin` y `Sidebar` referencia rutas administrativas. Cualquier equivalente clínico deberá adaptarse manteniendo los guards de autorización aprobados.

### 2.3 Contexto persistente del paciente `[APROBADO]`

Durante el flujo Paciente → Nota → Confirmación:

- La identidad del paciente sintético (nombre + ID sintético) permanece visible en el encabezado del contenido.
- El usuario no puede confundir qué paciente está siendo atendido.
- Al navegar fuera del paciente, el contexto se limpia explícitamente.

### 2.4 Breadcrumb `[REUTILIZADO + PROPUESTA PARA STITCH]`

Open SaaS incluye `app/src/admin/layout/Breadcrumb.tsx`, cuyo comportamiento actual representa `Dashboard / pageName`. `[REUTILIZADO]` Un breadcrumb clínico multinivel como `Pacientes > paciente sintético > Nueva Nota` requiere adaptación y permanece como `[PROPUESTA PARA STITCH]`; no se considera una capacidad ya implementada.

---

## 3. Sistema visual

### 3.1 Tipografía `[REUTILIZADO + PROPUESTA PARA STITCH]`

Open SaaS no define una fuente corporativa en el repositorio inspeccionado. El sistema de diseño utiliza las clases semánticas de Tailwind CSS 4 (`text-foreground`, `text-muted-foreground`, `font-semibold`, etc.) sin especificar una familia tipográfica custom.

- **[REUTILIZADO]**: Escala tipográfica de Tailwind CSS 4 (`text-sm`, `text-base`, `text-lg`, `text-xl`, `font-medium`, `font-semibold`).
- **[PROPUESTA PARA STITCH]**: La familia tipográfica corporativa de DoctorIA es una decisión pendiente. Se explorará en Stitch: Inter, Source Sans 3 u otra fuente sans-serif de alta legibilidad en contextos médicos.

### 3.2 Paleta de color `[PROPUESTA PARA STITCH]`

DoctorIA no posee identidad visual oficial. No se declaran colores institucionales.

- **[REUTILIZADO]**: Open SaaS utiliza tokens semánticos de Tailwind CSS 4: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`, `bg-destructive`, `bg-accent`. El sistema de color claro/oscuro ya está implementado mediante `DarkModeSwitcher`.
- **[PROPUESTA PARA STITCH]**: DoctorIA requerirá una paleta que comunique:
  - **Neutral clínico** para el fondo de trabajo (blanco / gris muy suave).
  - **Acción primaria** para confirmar y avanzar (azul profundo o verde sobrio — pendiente de validación).
  - **Advertencia** para estados "Requiere revisión" (ámbar / naranja).
  - **Error / bloqueado** para validación fallida (rojo controlado).
  - **IA / asistido** para texto estructurado por IA (diferenciado del texto original — pendiente de definición: borde izquierdo de color, fondo sutil, o badge).
  - Los colores semánticos deben funcionar en modo claro y oscuro.

### 3.3 Spacing y superficies `[REUTILIZADO]`

- Escala de espaciado de Tailwind CSS 4 (`p-4`, `p-6`, `gap-4`, `gap-6`, `max-w-*`).
- `Card` (variantes: `default`, `accent`, `faded`, `bento`) ya disponible con `rounded-xl border shadow hover:shadow-lg transition-all`. `[REUTILIZADO: app/src/client/components/ui/card.tsx]`
- Layout del módulo clínico: `max-w-(--breakpoint-2xl) mx-auto p-4 md:p-6 2xl:p-10` siguiendo `DefaultLayout`. `[REUTILIZADO]`

### 3.4 Bordes y radios `[REUTILIZADO]`

- `rounded-md` para botones e inputs (verificado en `button.tsx`).
- `rounded-xl` para cards (verificado en `card.tsx`).
- `rounded-full` para la NavBar en estado scrolled (verificado en `NavBar.tsx`).

### 3.5 Iconografía `[REUTILIZADO]`

`lucide-react` es la única librería de iconos del proyecto. No se usarán otras.

Iconos candidatos para el módulo clínico:

- `User` — paciente
- `FileText` — nota clínica
- `ClipboardList` — epicrisis
- `CheckCircle` — confirmado
- `Lock` — inmutable / solo lectura
- `AlertTriangle` — requiere revisión / advertencia
- `Loader2` — procesando (con animación spin)
- `WifiOff` — servicio IA no disponible
- `History` — historial / timeline
- `Plus` — nueva nota / adenda
- `Search` — búsqueda de pacientes
- `ShieldCheck` — auditoría
- `Sparkles` — asistido por IA

### 3.6 Feedback y notificaciones `[REUTILIZADO]`

- **Toast** (Radix UI Toast): ya disponible con posición configurable. Sin posición explícita, el viewport existente aparece en la parte superior en pantallas pequeñas y pasa a la zona inferior derecha desde el breakpoint `sm`. `[REUTILIZADO: app/src/client/components/ui/toast.tsx, toaster.tsx]`
- **Alert**: disponible para mensajes en-página persistentes. `[REUTILIZADO: app/src/client/components/ui/alert.tsx]`
- **Dialog**: para confirmaciones críticas (confirmar nota, confirmar epicrisis). `[REUTILIZADO: app/src/client/components/ui/dialog.tsx]`
- **Progress**: para la barra de progreso de operaciones IA (`bg-primary/20`, `bg-primary`). `[REUTILIZADO: app/src/client/components/ui/progress.tsx]`

---

## 4. Estados visuales

Todos los estados comunican mediante **tres canales simultáneos**: color de fondo/borde + icono + etiqueta de texto. El color nunca es el único diferenciador.

| Estado | Etiqueta de texto | Icono (lucide-react) | Señal visual | Componente base |
|:---|:---|:---|:---|:---|
| `DRAFT_MANUAL` | "Borrador manual" | `PenLine` | Badge neutro | `[PROPUESTA PARA STITCH]` |
| `DRAFT_AI_ASSISTED` | "Borrador IA" | `Sparkles` | Badge con acento IA | `[PROPUESTA PARA STITCH]` |
| `REVIEWED` | "Revisado" | `Eye` | Badge informativo | `[PROPUESTA PARA STITCH]` |
| `CONFIRMED` | "Confirmado" | `CheckCircle` + `Lock` | Badge verde, borde verde | `[PROPUESTA PARA STITCH]` |
| Requiere revisión (sección) | "Requiere revisión" | `AlertTriangle` | Banner ámbar inline | `alert.tsx [REUTILIZADO]` |
| Procesando (IA) | "Estructurando nota…" | `Loader2` (spin) | Spinner + Progress + Timer | `progress.tsx [REUTILIZADO]` |
| Error | "Error al procesar" | `AlertCircle` | Toast destructivo | `toast.tsx [REUTILIZADO]` |
| Sin datos (lista vacía) | "Sin pacientes asignados" | `Users` | Estado vacío centrado | `card.tsx [REUTILIZADO]` |
| Solo lectura | "Solo lectura" | `Lock` | Controles deshabilitados + badge | `[PROPUESTA PARA STITCH]` |
| No autorizado | "Acceso no autorizado" | `ShieldOff` | Página de error 403 | `[PROPUESTA PARA STITCH]` |
| Cargando | — | `Loader2` (spin) | Skeleton / spinner centrado | `[PROPUESTA PARA STITCH]` |

### 4.1 Representación de estado en NoteStatusBadge

El badge de estado acompaña al título de la nota en la lista de historial y en el editor. No se define la paleta final de colores (pendiente de Stitch), pero se establece que:

- `CONFIRMED` es el único estado con icono de candado adicional (`Lock`).
- `DRAFT_AI_ASSISTED` es el único estado con icono de IA (`Sparkles`).
- Los estados `DRAFT_*` y `REVIEWED` permiten edición. `CONFIRMED` la bloquea visualmente.

---

## 5. Asistencia de IA

### 5.1 Principio de representación `[APROBADO]`

La IA es exclusivamente asistiva. Estructura texto libre en 5 secciones aprobadas. La interfaz debe hacer esto evidente en todo momento:

- El texto estructurado por IA nunca se presenta como diagnóstico, prescripción, recomendación clínica ni como confirmación.
- La diferencia entre el texto redactado por el médico y el texto organizado por la IA es visualmente explícita.
- El médico controla explícitamente cuándo solicitar estructuración.

### 5.2 Estados del flujo de IA `[APROBADO + PROPUESTA PARA STITCH]`

| Estado IA | Disparador | Representación UI |
|:---|:---|:---|
| **No solicitada** | Estado inicial de la nota | Campo de texto unificado activo. Sin secciones visibles. Botón "Solicitar Estructuración IA" disponible. |
| **Procesando** | Clic en "Solicitar Estructuración IA" | Botón deshabilitado. Después de 2s: `Progress` indeterminado + `Loader2` spin + label "Estructurando nota…" (RNF-011). |
| **Resultado** | IA responde exitosamente | 5 secciones aparecen pobladas. `originalText` visible en zona separada ("Texto original redactado"). Estado = `DRAFT_AI_ASSISTED`. Badge IA visible. |
| **Requiere revisión (sección)** | Contenido no clasificable | Sección marcada con `AlertTriangle` + label "Requiere revisión". El médico debe revisar y completar. |
| **Timeout 30s** | IA no responde en 30s | Toast no bloqueante: "El servicio de IA no está disponible. Puedes continuar manualmente." `originalText` intacto. Estado permanece `DRAFT_MANUAL`. (RF-021, RNF-008) |
| **Servicio no disponible** | Error 503/504 del servidor | Mismo tratamiento que timeout. Toast + continuación manual. |
| **Continuación manual** | Timeout / error / elección del médico | Las 5 secciones siguen vacías y editables. El médico las completa directamente. `originalText` nunca se pierde. |

### 5.3 Diferenciación visual: texto original vs. texto estructurado `[PROPUESTA PARA STITCH]`

La zona del editor de nota se divide en dos áreas claramente delimitadas cuando la IA ha actuado:

**Área A — Texto original del médico** (`originalText`):
- Fondo ligeramente diferenciado (tono neutro más oscuro o borde izquierdo).
- Etiqueta: "Texto original (preservado)".
- Solo lectura. Icono `Lock` pequeño.
- Presente siempre, incluso después de estructuración IA.

**Área B — Secciones estructuradas**:
- 5 accordions o paneles expandibles (Motivo de consulta, Nota clínica/evolución, Examen físico, Valoración clínica, Plan/indicaciones).
- Si fueron pobladas por IA: badge "Asistido por IA" visible en cada sección.
- Editables por el médico.
- "No aplica" con campo de justificación requerido (RF-026).

### 5.4 Prohibición de lenguaje diagnóstico `[APROBADO]`

La interfaz no utiliza frases como "La IA diagnosticó", "Se recomienda", "Confirmar diagnóstico", ni ninguna otra que posicione a la IA como decisora clínica. El lenguaje correcto es: "La IA estructuró el texto en las siguientes secciones. Revise y confirme."

---

## 6. Diseño responsivo

### 6.1 Desktop (≥ 1024px) `[PROPUESTA PARA STITCH]`

- **Lista de Pacientes**: Grid de cards o tabla compacta. Sidebar clínico visible.
- **Editor de Nota**: Layout dividido: panel izquierdo (contexto del paciente + `originalText`) — panel derecho (secciones estructuradas). Sidebar visible.
- **Historial + Epicrisis**: Timeline vertical de ancho completo. Sidebar visible.

### 6.2 Tablet (640–1023px) `[PROPUESTA PARA STITCH]`

- Sidebar colapsado a íconos o drawer on-demand (usando `Sheet` existente de Radix UI). `[REUTILIZADO: app/src/client/components/ui/sheet.tsx]`
- Editor de Nota: columna única, `originalText` arriba, secciones abajo con scroll.
- Contexto del paciente como header compacto.

### 6.3 Mobile (< 640px) `[PROPUESTA PARA STITCH]`

- Navegación hamburger menu (reutilizando el Sheet/mobile menu existente de NavBar). `[REUTILIZADO: NavBar.tsx]`
- Editor de Nota: tab switcher entre "Texto original" y "Secciones".
- Confirmación accesible con botón fijo en footer de pantalla.
- El botón "Solicitar IA" y "Confirmar Nota" nunca quedan fuera del viewport en modo vertical.

---

## 7. Pantallas candidatas para Google Stitch

---

### Pantalla A — Lista/Búsqueda de Pacientes

#### 7.A.1 Objetivo `[APROBADO]`

Punto de entrada principal para el médico autenticado con `isMedico = true`. Permite buscar y seleccionar un paciente sintético para iniciar o continuar un flujo clínico. Solo muestra los pacientes autorizados para el médico (via `MedicoPatientAccess`).

#### 7.A.2 Contenido y jerarquía `[APROBADO + PROPUESTA PARA STITCH]`

```
┌─ Header (contexto de usuario) ─────────────────────────────────┐
│  [Nombre del médico] [Especialidad]          [Cerrar sesión]   │
└────────────────────────────────────────────────────────────────┘
┌─ Sidebar ──┐  ┌─ Contenido principal ──────────────────────────┐
│ Pacientes  │  │  [H1] Mis Pacientes                            │
│ Mi Auditoría│  │  [Buscador] Buscar por nombre o ID sintético  │
└────────────┘  │                                                 │
                │  [Card PAC-001] García, Juan A.                 │
                │   ID: PAC-001 · Última nota: dd/mm/yyyy         │
                │   [Ver perfil →]                                │
                │                                                 │
                │  [Card PAC-002] Ramírez, M.                     │
                │  ...                                            │
                └────────────────────────────────────────────────┘
```

#### 7.A.3 Acciones `[APROBADO]`

- **Buscar** por nombre o `syntheticId` (RF-002). Respuesta P95 ≤ 2s (RNF-010).
- **Seleccionar paciente** → navega a detalle del paciente.

#### 7.A.4 Estados `[APROBADO]`

| Estado | Representación |
|:---|:---|
| Cargando | Skeleton cards |
| Lista con datos | Grid/lista de Patient Cards |
| Lista vacía | `Card` con icono `Users` + "No tienes pacientes asignados. Contacta al administrador." |
| Error de red | Toast destructivo + botón "Reintentar" |
| Sin resultados de búsqueda | Mensaje inline "No se encontraron pacientes con ese término." |

#### 7.A.5 Restricciones `[APROBADO]`

- Solo pacientes autorizados para este médico son devueltos por el servidor.
- El administrador no accede a esta pantalla.
- No hay botón "Agregar paciente" para el médico (función exclusiva del admin).

#### 7.A.6 Componentes reutilizados `[REUTILIZADO]`

- `Card` (variant `default`) — ficha de paciente. `card.tsx`
- `Input` — campo de búsqueda. `input.tsx`
- `Button` (variants `ghost`, `outline`) — acciones de card. `button.tsx`
- Patrón estructural de `Sidebar` / `DefaultLayout` — referencia visual de página; los componentes administrativos existentes requieren adaptación para el contexto Médico y no se reutilizan directamente. `app/src/admin/layout/`

#### 7.A.7 Propuestas abiertas para Stitch `[PROPUESTA PARA STITCH]`

- ¿Grid de cards o tabla? (depende del número de pacientes por médico — sin dato confirmado).
- Información mínima por card: nombre, ID sintético, fecha de última nota — validar con médicos piloto.
- Orden por defecto: ¿alfabético? ¿última actividad? — pendiente de decisión.

---

### Pantalla B — Editor de Nota Clínica

#### 7.B.1 Objetivo `[APROBADO]`

Pantalla principal del flujo clínico. Permite al médico redactar el texto libre de la consulta, solicitar estructuración por IA, revisar/editar las 5 secciones y confirmar la nota. Cubre HU-02, HU-03, HU-04, HU-05, HU-07.

#### 7.B.2 Contenido y jerarquía `[APROBADO + PROPUESTA PARA STITCH]`

```
┌─ Contexto del paciente (sticky header) ───────────────────────┐
│  PAC-001 — García, Juan A.   |   [NoteStatusBadge]            │
│  Editor de Nota Clínica      |   Borrador manual               │
└───────────────────────────────────────────────────────────────┘

Zona 1 — Texto original del médico
┌───────────────────────────────────────────────────────────────┐
│  [Etiqueta] Texto original (preservado)   [Lock icon]         │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Textarea — originalText                                │  │
│  │  (editable solo en estado DRAFT_MANUAL, antes de IA)   │  │
│  └─────────────────────────────────────────────────────────┘  │
│  [Botón primary] Solicitar Estructuración IA                  │
└───────────────────────────────────────────────────────────────┘

[Estado: procesando IA → Progress bar + Loader2 + "Estructurando nota…"]

Zona 2 — Secciones (aparece tras estructuración IA o manualmente)
┌───────────────────────────────────────────────────────────────┐
│  [Accordion] 1. Motivo de consulta          [badge IA?]       │
│  [Accordion] 2. Nota clínica / evolución    [badge IA?]       │
│  [Accordion] 3. Examen físico               [badge IA?]       │
│  [Accordion] 4. Valoración clínica          [badge IA?]       │
│  [Accordion] 5. Plan / indicaciones         [badge IA?]       │
│                                                               │
│  [Checkbox] "No aplica" + [Input] Justificación (requerida)   │
└───────────────────────────────────────────────────────────────┘

┌── Footer de acciones ─────────────────────────────────────────┐
│  [Button outline] Guardar borrador   [Button primary] Confirmar Nota  │
└───────────────────────────────────────────────────────────────┘

[Estado CONFIRMED → todos los controles deshabilitados,
 badge CONFIRMED + Lock, botón "Crear Adenda"]
```

#### 7.B.3 Acciones `[APROBADO]`

- **Solicitar Estructuración IA** — requiere `originalText` no vacío. (RF-008, RF-009)
- **Editar secciones** — estado transiciona a `REVIEWED` si venía de `DRAFT_AI_ASSISTED`.
- **Marcar sección como "No aplica"** + ingresar justificación obligatoria. (RF-026, C-01)
- **Guardar borrador** — persiste estado actual sin confirmar.
- **Confirmar Nota** — abre `Dialog` de confirmación con resumen de validación RF-026. Si falla → mensaje descriptivo RF-027.
- **Crear Adenda** — solo visible cuando `status = CONFIRMED`. Abre nuevo editor de adenda.

#### 7.B.4 Validación antes de confirmación `[APROBADO]`

El `Dialog` de confirmación muestra:

- Nombre del paciente sintético.
- Texto original (íntegro, verificado visualmente).
- Autor y timestamp.
- Checklist de las 5 secciones con estado (completa / "No aplica" + justificación / vacía-bloqueante).
- Botón "Confirmar" habilitado solo si todas las validaciones RF-026 pasan.
- Mensaje descriptivo si alguna sección falla (RF-027).

#### 7.B.5 Estados del registro `[APROBADO]`

| Estado del registro | Controles |
|:---|:---|
| `DRAFT_MANUAL` | `originalText` editable, secciones editables, botón IA activo |
| `DRAFT_AI_ASSISTED` | `originalText` solo lectura (`Lock`), secciones editables, badge IA |
| `REVIEWED` | Igual que `DRAFT_AI_ASSISTED` pero badge `REVIEWED` |
| `CONFIRMED` | Todo solo lectura, badge `CONFIRMED + Lock`, botón "Crear Adenda" |

#### 7.B.6 Restricciones `[APROBADO]`

- `originalText` nunca modificable después de la primera creación de la nota.
- La IA no puede confirmar la nota; solo el médico puede hacerlo.
- Un registro `CONFIRMED` no presenta controles de edición bajo ninguna circunstancia.
- No se pueden omitir secciones sin "No aplica" + justificación.

#### 7.B.7 Componentes reutilizados `[REUTILIZADO]`

- `Accordion` — secciones clínicas. `accordion.tsx`
- `Textarea` — campo de texto libre. `textarea.tsx`
- `Dialog` — confirmación explícita. `dialog.tsx`
- `Progress` — progreso de IA. `progress.tsx`
- `Button` (variants: `default`, `outline`, `ghost`) — acciones. `button.tsx`
- `Checkbox` — "No aplica". `checkbox.tsx`
- `Input` — justificación "No aplica". `input.tsx`
- `Toast` — feedback de operaciones. `toast.tsx`
- `Alert` — alerta de timeout/error de IA inline. `alert.tsx`
- `Label` — etiquetas de campo. `label.tsx`

#### 7.B.8 Propuestas abiertas para Stitch `[PROPUESTA PARA STITCH]`

- ¿Accordion o tabs para las 5 secciones? Accordion permite ver múltiples secciones simultáneamente.
- ¿Cómo presentar `originalText` y secciones en mobile sin perder contexto? (Tab switcher propuesto en §6.3).
- Diferenciación visual precisa del texto IA vs. texto editado por el médico dentro de la sección.
- Tamaño y posición del badge "Asistido por IA" en cada sección.

---

### Pantalla C — Historial del Paciente + Epicrisis

#### 7.C.1 Objetivo `[APROBADO]`

Muestra el historial clínico completo de un paciente sintético autorizado: notas confirmadas, adendas y epicrisis. Permite al médico iniciar y gestionar el proceso de epicrisis. Cubre HU-03, HU-06.

#### 7.C.2 Contenido y jerarquía `[APROBADO + PROPUESTA PARA STITCH]`

```
┌─ Contexto del paciente ───────────────────────────────────────┐
│  PAC-001 — García, Juan A.   | [Botón] Generar Epicrisis      │
│  Historial Clínico           | [Botón] Nueva Nota             │
└───────────────────────────────────────────────────────────────┘

┌─ Timeline (cronológico, más reciente arriba) ──────────────────┐
│                                                               │
│  [dd/mm/yyyy — hh:mm]                                        │
│  ┌─ Card: Nota Clínica — CONFIRMED ────────────────────────┐  │
│  │  Motivo de consulta: ...                                 │  │
│  │  Autor: Dr. [fullName]  |  [Lock] Inmutable             │  │
│  │  [Ver detalle →]        |  [Crear Adenda]               │  │
│  └──────────────────────────────────────────────────────────┘  │
│    └─ [Adenda] 2026-07-15 — CONFIRMED ───────────────────── │  │
│         Razón: corrección de plan  [Ver →]                   │  │
│                                                               │
│  [dd/mm/yyyy]                                                │
│  ┌─ Card: Epicrisis — DRAFT_AI_ASSISTED ───────────────────┐  │
│  │  [badge Borrador IA]                                     │  │
│  │  [Botón] Revisar y confirmar epicrisis                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                               │
│  [dd/mm/yyyy]                                                │
│  ┌─ Card: Nota Clínica — CONFIRMED ────────────────────────┐  │
│  │  ...                                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

#### 7.C.3 Acciones `[APROBADO]`

- **Nueva Nota** → navega al Editor de Nota Clínica.
- **Generar Epicrisis** → dispara `generateEpicrisisDraft`. Requiere al menos una nota `CONFIRMED` (RF-016).
- **Ver detalle** de nota → Editor en modo solo lectura.
- **Crear Adenda** para nota `CONFIRMED` → abre Editor de Adenda.
- **Revisar y confirmar epicrisis** → abre Editor de Epicrisis.

#### 7.C.4 Representación de inmutabilidad `[APROBADO]`

- Notas y epicrisis con `status = CONFIRMED` muestran el icono `Lock` junto al badge.
- No existe botón "Editar" en registros confirmados.
- La cadena Nota Original → Adenda(s) se visualiza como elementos anidados bajo el registro padre.

#### 7.C.5 Estados `[APROBADO]`

| Estado | Representación |
|:---|:---|
| Cargando historial | Skeleton de cards |
| Historial vacío | Card con `FileText` + "Sin notas clínicas registradas. Crea la primera nota." |
| Sin epicrisis | Botón "Generar Epicrisis" visible si hay al menos una nota CONFIRMED |
| Epicrisis en borrador | Card con badge `DRAFT_AI_ASSISTED` + acción de revisión |
| Epicrisis confirmada | Card con badge `CONFIRMED + Lock`, solo lectura |
| Error al cargar | Toast destructivo + botón "Reintentar" |

#### 7.C.6 Restricciones `[APROBADO]`

- Solo notas del paciente autorizado para este médico.
- El médico no puede editar una nota o epicrisis `CONFIRMED`.
- `Generar Epicrisis` está deshabilitado si no existe ninguna nota `CONFIRMED`.
- La cadena de adendas preserva la versión original siempre visible.

#### 7.C.7 Componentes reutilizados `[REUTILIZADO]`

- `Card` (variants `default`, `faded` para elementos menos prioritarios) — registros del timeline. `card.tsx`
- `Button` (variants `default`, `outline`, `ghost`) — acciones. `button.tsx`
- `Separator` — separadores de timeline. `separator.tsx`
- `Toast` — feedback. `toast.tsx`

#### 7.C.8 Propuestas abiertas para Stitch `[PROPUESTA PARA STITCH]`

- Presentación del timeline: ¿línea vertical con nodos? ¿stack de cards con separadores de fecha?
- ¿Cómo representar visualmente la relación Nota Original ↔ Adenda(s) sin confundir al médico?
- Epicrisis: ¿panel lateral sobre el timeline o pantalla dedicada?
- Cuántos registros mostrar por defecto antes de paginar o colapsar.

---

## 8. Google Stitch Handoff

### Pantalla A — Lista/Búsqueda de Pacientes

| Aspecto | Detalle |
|:---|:---|
| **Objetivo** | Permitir al médico encontrar y seleccionar un paciente autorizado |
| **Usuario** | Médico (`isMedico = true`). Admin excluido. |
| **Contenido** | Lista de SyntheticPatient autorizados vía MedicoPatientAccess. Campo de búsqueda. |
| **Jerarquía** | H1 "Mis Pacientes" → Buscador → Grid/lista de Patient Cards |
| **Acciones** | Buscar (filtro en tiempo real o submit), Seleccionar paciente |
| **Estados** | Cargando, con datos, vacío (sin pacientes asignados), sin resultados de búsqueda, error |
| **Restricciones** | Solo pacientes del médico. Sin función de alta de paciente. |
| **Patrones reutilizados** | `Card`, `Input`, `Button`; patrón visual de `Sidebar` + `DefaultLayout` administrativo como referencia, con adaptación clínica obligatoria |
| **Propuestas abiertas** | Layout grid vs. tabla; información mínima por card; criterio de ordenamiento |

### Pantalla B — Editor de Nota Clínica

| Aspecto | Detalle |
|:---|:---|
| **Objetivo** | Capturar, estructurar, revisar y confirmar una nota clínica de forma asistida |
| **Usuario** | Médico (`isMedico = true`) autorizado para el paciente en pantalla |
| **Contenido** | Identidad del paciente, originalText (siempre), 5 secciones clínicas, validación, confirmación |
| **Jerarquía** | Contexto paciente (sticky) → originalText → Secciones → Acciones (footer) |
| **Acciones** | Solicitar IA, Editar secciones, Marcar "No aplica" + justificación, Guardar borrador, Confirmar Nota, Crear Adenda |
| **Estados** | DRAFT_MANUAL, DRAFT_AI_ASSISTED, REVIEWED, CONFIRMED (inmutable), procesando IA, error IA, timeout IA |
| **Restricciones** | IA nunca confirma. originalText siempre preservado. CONFIRMED → solo lectura absoluta. |
| **Patrones reutilizados** | `Accordion`, `Textarea`, `Dialog`, `Progress`, `Button`, `Checkbox`, `Alert`, `Toast`, `Label` |
| **Propuestas abiertas** | Accordion vs. tabs; diferenciación visual IA vs. médico en sección; layout mobile |

### Pantalla C — Historial del Paciente + Epicrisis

| Aspecto | Detalle |
|:---|:---|
| **Objetivo** | Ver historial cronológico completo y gestionar epicrisis |
| **Usuario** | Médico (`isMedico = true`) autorizado para el paciente |
| **Contenido** | Timeline de ClinicalNote (CONFIRMED) con adendas, Epicrisis (borrador/confirmada) |
| **Jerarquía** | Contexto paciente + acciones principales → Timeline descendente → Detalle de cada registro |
| **Acciones** | Nueva Nota, Generar Epicrisis, Ver detalle, Crear Adenda, Revisar/confirmar epicrisis |
| **Estados** | Cargando, historial con datos, historial vacío, epicrisis en borrador, epicrisis confirmada, error |
| **Restricciones** | Solo pacientes autorizados. CONFIRMED → solo lectura. Epicrisis requiere nota CONFIRMED previa. |
| **Patrones reutilizados** | `Card`, `Button`, `Separator`, `Toast` |
| **Propuestas abiertas** | Diseño visual del timeline; relación gráfica Original ↔ Adenda; paginación del historial |

---

## 9. Decisiones pendientes (no resolubles sin evidencia)

| Decisión | Razón de la pendencia |
|:---|:---|
| Paleta de color de DoctorIA | No existe identidad visual oficial en el repositorio |
| Tipografía corporativa | No está definida en el repositorio |
| Logo de DoctorIA | No existe en el repositorio |
| Orden por defecto en lista de pacientes | Sin datos de uso piloto |
| Grid vs. tabla en lista de pacientes | Depende del número típico de pacientes por médico — sin dato |
| Diseño visual del timeline | Decisión de diseño puro — abierta a Stitch |
| Representación gráfica Nota ↔ Adenda | Decisión de diseño puro — abierta a Stitch |
| Layout mobile del editor de nota | Requiere prueba de usabilidad |
| Posición del toast en mobile | Pendiente de validación |
| Número de registros por página | Sin definición en spec.md |

---

*Este documento fue generado durante la Fase 2 — Diseño. No debe modificarse durante la implementación sin aprobación del equipo. Los ítems `[PROPUESTA PARA STITCH]` son borradores visuales a validar en Google Stitch antes de iniciar `/speckit-tasks`.*
