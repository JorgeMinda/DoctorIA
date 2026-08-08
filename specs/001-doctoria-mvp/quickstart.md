# Quickstart Validation Guide: MVP DoctorIA

**Feature**: 001-doctoria-mvp
**Date**: 2026-08-08
**Phase**: 1 — Design
**Purpose**: Document runnable validation scenarios to prove the feature works end-to-end.

---

## Prerequisites

1. **Environment**: Node.js 25.x, npm 11.x, Wasp 0.25.0 installed.
2. **Database**: PostgreSQL accessible on a non-5432 port (see [research.md](research.md) R-06).
3. **Dependencies**: `npm install` completed in `app/`.
4. **Database migrated**: `wasp db migrate-dev` executed after schema changes.
5. **Seed data**: `wasp db seed` executed — synthetic patients and mock users created.
6. **AI provider**: Mock implementation active (or real provider configured with approved API key).

---

## Starting the Application

```bash
# Terminal 1 — Start database (if using wasp-managed DB)
cd app  # DATABASE_URL debe apuntar a la instancia PostgreSQL de desarrollo separada; no usar `wasp start db` mientras 5432 esté ocupado

# Terminal 2 — Start application
cd app && wasp start
```

Application available at `http://localhost:3000`.

---

## Validation Scenario 1: Médico — Complete Note Flow

**Covers**: HU-01, HU-02, HU-03, HU-04, HU-05, HU-07, RF-001→RF-015, RF-026→RF-028, RNF-004, RNF-008, RNF-009

### Steps

1. **Login** as a user with `isMedico = true` and `isAdmin = false` (explicitly enabled by administrator) → redirected to clinical dashboard.
2. **Navigate** to patient list → synthetic patients visible (PAC-001, PAC-002, etc.).
3. **Search** for a patient by name → results filtered, response < 2s (RNF-010).
4. **Select** patient PAC-001 → patient profile with history opens.
5. **Create new note** → editor opens with unified text field.
6. **Type clinical text** → text captured in `originalText` field.
7. **Click "Solicitar Estructuración IA"** → progress indicator appears after 2s.
8. **AI completes** → 5 sections populated, state = `DRAFT_AI_ASSISTED`, original text preserved.
9. **Edit a section** (e.g., Plan/indicaciones) → state transitions to `REVIEWED`.
10. **Mark "Examen físico" as "No aplica"** with justification → section shows N/A indicator.
11. **Click "Confirmar Nota"** → confirmation dialog with summary appears.
12. **Confirm** → state = `CONFIRMED`, timestamp and confirmer recorded.
13. **Verify** the confirmed note appears in patient history and is not editable.

### Expected Outcomes

- `originalText` preserved unchanged throughout the flow.
- AI-assisted content visually distinguishable from manual text.
- Confirmation blocked if any section is empty without "No aplica" justification (RF-027).
- Confirmed note is read-only — no edit buttons visible.
- `AuditLog` contains entries: `CREATE_NOTE`, `REQUEST_AI_STRUCTURING`, `EDIT_DRAFT`, `CONFIRM_NOTE`.

---

## Validation Scenario 2: Médico — AI Failure and Manual Continuation

**Covers**: HU-07, RF-021, RF-022, RNF-008

### Steps

1. **Create a new note** for PAC-002 with clinical text.
2. **Trigger AI structuring** with mock configured to timeout (30s).
3. **After 30s** → non-blocking alert appears: "El servicio de IA no está disponible."
4. **Verify** original text is preserved and editable.
5. **Manually fill** all 5 sections without AI.
6. **Confirm note** → state = `CONFIRMED`, `aiAssisted = false`.

### Expected Outcomes

- No data loss — original text intact.
- UI not frozen during timeout.
- Doctor can continue working in manual mode.
- Note confirmed successfully without AI assistance.

---

## Validation Scenario 3: Immutability and Addenda

**Covers**: HU-04, HU-06, RF-028, RF-029

### Steps

1. **Open** a previously confirmed note for PAC-001.
2. **Attempt to edit** any field → UI shows read-only state (no edit controls).
3. **Click "Crear Adenda"** → new note form opens with reference to parent.
4. **Enter** correction reason and updated content.
5. **Confirm the addendum** → new record created with `noteType = ADDENDUM`.
6. **View patient history** → both original note and addendum visible with traceability link.

### Expected Outcomes

- Confirmed note is genuinely uneditable (verified at API level, not just UI).
- Addendum contains: parent reference, reason, new author, new timestamp.
- Original note remains unchanged.
- History shows version chain: Original → Addendum.

---

## Validation Scenario 4: Epicrisis Generation and Confirmation

**Covers**: HU-06, RF-016→RF-018, RF-020

### Steps

1. **Ensure** PAC-001 has at least one confirmed note.
2. **Navigate** to PAC-001's profile.
3. **Click "Generar Epicrisis"** → AI synthesizes from confirmed notes.
4. **Review** 10 required elements in the draft.
5. **Edit** evolution summary and diagnoses.
6. **Confirm epicrisis** → state = `CONFIRMED`.

### Expected Outcomes

- Epicrisis draft contains synthesized content from confirmed notes.
- All 10 elements visible and editable.
- Confirmed epicrisis is immutable (same as confirmed notes).
- `AuditLog` contains: `GENERATE_EPICRISIS`, `REVIEW_EPICRISIS`, `CONFIRM_EPICRISIS`.

---

## Validation Scenario 5: Authorization — Médico ↔ Patient Access

**Covers**: RF-025, C-03, R-10

### Prerequisites

- Médico A (`isMedico = true`) is authorized for PAC-001 via `MedicoPatientAccess`.
- Médico A is NOT authorized for PAC-003.
- Both patients exist in the seed data.

### Steps

1. **Login** as Médico A.
2. **Navigate** to patient list → only authorized patients visible (PAC-001 appears, PAC-003 does NOT).
3. **Access** PAC-001 → patient profile with history opens normally.
4. **Attempt** to access PAC-003 by direct URL (`/clinical/patients/PAC-003-id`) → HTTP 403, no clinical content returned.
5. **Attempt** to call `getPatientById({ patientId: 'PAC-003-id' })` via API → HTTP 403, response body contains no clinical data.
6. **Attempt** to call `createClinicalNote({ patientId: 'PAC-003-id', originalText: '...' })` → HTTP 403.

### Expected Outcomes

- Patient list shows ONLY patients for which `MedicoPatientAccess` exists for the logged-in physician.
- All operations (detail, history, notes, AI, epicrisis, addenda) are blocked server-side for unauthorized patients.
- Error responses for unauthorized patients do NOT reveal any clinical content.
- API-level enforcement verified — not just frontend filtering.

---

## Validation Scenario 6: Authorization — Admin Cannot Access Clinical Content

**Covers**: RF-025, C-03

### Steps

1. **Login** as an admin user (`isAdmin = true`, `isMedico = false`).
2. **Navigate** to the admin panel → user management, analytics accessible.
3. **Attempt** to access clinical routes (patient list, note editor) → access denied (403).
4. **Attempt** to call clinical API operations directly → HTTP 403 response.

### Expected Outcomes

- Admin sees admin panel but NOT clinical module routes.
- All clinical operations return 403 for admin users.
- Admin CAN manage synthetic patient data (CRUD) through admin operations.
- Admin CAN manage `MedicoPatientAccess` (grant/revoke physician access to patients).
- Admin CAN view administrative audit log but NOT clinical audit entries.

---

## Validation Scenario 7: Authorization — Unenabled User Has No Clinical Access

**Covers**: RF-025, SARA-02

### Steps

1. **Register** a new user via public signup (email not in `ADMIN_EMAILS`).
2. **Login** → user has `isAdmin = false`, `isMedico = false`.
3. **Attempt** to access clinical routes → access denied (403).
4. **Attempt** to access admin routes → access denied (403).
5. **Admin enables** `isMedico = true` for this user via admin panel.
6. **Admin grants** `MedicoPatientAccess` for at least one patient.
7. **Login** again → clinical module now accessible; only authorized patients visible.

### Expected Outcomes

- A freshly registered user has zero functional access to DoctorIA.
- Clinical access requires both `isMedico = true` AND explicit patient authorization.
- The admin panel is the only path to enable medical access.

---

## Validation Scenario 8: Audit Trail Integrity

**Covers**: RF-019, RF-020, RNF-007

### Steps

1. **As médico** (with `isMedico = true`): perform a complete flow (view patient → create note → AI → confirm).
2. **Navigate** to "Mi Auditoría" → own clinical audit entries visible.
3. **Verify** entries contain: user ID, action, timestamp, resource reference.
4. **Verify** entries do NOT contain full clinical text.
5. **As admin**: navigate to admin audit → only admin-scoped entries visible.

### Expected Outcomes

- Audit log is append-only — no entries can be deleted or modified.
- Clinical audit visible only to the acting physician.
- Admin audit separated from clinical audit.
- No sensitive clinical text in audit metadata.

---

## Validation Scenario 9: Performance Goals (Staging)

**Covers**: RNF-010, RNF-011, RNF-013

### Measurement Approach (deferred to QA phase)

1. **Navigation/search/load**: Measure P95 response time over 50 representative interactions → target ≤ 2s.
2. **AI structuring**: Measure P95 response time over 30 AI requests → target ≤ 15s.
3. **Progress indicator**: Verify visual indicator appears when AI processing > 2s.
4. **Timeout behavior**: Verify non-blocking degradation at 30s.
5. **Availability**: Log uptime/downtime events during test sessions → record for RNF-013.

Tools: Browser DevTools Network panel, Playwright timing assertions, manual timing logs.

---

## Validation Scenario 10: AI Structuring Quality

**Covers**: RNF-012, C-05

### Measurement Approach (deferred to QA phase)

1. **Prepare** 30 labeled synthetic clinical notes (each pre-classified into 5 sections by a domain expert).
2. **Run** each note through AI structuring.
3. **Compare** AI output sections against expert labels.
4. **Verify**:
   - 100% original text conserved (zero omissions).
   - Unclassifiable content marked "Requiere revisión".
   - ≥ 90% correct section assignment.
5. **Document** results — this measures text structuring, NOT clinical diagnostic accuracy.
