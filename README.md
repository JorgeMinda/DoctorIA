# DoctorIA — Asistente de IA para Historias Clínicas (CDSS Asistivo)

> **Capa de IA asistiva sobre historiales clínicos digitales (CDSS informativo).**
> NO es un EHR, NO decide clínicamente y NO reemplaza el criterio médico. La IA es EXCLUSIVAMENTE asistiva: organiza texto, jamás decide (Human-in-the-Loop estricto).

---

## 1. Descripción del Proyecto

DoctorIA es una plataforma web médica diseñada bajo estándares de gobernanza y seguridad clínica en español. Permite al profesional de salud dictar o redactar texto clínico libre, y la IA estructura la información en secciones formales (Formulario 002 MSP, notas clínicas y epicrisis).

### Principios Fundamentales (Constitución P1–P10)
- **Human-in-the-Loop siempre (P4):** La IA estructura borradores; el médico revisa, corrige y confirma expresamente. Nada se consolida sin autorización médica.
- **Texto original intacto (RNF-004):** `ClinicalNote.originalText` jamás se modifica ni se trunca. Las notas estructuradas son representaciones derivadas.
- **Inmutabilidad clínica:** Estados `DRAFT_MANUAL → DRAFT_AI_ASSISTED → REVIEWED → CONFIRMED`. Una vez en estado `CONFIRMED`, la nota es estrictamente inmutable; cualquier corrección posterior se efectúa mediante adenda referenciada (`parentNoteId` + `addendumReason`).
- **Roles mutuamente excluyentes:** `Médico`, `Secretaría`, `Paciente` y `Administrador`.
- **Protección de Datos Clínicos (P5):** Cero PII en logs y repositorios. Auditoría funcional (`AuditLog`) disociada de datos clínicos sensibles.
- **Autorización por Paciente (R-10):** Toda consulta o acción sobre un paciente valida `MedicoPatientAccess` a nivel de servidor con respuesta 404 unificada (sin filtrar existencia de expedientes).

---

## 2. Stack Tecnológico

- **Framework Full-Stack:** [Wasp 0.25](https://wasp.sh) (Node.js ≥ 24, TypeScript 6.0)
- **Frontend:** React 19, Tailwind CSS v4, Radix UI, Lucide Icons, Vite
- **Backend:** Express (orquestado por Wasp), Prisma 5.19, PostgreSQL
- **IA / NLP:** OpenRouter (`openai/gpt-oss-20b:free` en demo / modelo configurable en producción), soporte para OpenJarvis / LLM local
- **Testing:** Vitest 4.1.x (359 pruebas unitarias e integradas en 30 suites), Playwright (E2E)
- **Infraestructura & Despliegue:** Render (`render.yaml`), PostgreSQL administrado, CDN / SSL automatizado

---

## 3. Arquitectura y Módulos del Sistema

```
app/
├── main.wasp.ts               # Manifiesto principal Wasp (rutas, auth, operaciones, seeds)
├── schema.prisma              # Modelo de datos relacional (User, SyntheticPatient, ClinicalNote, Cita, AuditLog, etc.)
├── src/
│   ├── auth/                  # Autenticación email/contraseña, verificación y layout temático
│   ├── clinical/              # MÓDULO CLÍNICO CORE
│   │   ├── clinical.wasp.ts   # Declaración de operaciones y rutas clínicas
│   │   ├── actions.ts         # Operaciones mutables (notas, epicrisis, citas, adendas)
│   │   ├── queries.ts         # Consultas clínicas con control de acceso
│   │   ├── services/          # Guards RBAC, auditoría disociada, acceso médico-paciente, IA
│   │   └── pages/             # Pacientes, Ficha clínica, Notas, Epicrisis, Agenda, Auditoría
│   ├── patient/               # PORTAL DEL PACIENTE
│   │   ├── patient.wasp.ts    # Declaración de rutas y operaciones públicas y de paciente
│   │   ├── pages/             # Directorio de especialistas, solicitud de citas, vinculación de cédula
│   │   └── queries.ts         # Directorio público y consultas seguras
│   ├── server/                # SEGURIDAD Y CONFIGURACIÓN SERVER
│   │   ├── serverMiddleware.ts          # Trust proxy exacto, CORS estricto con lista blanca cerrada y Vary: Origin
│   │   ├── publicDirectoryRateLimiter.ts # Rate limiting (60 req/min) con LRU, IP real por CF-Connecting-IP / Express
│   │   └── scripts/dbSeeds.ts           # Semillas sintéticas protegidas (bloqueadas en producción)
│   └── shared/                # Validación de cédula (Ecuador / CI), helpers de fechas y formato
```

---

## 4. Seguridad, Red y Despliegue

### Rate Limiting y Anti-Falsificación de IP
- **Proxy de confianza:** Configurado con saltos exactos (`trust proxy = 1` en Render tras Cloudflare), priorizando `CF-Connecting-IP` cuando está presente.
- **Protección contra falsificación:** Prohibida la lectura ingenua de `X-Forwarded-For`.
- **Agrupación IPv6:** Las direcciones IPv6 se canonizan y agrupan por subred `/64` para neutralizar ataques de rotación de direcciones.
- **CORS Estricto:** Lista blanca explícita de dominios (`doctoria.linkear.net`, `doctoria-client.onrender.com`, `doctoria-server.onrender.com`), con rechazo tajante de comodines o orígenes derivados, y cabecera obligatoria `Vary: Origin`.

### Despliegue Seguro en Render
- **Migraciones estrictas:** El `startCommand` ejecuta `npm run db-migrate-prod` (`prisma migrate deploy`) deteniendo el despliegue si existe algún error de migración.
- **Eliminación de `db push`:** No se permite `prisma db push` en producción, garantizando la preservación de índices SQL nativos y la integridad del historial de esquema.
- **Protección de Semillas (P5):** Las semillas sintéticas de prueba (`seedSyntheticClinicalData`) requieren la bandera `RUN_SYNTHETIC_SEED="true"` y están bloqueadas en `NODE_ENV=production` salvo anulación explícita.

---

## 5. Roles y Acceso a la Plataforma

| Rol | Descripción | Acceso Inicial |
|:---|:---|:---|
| **Administrador** (`isAdmin: true`) | Gobernanza, auditoría, gestión de usuarios y aprobación de solicitudes | Asignado por configuración de sistema |
| **Médico** (`isMedico: true`) | Consulta externa, dictado por voz, estructuración asistida, confirmación de notas | Habilitado por administración |
| **Secretaría** (`isSecretaria: true`) | Gestión de agenda, citas médicas y recepción | Habilitado por administración |
| **Paciente** (`isPaciente: true`) | Consulta de citas, visualización de historial y agendamiento | Requiere vinculación de cédula aprobada por administración |
| **Sin Rol / Nuevo Registro** | Acceso a `/pending-activation` con opción de solicitar vinculación de cédula en `/patient/link` | Estado por defecto al registrarse |

---

## 6. Comandos de Desarrollo y Verificación

```bash
# Instalar dependencias
cd app
npm install

# Verificación de tipos TypeScript
npx tsc --noEmit

# Ejecución de la suite completa de pruebas unitarias e integradas (359 tests)
npx vitest run

# Ejecutar pruebas en modo observador
npx vitest
```

---

## 7. Licencia y Confidencialidad

Propiedad del proyecto DoctorIA. Todos los derechos reservados. Desarrollado bajo estándares éticos de asistencia médica con inteligencia artificial.
