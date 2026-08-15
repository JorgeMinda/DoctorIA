# Technical Research: MVP DoctorIA

**Feature**: 001-doctoria-mvp
**Date**: 2026-08-08
**Phase**: 0 — Research

---

## R-01: Module Architecture within Wasp

**Decision**: Create a single new clinical module at `app/src/clinical/` following the established Wasp module pattern.

**Rationale**: The codebase uses a consistent pattern: each feature area (`auth/`, `admin/`, `demo-ai-app/`, `payment/`) has its own directory with a `.wasp.ts` file that exports a `Spec` array of routes, queries, and actions. This `Spec` is imported into `main.wasp.ts`. Following this pattern ensures consistency and avoids fighting the framework. Internal separation within the module (components, services, operations) handles clinical concerns without creating unnecessary top-level modules.

**Alternatives considered**:
- Multiple new top-level modules (clinical, audit, ai-service): Rejected — YAGNI. A single clinical module with internal organization is sufficient for the MVP. Audit and AI are implementation details within the clinical module.
- Standalone frontend/backend: Rejected per Constitution P3 — must preserve and reuse the existing stack.

---

## R-02: Role Identification — Explicit Medical Enablement

**Decision**: Add an explicit `isMedico: Boolean @default(false)` field to the existing `User` model. Retain `isAdmin` for its existing Open SaaS administrative purpose.

**Rationale**: The existing Open SaaS authentication allows public email signup (`SignupRoute` enabled, `User.isAdmin` defaults to `false`). Therefore, `!isAdmin` does NOT imply the user is a verified medical professional — it only means the user is not an administrator. Any registered user who is not in `ADMIN_EMAILS` would have `isAdmin = false`, which would incorrectly grant clinical access under a `!isAdmin = Médico` rule.

The solution adds a single boolean field:

| Field | Default | Meaning |
|:---|:---|:---|
| `isAdmin` (existing) | `false` | Open SaaS administrator capability |
| `isMedico` (new) | `false` | DoctorIA medical professional enablement |

This produces three effective states:

| `isAdmin` | `isMedico` | Estado funcional DoctorIA |
|:---|:---|:---|
| `false` | `false` | Usuario autenticado sin acceso funcional al módulo clínico |
| `false` | `true` | Médico — operaciones clínicas sobre pacientes autorizados |
| `true` | `false` | Administrador — gestión de cuentas, roles, datos sintéticos |
| `true` | `true` | Inválido — bloqueado por guards; roles mutuamente excluyentes |

Authorization guards:
- `ensureMedico(context)`: verifica `context.user` exists AND `isMedico === true` AND `isAdmin === false`. Lanza 401/403 en caso contrario.
- `ensureAdmin(context)`: verifica `context.user` exists AND `isAdmin === true`. Lanza 401/403 en caso contrario.

The administrator manages `isMedico` enablement via the existing admin panel (user management extension). A newly registered user has NO clinical access until an administrator explicitly enables `isMedico`.

**Alternatives considered**:
- `!isAdmin` as Médico (previous plan): **Rejected — insecure.** Open SaaS signup is public; any registered user would gain clinical access.
- `role` enum/string field: Rejected for now — introduces more schema complexity than a boolean for two roles. Can evolve post-MVP.
- RBAC library: Rejected per YAGNI — two roles with a boolean each don't justify a library.

---

## R-03: AI Service Boundary

**Decision**: Define a single typed service function (`structureClinicalText`) with a clear input/output contract. Leave the AI provider choice as a pending decision.

**Rationale**: The existing `demo-ai-app` module uses `openai ^6.27.0` directly. However:
- That dependency serves the demo app, NOT DoctorIA.
- The Constitution prohibits premature technical decisions (P1, P2).
- The spec does not mandate a specific provider.

The plan defines only the **contract** — input shape, output shape, error states, and timeout behavior. During development, a mock implementation returns deterministic results for testing. The real provider implementation replaces the mock when the provider decision is formally approved.

**Alternatives considered**:
- Multi-provider abstraction layer: Rejected per YAGNI — the MVP needs one provider behind a simple function boundary.
- Hardcode OpenAI because the dependency exists: Rejected — the dependency is for `demo-ai-app`, not an approved DoctorIA decision.

**Pending decision**: AI provider selection must be approved before implementation begins. The contract is provider-agnostic.

---

## R-04: Immutability via Self-Referencing Records

**Decision**: Implement immutability using self-referencing `parentNoteId` / `parentEpicrisisId` fields within the same Prisma model.

**Rationale**: When a clinical note or epicrisis reaches `CONFIRMED` status, the application layer prohibits any UPDATE to that record. Corrections create a NEW record with `noteType = 'ADDENDUM'` and a foreign key pointing to the parent. This approach:
- Uses standard Prisma self-relations (already supported).
- Keeps all versions queryable in a single table with a parent-child chain.
- Enforces traceability via the required `addendumReason` field.
- Is straightforward to implement and test.

**Alternatives considered**:
- Separate `NoteVersion` table: Rejected — adds complexity for common queries without benefit for the MVP's needs.
- Database-level UPDATE triggers/constraints: Rejected — Prisma doesn't support triggers directly and it would bypass the application layer where validation belongs.
- Soft-delete + recreate pattern: Rejected — doesn't preserve the confirmed record as genuinely immutable.

---

## R-05: Audit — Functional vs. Technical Logs

**Decision**: Implement a dedicated `AuditLog` Prisma model for functional audit, completely separate from console/stdout technical logs.

**Rationale**:
- **Functional audit** (`AuditLog` table): Records clinical events as required by RF-019/RF-020. Stores WHO did WHAT to WHICH resource and WHEN. Contains zero clinical content — only IDs, action types, timestamps, and non-clinical metadata (e.g., state transitions).
- **Technical logs** (console/stdout via Wasp's default Node.js logging): Used exclusively for server debugging and error tracking. Must never contain clinical data per RNF-002 and Constitution P5.

This separation ensures auditable traceability for clinical events while keeping technical logs free from sensitive information.

**Alternatives considered**:
- Unified logging system: Rejected — functional audit has fundamentally different requirements (retention, queryability, legal relevance) than technical debugging logs.
- External audit service: Rejected per YAGNI — a database table is sufficient for the MVP.

---

## R-06: Database Port Conflict Resolution

**Decision**: Configure the DoctorIA development database on a non-default port to avoid conflict with the existing PostgreSQL on port 5432.

**Rationale**: The development machine's port 5432 is occupied by another PostgreSQL installation that must not be stopped or modified. Wasp's managed `wasp start db` requires local port 5432 to be free. Because port 5432 is already occupied and that PostgreSQL installation must not be stopped or modified, DoctorIA will use a separately provisioned PostgreSQL development instance on a free non-default port and connect to it through `DATABASE_URL`.

**Pending decision**: The specific port and configuration method will be determined during environment setup. Options include:
- A separately provisioned Docker PostgreSQL container exposed on 5433 (or another free port), connected through `DATABASE_URL`.
- Manual PostgreSQL instance on an alternative port.
- Docker Compose with explicit port.

---

## R-07: Testing Strategy Stack

**Decision**: Use the existing testing infrastructure without additional frameworks.

**Rationale**: The project already includes everything needed:

| Tool | Purpose | Already present |
|:---|:---|:---|
| Vitest 4.1.x | Unit/integration tests | ✅ `devDependencies` |
| Playwright 1.55.1 | E2E tests | ✅ `e2e-tests/` |
| Zod 4.3.x | Runtime input validation | ✅ Used in operations |
| @faker-js/faker 8.3.1 | Synthetic test data | ✅ `devDependencies` |
| Browser Subagent | QA visual verification | ✅ Antigravity tool |

No additional testing frameworks are needed.

**Alternatives considered**:
- Jest: Rejected — Vitest is already configured and is the Vite-native choice.
- Cypress: Rejected — Playwright is already configured and serves the same purpose.

---

## R-08: Synthetic Data Seeding

**Decision**: Create a `seedSyntheticClinicalData` seed function following the existing `seedMockUsers` pattern.

**Rationale**: `main.wasp.ts` already includes a `seeds` array with `seedMockUsers`. Adding a clinical seed function follows this established pattern and integrates with `wasp db seed`. The synthetic data must be clearly fictitious with no resemblance to real patients per Constitution P5 and RF-024.

As a provisional technical estimate for development/demo purposes — not a validated requirement — the seed may generate 5–10 synthetic patients with varied demographics and 2–3 prior clinical notes each. The seed must also create `MedicoPatientAccess` records assigning specific patients to specific médicos, ensuring the authorization model is testable from the start.

---

## R-09: Client UI Components

**Decision**: Use the existing React + TailwindCSS + Radix UI component stack already present in the project.

**Rationale**: The project already includes a comprehensive UI toolkit:
- React 19.2.x
- TailwindCSS 4.x with `@tailwindcss/forms` and `@tailwindcss/typography`
- Radix UI: dialog, dropdown, select, toast, accordion, checkbox, label, progress, separator, switch
- lucide-react for icons
- class-variance-authority for variant styling
- Components at `app/src/client/components/ui/`

Clinical UI components (note editor, patient list, history timeline) will be built using these existing primitives. WCAG AA compliance (RNF-005) will be achieved through Radix UI's built-in accessibility and Tailwind's contrast utilities.

**Alternatives considered**:
- Adding MUI or Chakra UI: Rejected — would introduce a conflicting design system and unnecessary dependency weight.

---

## R-10: Patient Authorization — Médico ↔ SyntheticPatient

**Decision**: Model the authorization relationship between physicians and synthetic patients using an explicit many-to-many join table (`MedicoPatientAccess`).

**Rationale**: RF-025 and C-03 establish that a Médico has access to "pacientes autorizados" — not to all patients. This requires an explicit authorization check on every patient-scoped operation, enforced at the server level (not just frontend filtering).

A many-to-many join table is the simplest Prisma-compatible solution:
- A physician may be authorized to access multiple patients.
- A patient may have multiple authorized physicians (the spec does not restrict to a single physician).
- The join table (`MedicoPatientAccess`) records which médico has access to which patient, with an assignment timestamp and the assigning administrator.
- Every patient-scoped query and action includes a `WHERE` clause that joins through this table, ensuring unauthorized patients are never returned or modifiable.

**Alternatives considered**:
- All physicians access all patients: **Rejected — contradicts RF-025 and C-03** which explicitly state "pacientes autorizados".
- `assignedDoctorId` FK on SyntheticPatient: Rejected — assumes single physician per patient, a restriction the spec does not impose.
- Authorization check at frontend only: Rejected — server-side enforcement is mandatory per the spec's functional requirements and minimum privilege principle.

---

## Summary of Decisions and Pending Items

| ID | Decision | Owner | Status / Resolution |
|:---|:---|:---|:---|
| PD-01 | AI provider selection (OpenAI / Gemini / Claude / other) | Equipo + Líder técnico | ✅ Resuelta: OpenRouter (OpenAI-compatible). Modelo `openai/gpt-oss-20b:free` en dev/demo; para producción usar clave paga/BYOK y modelo superior (ver `app/src/clinical/services/aiService.ts`) |
| PD-02 | Database port configuration for development | Developer doing environment setup | Blocks local development start |
| PD-03 | Google Stitch screen designs | Equipo de diseño | Blocks UI implementation tasks |

All other technical decisions are resolved. No NEEDS CLARIFICATION items remain.
