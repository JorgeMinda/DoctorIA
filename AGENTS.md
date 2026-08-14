# DoctorIA — Reglas de comportamiento para agentes IA

Capa de IA asistiva sobre historiales clínicos digitales (CDSS informativo). NO es un EHR, NO decide clínicamente y NO reemplaza el criterio médico. La IA es EXCLUSIVAMENTE asistiva: organiza texto, nunca decide.

> **Estado mutable del proyecto** (staging, QA, decisiones pendientes, avance de semanas): ver [CONTEXT.md](CONTEXT.md). Este archivo solo contiene reglas de comportamiento casi-estáticas.

## Documentación

### Spec Kit (fuente autoritativa)

Este proyecto es un Spec Kit con gobernanza. Verifica SIEMPRE contra la documentación del repo antes de implementar:

- `specs/001-doctoria-mvp/spec.md` — 29 requisitos funcionales (RF) + 13 no funcionales (RNF) + 7 historias de usuario.
- `specs/001-doctoria-mvp/data-model.md` — modelo de datos (User, SyntheticPatient, MedicoPatientAccess, ClinicalNote, Epicrisis, AuditLog).
- `specs/001-doctoria-mvp/contracts/clinical-operations.md` — 17 operaciones clínicas (queries/actions).
- `specs/001-doctoria-mvp/plan.md` — plan de trabajo.
- `specs/001-doctoria-mvp/quickstart.md` — 10 escenarios E2E.
- `specs/001-doctoria-mvp/tasks.md` — registro de tareas ejecutadas (T001–T029, Semanas 3–4).
- `specs/001-doctoria-mvp/checklists/production.md` — checklist de producción.
- `specs/001-doctoria-mvp/qa/week4-qa-report.md` — reporte de QA.
- `.specify/memory/constitution.md` — 10 principios del proyecto (v1.0.0).

### Wasp

Proyecto construido sobre Wasp 0.25 (template Open SaaS). Verifica contra la doc de Wasp: [LLMs.txt index](https://wasp.sh/llms.txt). No inventes APIs de Wasp — consulta la doc.

## Reglas de dominio (NO negociables)

1. **Human-in-the-loop siempre** — la IA estructura, el médico revisa y confirma. Nada se consolida sin confirmación expresa del médico.
2. **Original intacto (RNF-004)** — `ClinicalNote.originalText` NUNCA se modifica. Las secciones estructuradas son derivadas.
3. **Estados inmutables** — `DRAFT_MANUAL → DRAFT_AI_ASSISTED → REVIEWED → CONFIRMED`. Confirmada = inmutable; corrección SOLO por adenda (`parentNoteId` + `addendumReason`).
4. **Roles excluyentes** — `isAdmin=true` + `isMedico=true` es INVÁLIDO (bloqueado por guards en `app/src/clinical/services/guards.ts`).
5. **Datos sintéticos (P5)** — CERO PII real. Solo pacientes ficticios `PAC-NNN`.
6. **Auditoría sin contenido clínico (RNF-002)** — `AuditLog` guarda acciones/estados/metadata, jamás texto clínico.
7. **Autorización por paciente (R-10)** — toda operación patient-scoped verifica `MedicoPatientAccess` en servidor (`assertMedicoPatientAccess`).
8. **Sin pagos ni integraciones externas** — fuera de alcance del MVP (Ingequimed/DataWallet/CheckUp+/facturación).

## Arquitectura

- Módulo clínico en `app/src/clinical/` (declarado en `app/src/clinical/clinical.wasp.ts`): servicios (`services/`), queries (`queries.ts`), actions (`actions.ts`), páginas (`pages/`).
- Las operations de Wasp se declaran en archivos `*.wasp.ts` por feature y se importan con `with { type: "ref" }`.
- Validación de args con `ensureArgsSchemaOrThrowHttpError` (`app/src/server/validation.ts`).
- IA: `app/src/clinical/services/aiService.ts` — contrato tipado desacoplado del proveedor; mock determinista en desarrollo (decisión PD-01 pendiente).
- Seed: `app/src/server/scripts/dbSeeds.ts` (`seedSyntheticClinicalData`, `wasp db seed`).
- Deploy: blueprint `render.yaml` (raíz del repo) → Render deploya la rama `main`.
- No agregar comentarios salvo que aporten valor. Seguir el estilo del proyecto.
