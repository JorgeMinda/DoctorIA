# Data Model: MVP DoctorIA

**Feature**: 001-doctoria-mvp
**Date**: 2026-08-08
**Phase**: 1 — Design
**Source**: [spec.md](spec.md), research decisions R-02, R-04, R-10

---

## 1. Existing Entities (Modifications Required)

### User (existing — extend, don't replace)

The current `User` model in `schema.prisma` includes: `id`, `createdAt`, `email`, `username`, `isAdmin`, payment fields, and relations to `GptResponse`, `Task`, `File`, `ContactFormMessage`.

**Fields to add**:

| Field | Type | Default | Purpose |
|:---|:---|:---|:---|
| `isMedico` | `Boolean` | `false` | Explicit medical professional enablement (R-02) |
| `fullName` | `String?` | — | Display name for clinical records (RF-019: "profesional responsable") |
| `specialty` | `String?` | — | Medical specialty for identification (spec entity: ProfesionalMédico) |

**Relations to add**:

| Relation | Target | Type | Purpose |
|:---|:---|:---|:---|
| `authoredNotes` | `ClinicalNote` | 1:N | Notes authored by this user |
| `confirmedNotes` | `ClinicalNote` | 1:N | Notes confirmed by this user |
| `authoredEpicrises` | `Epicrisis` | 1:N | Epicrisis documents authored |
| `confirmedEpicrises` | `Epicrisis` | 1:N | Epicrisis documents confirmed |
| `auditLogs` | `AuditLog` | 1:N | All audit entries for this user |
| `authorizedPatients` | `MedicoPatientAccess` | 1:N | Patients this médico is authorized to access (R-10) |
| `grantedAccesses` | `MedicoPatientAccess` | 1:N | Patient accesses granted by this admin |

**Role identification** (via `isAdmin` + `isMedico`, per research R-02):

Open SaaS signup is public (`SignupRoute` enabled). `User.isAdmin` defaults to `false` and `isMedico` defaults to `false`. Therefore, `!isAdmin` alone does NOT imply a medical professional — only that the user is not an administrator.

| `isAdmin` | `isMedico` | Estado funcional DoctorIA |
|:---|:---|:---|
| `false` | `false` | Usuario autenticado sin acceso funcional al módulo clínico |
| `false` | `true` | Médico — operaciones clínicas sobre pacientes autorizados |
| `true` | `false` | Administrador — gestión de cuentas, roles, datos sintéticos |
| `true` | `true` | Inválido — bloqueado por guards; roles mutuamente excluyentes |

A newly registered user has NO clinical access until an administrator explicitly enables `isMedico = true`.

**Existing payment/SaaS fields** (`paymentProcessorUserId`, `subscriptionStatus`, `subscriptionPlan`, `datePaid`, `credits`, `lemonSqueezyCustomerPortalUrl`) remain untouched. They are not part of the clinical domain.

---

## 2. New Entities

### SyntheticPatient

Represents a fictitious patient record used exclusively for development, testing, and demonstration.

| Field | Type | Constraints | Purpose |
|:---|:---|:---|:---|
| `id` | `String` | `@id @default(uuid())` | Primary key |
| `createdAt` | `DateTime` | `@default(now())` | Record creation timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | Last modification timestamp |
| `syntheticId` | `String` | `@unique` | Human-readable ID (e.g., "PAC-001") |
| `firstName` | `String` | required | Synthetic first name |
| `lastName` | `String` | required | Synthetic last name |
| `birthDate` | `DateTime` | required | Synthetic date of birth |
| `sex` | `String` | required | "M", "F", or "O" |
| `medicalHistory` | `String?` | — | Synthetic background (free text) |
| `allergies` | `String?` | — | Synthetic known allergies (free text) |

**Relations**:
- `clinicalNotes: ClinicalNote[]` — all clinical notes for this patient
- `epicrises: Epicrisis[]` — all epicrisis documents for this patient
- `authorizedMedicos: MedicoPatientAccess[]` — physicians authorized to access this patient (R-10)
- `auditLogs: AuditLog[]` — audit entries referencing this patient

**Validation rules**:
- `syntheticId` must be unique and follow format `PAC-NNN`
- All demographic data must be clearly synthetic per Constitution P5

---

### MedicoPatientAccess

Explicit many-to-many authorization table between physicians and synthetic patients (research R-10). Every patient-scoped operation must verify authorization through this table at the server level.

| Field | Type | Constraints | Purpose |
|:---|:---|:---|:---|
| `id` | `String` | `@id @default(uuid())` | Primary key |
| `medicoId` | `String` | FK → `User` | The authorized physician |
| `patientId` | `String` | FK → `SyntheticPatient` | The patient they may access |
| `grantedAt` | `DateTime` | `@default(now())` | When access was granted |
| `grantedById` | `String` | FK → `User` | Administrator who granted access |

**Unique constraint**: `@@unique([medicoId, patientId])` — prevents duplicate assignments.

**Relations**:
- `medico: User` (relation "MedicoAccess") — the authorized physician
- `patient: SyntheticPatient` — the patient
- `grantedBy: User` (relation "AccessGranter") — the administrator who assigned access

**Validation rules**:
- `medicoId` must reference a User with `isMedico = true`
- `grantedById` must reference a User with `isAdmin = true`
- A physician cannot be granted access to a patient they already have access to
- Revoking access (deleting the record) must be audited

---

### ClinicalNote

Represents a clinical note created by a medical professional for a synthetic patient. Supports immutability via self-referencing addenda.

| Field | Type | Constraints | Purpose |
|:---|:---|:---|:---|
| `id` | `String` | `@id @default(uuid())` | Primary key |
| `createdAt` | `DateTime` | `@default(now())` | Record creation timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | Last modification timestamp |
| `patientId` | `String` | FK → `SyntheticPatient` | Target patient |
| `authorId` | `String` | FK → `User` | Creating physician |
| `confirmedById` | `String?` | FK → `User` | Confirming physician (set on confirmation) |
| `confirmedAt` | `DateTime?` | — | Confirmation timestamp |
| `originalText` | `String` | required | **Always preserved, never modified** (RNF-004) |
| `motivoConsulta` | `String?` | — | Section 1: Motivo de consulta |
| `notaClinica` | `String?` | — | Section 2: Nota clínica / evolución |
| `examenFisico` | `String?` | — | Section 3: Examen físico |
| `valoracionClinica` | `String?` | — | Section 4: Valoración clínica |
| `planIndicaciones` | `String?` | — | Section 5: Plan / indicaciones |
| `sectionsNotApplicable` | `Json?` | — | Sections marked "No aplica" with justification |
| `aiAssisted` | `Boolean` | `@default(false)` | Whether AI was used for structuring |
| `aiRawResponse` | `String?` | — | Raw AI response (for audit/debugging, NOT clinical) |
| `unclassifiedContent` | `String?` | — | Content AI couldn't classify ("Requiere revisión") |
| `status` | `String` | `@default("DRAFT_MANUAL")` | Current state (see State Machine below) |
| `noteType` | `String` | `@default("ORIGINAL")` | `ORIGINAL` or `ADDENDUM` |
| `parentNoteId` | `String?` | FK → self | Parent note (for addenda only) |
| `addendumReason` | `String?` | — | Required when `noteType = ADDENDUM` |

**Relations**:
- `patient: SyntheticPatient` — the patient this note belongs to
- `author: User` — the physician who created the note (relation "NoteAuthor")
- `confirmedBy: User?` — the physician who confirmed (relation "NoteConfirmer")
- `parentNote: ClinicalNote?` — the parent note (self-relation "NoteVersions")
- `childNotes: ClinicalNote[]` — addenda to this note (self-relation "NoteVersions")
- `auditLogs: AuditLog[]` — audit entries referencing this note

**Validation rules**:
- `originalText` must never be empty and must never be modified after creation.
- For confirmation (RF-026): patient selected, originalText preserved, author identified, timestamp recorded, all 5 sections completed or marked "No aplica" with justification.
- When `noteType = 'ADDENDUM'`: `parentNoteId` and `addendumReason` are required.
- When `status = 'CONFIRMED'`: no further UPDATE permitted at application level.

---

### Epicrisis

Represents a clinical summary/epicrisis generated from a synthetic patient's history. Same immutability pattern as ClinicalNote.

| Field | Type | Constraints | Purpose |
|:---|:---|:---|:---|
| `id` | `String` | `@id @default(uuid())` | Primary key |
| `createdAt` | `DateTime` | `@default(now())` | Record creation timestamp |
| `updatedAt` | `DateTime` | `@updatedAt` | Last modification timestamp |
| `patientId` | `String` | FK → `SyntheticPatient` | Target patient |
| `authorId` | `String` | FK → `User` | Creating physician |
| `confirmedById` | `String?` | FK → `User` | Confirming physician |
| `confirmedAt` | `DateTime?` | — | Confirmation timestamp |
| `patientIdentification` | `String` | required | Element 1 of 10 |
| `reasonForAdmission` | `String?` | — | Element 2 of 10 |
| `relevantHistory` | `String?` | — | Element 3 of 10 |
| `evolutionSummary` | `String?` | — | Element 4 of 10 |
| `proceduresResults` | `String?` | — | Element 5 of 10 |
| `validatedDiagnoses` | `String?` | — | Element 6 of 10 |
| `conditionAtDischarge` | `String?` | — | Element 7 of 10 |
| `followUpInstructions` | `String?` | — | Element 8 of 10 |
| `responsibleProfessional` | `String` | required | Element 9 of 10 |
| `dateTime` | `DateTime` | required | Element 10 of 10 |
| `aiAssisted` | `Boolean` | `@default(false)` | Whether AI generated the initial draft |
| `status` | `String` | `@default("DRAFT_AI_ASSISTED")` | Current state |
| `noteType` | `String` | `@default("ORIGINAL")` | `ORIGINAL` or `ADDENDUM` |
| `parentEpicrisisId` | `String?` | FK → self | Parent epicrisis (for addenda) |
| `addendumReason` | `String?` | — | Required when `noteType = ADDENDUM` |

**Relations**:
- `patient: SyntheticPatient`
- `author: User` (relation "EpicrisisAuthor")
- `confirmedBy: User?` (relation "EpicrisisConfirmer")
- `parentEpicrisis: Epicrisis?` (self-relation "EpicrisisVersions")
- `childEpicrises: Epicrisis[]` (self-relation "EpicrisisVersions")
- `auditLogs: AuditLog[]`

---

### AuditLog

Records clinical and administrative events for functional traceability (RF-019, RF-020, RNF-007). Contains **zero clinical content** — only references, actions, and non-clinical metadata.

| Field | Type | Constraints | Purpose |
|:---|:---|:---|:---|
| `id` | `String` | `@id @default(uuid())` | Primary key |
| `createdAt` | `DateTime` | `@default(now())` | Event timestamp |
| `userId` | `String` | FK → `User` | Who performed the action |
| `action` | `String` | required | Action type (see Audit Actions below) |
| `resourceType` | `String` | required | `PATIENT`, `NOTE`, `EPICRISIS`, `USER`, `SYSTEM` |
| `resourceId` | `String?` | — | ID of the affected resource |
| `metadata` | `Json?` | — | Non-clinical metadata (e.g., state transitions) |
| `patientId` | `String?` | FK → `SyntheticPatient` | Optional patient reference |
| `clinicalNoteId` | `String?` | FK → `ClinicalNote` | Optional note reference |
| `epicrisisId` | `String?` | FK → `Epicrisis` | Optional epicrisis reference |

**Relations**:
- `user: User`
- `patient: SyntheticPatient?`
- `clinicalNote: ClinicalNote?`
- `epicrisis: Epicrisis?`

**Audit Actions** (values for `action` field):

| Action | Description | Resource Type |
|:---|:---|:---|
| `VIEW_PATIENT` | Physician accessed patient record | `PATIENT` |
| `CREATE_NOTE` | New clinical note created | `NOTE` |
| `EDIT_DRAFT` | Draft note modified | `NOTE` |
| `REQUEST_AI_STRUCTURING` | AI structuring requested | `NOTE` |
| `REVIEW_NOTE` | Doctor reviewed AI-structured content | `NOTE` |
| `CONFIRM_NOTE` | Note confirmed by physician | `NOTE` |
| `GENERATE_EPICRISIS` | Epicrisis draft generated from history | `EPICRISIS` |
| `REVIEW_EPICRISIS` | Doctor reviewed epicrisis draft | `EPICRISIS` |
| `CONFIRM_EPICRISIS` | Epicrisis confirmed by physician | `EPICRISIS` |
| `CREATE_ADDENDUM` | Addendum created for confirmed record | `NOTE` or `EPICRISIS` |
| `ADMIN_MANAGE_USER` | Admin created/modified user account | `USER` |
| `ADMIN_MANAGE_ROLE` | Admin changed user role | `USER` |
| `ADMIN_MANAGE_DATA` | Admin managed synthetic data | `PATIENT` |

---

## 3. State Machine — ClinicalNote

```text
              ┌──────────────────┐
  Crear nota  │   DRAFT_MANUAL   │
  ──────────→ │  (texto original │
              │   capturado)     │
              └──────┬───────────┘
                     │
          Solicitar  │
          IA         ▼
              ┌──────────────────┐
              │ DRAFT_AI_ASSISTED│
              │  (secciones      │
              │   estructuradas) │
              └──────┬───────────┘
                     │
          Médico     │ edita
          modifica   ▼
              ┌──────────────────┐
              │    REVIEWED      │
              │  (modificado por │
              │   médico)        │
              └──────┬───────────┘
                     │
          Médico     │
          confirma   ▼
              ┌──────────────────┐
              │   CONFIRMED      │
              │  (inmutable)     │
              │  ← NO UPDATE →  │
              └──────────────────┘
                     │
          Solo       │ corrección
          adenda     ▼
              ┌──────────────────┐
              │ NUEVO REGISTRO   │
              │ noteType=ADDENDUM│
              │ parentNoteId=... │
              │ addendumReason=. │
              └──────────────────┘
```

**Valid transitions**:

| From | To | Trigger |
|:---|:---|:---|
| (new) | `DRAFT_MANUAL` | Doctor creates note with original text |
| `DRAFT_MANUAL` | `DRAFT_AI_ASSISTED` | AI structuring completes successfully |
| `DRAFT_MANUAL` | `CONFIRMED` | Doctor confirms manually (all sections complete) |
| `DRAFT_AI_ASSISTED` | `REVIEWED` | Doctor makes manual edits to structured content |
| `DRAFT_AI_ASSISTED` | `CONFIRMED` | Doctor confirms without editing |
| `REVIEWED` | `CONFIRMED` | Doctor confirms after review/edits |
| `CONFIRMED` | _(blocked)_ | No UPDATE permitted; addendum creates new record |

**Invalid transitions** (must be blocked at application level):
- Any state → `DRAFT_MANUAL` (cannot revert to draft)
- `CONFIRMED` → any state (immutable)
- `REVIEWED` → `DRAFT_AI_ASSISTED` (cannot revert to AI draft)
- Any → `CONFIRMED` without RF-026 validation passing

---

## 4. State Machine — Epicrisis

```text
  Generar       ┌──────────────────┐
  desde         │ DRAFT_AI_ASSISTED│
  historial ──→ │  (borrador IA)   │
                └──────┬───────────┘
                       │
            Médico     │ edita
                       ▼
                ┌──────────────────┐
                │    REVIEWED      │
                └──────┬───────────┘
                       │
            Confirma   ▼
                ┌──────────────────┐
                │   CONFIRMED      │
                │  (inmutable)     │
                └──────────────────┘
```

Same transition rules and immutability enforcement as ClinicalNote.

---

## 5. Conceptual Indices

The following indices should be considered during implementation for query performance:

| Entity | Fields | Purpose |
|:---|:---|:---|
| `MedicoPatientAccess` | `medicoId, patientId` | `@@unique` — authorization lookups |
| `MedicoPatientAccess` | `patientId` | Finding all authorized médicos for a patient |
| `ClinicalNote` | `patientId, createdAt` | Patient history timeline queries |
| `ClinicalNote` | `authorId` | Notes by physician |
| `ClinicalNote` | `status` | Filtering by state |
| `ClinicalNote` | `parentNoteId` | Finding addenda for a note |
| `Epicrisis` | `patientId, createdAt` | Patient epicrisis history |
| `AuditLog` | `userId, createdAt` | User audit trail |
| `AuditLog` | `resourceType, resourceId` | Resource event history |
| `SyntheticPatient` | `syntheticId` | Lookup by human-readable ID |
| `SyntheticPatient` | `lastName, firstName` | Search by name |

---

## 6. Entity Relationship Diagram (Conceptual)

```text
  ┌──────────────────┐
  │      User        │
  │  (existing)      │
  │                  │
  │  isAdmin         │   authoredNotes       ┌─────────────────┐
  │  isMedico (new)  │ ───────────────────→  │                 │
  │  fullName (new)  │   confirmedNotes      │  ClinicalNote   │
  │  specialty (new) │ ───────────────────→  │                 │
  │                  │                       │  parentNote ◄──┤ self-ref
  │                  │   authoredEpicrises   │  childNotes  ──┘
  │                  │ ───────────────── →   │                 │
  │                  │   confirmedEpicrises  └───────┬─────────┘
  │                  │ ───────────────── →          │
  │                  │                       patient│
  │                  │   auditLogs                  ▼
  │                  │ ───────────────── → ┌──────────────────┐
  │                  │                     │SyntheticPatient  │
  │                  │                     │                  │
  │                  │                     └────────┬─────────┘
  └────────┬─────────┘                              │
           │                                        │
           │  ┌──────────────────────────┐           │
           └─→│  MedicoPatientAccess     │◄──────────┘
              │  (M:N authorization)     │
              │                          │
              │  medicoId ──→ User       │
              │  patientId ──→ Patient   │
              │  grantedById ──→ User    │
              │  grantedAt               │
              └──────────────────────────┘

         ┌──────────────┐
         │   AuditLog   │
         │              │
         │ userId ──→ User
         │ patientId ──→ SyntheticPatient
         │ clinicalNoteId ──→ ClinicalNote
         │ epicrisisId ──→ Epicrisis
         └──────────────┘

                           ┌──────────────────┐
                           │    Epicrisis     │ ◄── patient ── SyntheticPatient
                           │                  │
                           │  parentEpicrisis ◄──┐ self-ref
                           │  childEpicrises ────┘
                           └──────────────────┘
```
