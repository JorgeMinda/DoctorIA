# Operation Contracts: MVP DoctorIA

**Feature**: 001-doctoria-mvp
**Date**: 2026-08-08
**Phase**: 1 — Design
**Framework**: Wasp operations (queries + actions)
**Source**: [spec.md](../spec.md), [data-model.md](../data-model.md)

---

## Overview

All clinical operations follow the existing Wasp pattern:
- **Queries**: Read-only operations declared with `query()` in `.wasp.ts`
- **Actions**: Write operations declared with `action()` in `.wasp.ts`
- **Validation**: All inputs validated with Zod schemas via `ensureArgsSchemaOrThrowHttpError`
- **Auth**: All clinical operations invoke `ensureMedico(context)` which verifies: (1) `context.user` exists, (2) `context.user.isMedico === true`, (3) `context.user.isAdmin === false`. A user who is authenticated but not medically enabled receives 403.
- **Patient authorization**: All patient-scoped operations verify `MedicoPatientAccess` exists for the requesting physician and the target patient. If no access record exists, the operation returns 403 without revealing any clinical content.
- **Audit**: Write operations create an `AuditLog` entry

---

## 1. Patient Queries

### getPatients

Retrieves a paginated list of synthetic patients with search/filter capability.

| Property | Value |
|:---|:---|
| **Type** | Query |
| **Entities** | `SyntheticPatient`, `MedicoPatientAccess` |
| **Auth** | `ensureMedico(context)` — requires `isMedico === true` AND `isAdmin === false` |
| **Patient auth** | Results filtered via `MedicoPatientAccess WHERE medicoId = context.user.id` — only authorized patients returned |
| **Input** | `{ search?: string, page?: number, pageSize?: number }` |
| **Output** | `{ patients: SyntheticPatient[], totalPages: number }` |
| **Audit** | No (listing doesn't constitute "consulta de ficha") |
| **Performance** | P95 ≤ 2s (RNF-010) |

### getPatientById

Retrieves full patient profile with clinical history summary.

| Property | Value |
|:---|:---|
| **Type** | Query |
| **Entities** | `SyntheticPatient`, `ClinicalNote`, `Epicrisis`, `MedicoPatientAccess` |
| **Auth** | `ensureMedico(context)` |
| **Patient auth** | Verify `MedicoPatientAccess` exists for `(context.user.id, patientId)` — if not, return 403 without clinical data |
| **Input** | `{ patientId: string }` |
| **Output** | `{ patient: SyntheticPatient, noteCount: number, latestNotes: ClinicalNote[], epicrisisCount: number }` |
| **Audit** | Yes — `VIEW_PATIENT` |
| **Performance** | P95 ≤ 2s |

### getPatientHistory

Retrieves complete clinical note timeline for a patient.

| Property | Value |
|:---|:---|
| **Type** | Query |
| **Entities** | `ClinicalNote`, `MedicoPatientAccess` |
| **Auth** | `ensureMedico(context)` |
| **Patient auth** | Verify `MedicoPatientAccess` exists for `(context.user.id, patientId)` — if not, return 403 |
| **Input** | `{ patientId: string, includeAddenda?: boolean }` |
| **Output** | `ClinicalNote[]` (ordered by createdAt desc, with childNotes if requested) |
| **Performance** | P95 ≤ 2s |

---

## 2. Clinical Note Operations

### getClinicalNote

Retrieves a single clinical note with full content and version chain.

| Property | Value |
|:---|:---|
| **Type** | Query |
| **Entities** | `ClinicalNote`, `MedicoPatientAccess` |
| **Auth** | `ensureMedico(context)` |
| **Patient auth** | Resolve `patientId` from the note, then verify `MedicoPatientAccess` exists for `(context.user.id, note.patientId)` — if not, return 403 |
| **Input** | `{ noteId: string }` |
| **Output** | `ClinicalNote` (with parentNote and childNotes) |
| **Audit** | No (individual note reads don't trigger separate audit beyond VIEW_PATIENT) |

### createClinicalNote

Creates a new clinical note draft with the original text captured.

| Property | Value |
|:---|:---|
| **Type** | Action |
| **Entities** | `ClinicalNote`, `AuditLog`, `MedicoPatientAccess` |
| **Auth** | `ensureMedico(context)` |
| **Patient auth** | Verify `MedicoPatientAccess` exists for `(context.user.id, patientId)` — if not, return 403 |
| **Input** | `{ patientId: string, originalText: string }` |
| **Output** | `ClinicalNote` (status: `DRAFT_MANUAL`) |
| **Audit** | Yes — `CREATE_NOTE` |
| **Validations** | `patientId` must exist; `originalText` must not be empty |

### updateClinicalNoteDraft

Updates structured sections of a draft note. Blocked if note is `CONFIRMED`.

| Property | Value |
|:---|:---|
| **Type** | Action |
| **Entities** | `ClinicalNote`, `AuditLog`, `MedicoPatientAccess` |
| **Auth** | `ensureMedico(context)`; must be note author |
| **Patient auth** | Resolve `patientId` from the note, then verify `MedicoPatientAccess` exists for `(context.user.id, note.patientId)` |
| **Input** | `{ noteId: string, motivoConsulta?: string, notaClinica?: string, examenFisico?: string, valoracionClinica?: string, planIndicaciones?: string, sectionsNotApplicable?: Record<string, string> }` |
| **Output** | `ClinicalNote` (status transitions to `REVIEWED` if previously `DRAFT_AI_ASSISTED`) |
| **Audit** | Yes — `EDIT_DRAFT` |
| **Validations** | Note must not be `CONFIRMED`; `originalText` is NEVER modifiable via this operation |

### requestAIStructuring

Sends original text to the AI service for structuring into 5 sections. Returns the structured result without auto-confirming.

| Property | Value |
|:---|:---|
| **Type** | Action |
| **Entities** | `ClinicalNote`, `AuditLog`, `MedicoPatientAccess` |
| **Auth** | `ensureMedico(context)`; must be note author |
| **Patient auth** | Resolve `patientId` from the note, then verify `MedicoPatientAccess` |
| **Input** | `{ noteId: string }` |
| **Output** | `ClinicalNote` (status: `DRAFT_AI_ASSISTED`, sections populated, `aiAssisted: true`) |
| **Audit** | Yes — `REQUEST_AI_STRUCTURING` |
| **Timeout** | 30s non-blocking. Client shows progress indicator after 2s (RNF-011) |
| **Error handling** | On timeout/failure: note remains in `DRAFT_MANUAL`, client shows non-blocking alert, manual continuation permitted (RNF-008) |
| **Validations** | Note must be in `DRAFT_MANUAL` state; `originalText` must not be empty |

### confirmClinicalNote

Confirms a clinical note after explicit physician review. Applies RF-026 validation.

| Property | Value |
|:---|:---|
| **Type** | Action |
| **Entities** | `ClinicalNote`, `AuditLog`, `MedicoPatientAccess` |
| **Auth** | `ensureMedico(context)` |
| **Patient auth** | Resolve `patientId` from the note, then verify `MedicoPatientAccess` |
| **Input** | `{ noteId: string }` |
| **Output** | `ClinicalNote` (status: `CONFIRMED`, `confirmedById` and `confirmedAt` set) |
| **Audit** | Yes — `CONFIRM_NOTE` |
| **Validations** | RF-026 cumulative check: (1) patient selected, (2) originalText preserved, (3) author identified, (4) timestamp recorded, (5) all 5 sections completed or explicitly marked "No aplica" with justification. RF-027: block with descriptive message if any section fails validation. |

### createNoteAddendum

Creates an addendum for a confirmed note. The original note remains immutable.

| Property | Value |
|:---|:---|
| **Type** | Action |
| **Entities** | `ClinicalNote`, `AuditLog`, `MedicoPatientAccess` |
| **Auth** | `ensureMedico(context)` |
| **Patient auth** | Resolve `patientId` from the parent note, then verify `MedicoPatientAccess` |
| **Input** | `{ parentNoteId: string, originalText: string, addendumReason: string }` |
| **Output** | `ClinicalNote` (noteType: `ADDENDUM`, status: `DRAFT_MANUAL`) |
| **Audit** | Yes — `CREATE_ADDENDUM` |
| **Validations** | Parent note must exist and be `CONFIRMED`; `addendumReason` must not be empty (RF-029) |

---

## 3. Epicrisis Operations

### getEpicrisis

Retrieves a specific epicrisis with version chain.

| Property | Value |
|:---|:---|
| **Type** | Query |
| **Entities** | `Epicrisis`, `MedicoPatientAccess` |
| **Auth** | `ensureMedico(context)` |
| **Patient auth** | Resolve `patientId` from the epicrisis, then verify `MedicoPatientAccess` |
| **Input** | `{ epicrisisId: string }` |
| **Output** | `Epicrisis` (with parentEpicrisis and childEpicrises) |

### generateEpicrisisDraft

Generates an epicrisis draft from a patient's confirmed clinical history using AI.

| Property | Value |
|:---|:---|
| **Type** | Action |
| **Entities** | `ClinicalNote`, `Epicrisis`, `AuditLog`, `MedicoPatientAccess` |
| **Auth** | `ensureMedico(context)` |
| **Patient auth** | Verify `MedicoPatientAccess` exists for `(context.user.id, patientId)` |
| **Input** | `{ patientId: string }` |
| **Output** | `Epicrisis` (status: `DRAFT_AI_ASSISTED`, 10 elements populated) |
| **Audit** | Yes — `GENERATE_EPICRISIS` |
| **Timeout** | 30s non-blocking, same as AI structuring |
| **Validations** | Patient must have at least one `CONFIRMED` note |

### updateEpicrisisDraft

Updates epicrisis draft fields. Blocked if epicrisis is `CONFIRMED`.

| Property | Value |
|:---|:---|
| **Type** | Action |
| **Entities** | `Epicrisis`, `AuditLog`, `MedicoPatientAccess` |
| **Auth** | `ensureMedico(context)`; must be epicrisis author |
| **Patient auth** | Resolve `patientId` from the epicrisis, then verify `MedicoPatientAccess` |
| **Input** | `{ epicrisisId: string, [fields for any of the 10 elements] }` |
| **Output** | `Epicrisis` (status transitions to `REVIEWED` if modified) |
| **Audit** | Yes — `REVIEW_EPICRISIS` |

### confirmEpicrisis

Confirms an epicrisis after physician review.

| Property | Value |
|:---|:---|
| **Type** | Action |
| **Entities** | `Epicrisis`, `AuditLog`, `MedicoPatientAccess` |
| **Auth** | `ensureMedico(context)` |
| **Patient auth** | Resolve `patientId` from the epicrisis, then verify `MedicoPatientAccess` |
| **Input** | `{ epicrisisId: string }` |
| **Output** | `Epicrisis` (status: `CONFIRMED`) |
| **Audit** | Yes — `CONFIRM_EPICRISIS` |
| **Validations** | All 10 minimum elements must be populated; status must be `DRAFT_AI_ASSISTED` or `REVIEWED` |

### createEpicrisisAddendum

Creates an addendum for a confirmed epicrisis. Same pattern as note addendum.

| Property | Value |
|:---|:---|
| **Type** | Action |
| **Entities** | `Epicrisis`, `AuditLog`, `MedicoPatientAccess` |
| **Auth** | `ensureMedico(context)` |
| **Patient auth** | Resolve `patientId` from the parent epicrisis, then verify `MedicoPatientAccess` |
| **Input** | `{ parentEpicrisisId: string, addendumReason: string, [10 element fields] }` |
| **Output** | `Epicrisis` (noteType: `ADDENDUM`, status: `DRAFT_AI_ASSISTED`) |
| **Audit** | Yes — `CREATE_ADDENDUM` |

---

## 4. Audit Query

### getAuditLog

Retrieves audit entries. Scoped by role: physicians see their own clinical audit; admins see administrative audit.

| Property | Value |
|:---|:---|
| **Type** | Query |
| **Entities** | `AuditLog` |
| **Auth** | Required — Both roles, scoped differently |
| **Input** | `{ page?: number, resourceType?: string, dateFrom?: string, dateTo?: string }` |
| **Output** | `{ entries: AuditLog[], totalPages: number }` |
| **Role scoping** | Médico (`isMedico`): `WHERE userId = context.user.id AND resourceType IN ('PATIENT', 'NOTE', 'EPICRISIS')`. Administrador (`isAdmin`): `WHERE resourceType IN ('USER', 'SYSTEM')` |

---

## 5. Admin Clinical Operations

### manageSyntheticPatients

CRUD operations for synthetic patient data (Administrador only).

| Property | Value |
|:---|:---|
| **Type** | Action |
| **Entities** | `SyntheticPatient`, `AuditLog` |
| **Auth** | `ensureAdmin(context)` — requires `isAdmin === true` |
| **Input** | `{ action: 'CREATE' | 'UPDATE' | 'DELETE', data: Partial<SyntheticPatient>, patientId?: string }` |
| **Output** | `SyntheticPatient` |
| **Audit** | Yes — `ADMIN_MANAGE_DATA` |
| **Validations** | `syntheticId` must be unique; cannot delete a patient with confirmed notes |

### manageMedicoPatientAccess

Grants or revokes a physician's authorization to access a synthetic patient.

| Property | Value |
|:---|:---|
| **Type** | Action |
| **Entities** | `MedicoPatientAccess`, `AuditLog`, `User`, `SyntheticPatient` |
| **Auth** | `ensureAdmin(context)` — requires `isAdmin === true` |
| **Input** | `{ action: 'GRANT' | 'REVOKE', medicoId: string, patientId: string }` |
| **Output** | `MedicoPatientAccess` (on GRANT) or `{ success: true }` (on REVOKE) |
| **Audit** | Yes — `ADMIN_MANAGE_DATA` with metadata `{ accessAction: 'GRANT' | 'REVOKE' }` |
| **Validations** | `medicoId` must reference a user with `isMedico === true`; `patientId` must exist; GRANT must not duplicate existing access; REVOKE requires an existing access record |

---

## 6. AI Service Contract (Internal)

This is NOT a Wasp operation but an internal service function called by `requestAIStructuring` and `generateEpicrisisDraft`.

### structureClinicalText

```typescript
// Input
interface AIStructuringInput {
  text: string;           // Raw clinical text
  mode: 'NOTE' | 'EPICRISIS';
}

// Output
interface AIStructuringOutput {
  sections: {
    motivoConsulta: string | null;
    notaClinica: string | null;
    examenFisico: string | null;
    valoracionClinica: string | null;
    planIndicaciones: string | null;
  };
  unclassifiedContent: string | null;  // Content that couldn't be classified
  originalTextPreserved: boolean;      // Must always be true
  confidence: number;                  // 0-1 overall confidence
}

// Epicrisis output
interface AIEpicrisisOutput {
  elements: {
    reasonForAdmission: string | null;
    relevantHistory: string | null;
    evolutionSummary: string | null;
    proceduresResults: string | null;
    validatedDiagnoses: string | null;
    conditionAtDischarge: string | null;
    followUpInstructions: string | null;
  };
  unclassifiedContent: string | null;
}

// Error states
type AIServiceError =
  | { type: 'TIMEOUT'; message: string }      // 30s exceeded
  | { type: 'UNAVAILABLE'; message: string }   // Service down
  | { type: 'PARSE_ERROR'; message: string };  // Response unparseable
```

**Implementation note**: During development, a mock implementation returns deterministic structured results. The real provider implementation replaces the mock when the AI provider decision (PD-01) is formally approved.

---

## 7. Error Handling Convention

All operations follow this error pattern (consistent with existing `HttpError` usage):

| HTTP Status | Meaning | When |
|:---|:---|:---|
| `400` | Bad Request | Zod validation failure |
| `401` | Unauthorized | `context.user` is null |
| `403` | Forbidden | Wrong role (`isAdmin` on clinical op, or `!isMedico` on clinical op), OR patient not authorized for this physician via `MedicoPatientAccess`. Response MUST NOT reveal any clinical content. |
| `404` | Not Found | Resource doesn't exist (also used when a resource exists but physician is not authorized, to avoid information leakage) |
| `409` | Conflict | Invalid state transition (e.g., confirming already confirmed) |
| `422` | Unprocessable | RF-026/RF-027 validation failure (sections incomplete) |
| `504` | Gateway Timeout | AI service timeout (30s) |
