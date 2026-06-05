# zBOM Core Modules Production Integration Plan

Date: 2026-06-05

## Goal

Move zBOM from a frontend hardening prototype into a production-level core workflow for three modules:

1. `BOM Editor`
2. `Tooling Hub`
3. `Part Library`

The next development session should make these modules work as one connected product area, with real persistence/API behavior, production-grade frontend workflows, detailed role-based UX, and a second round of granular user-path inspection after integration.

All other modules should be explicitly marked as `In development` or moved behind a non-core status treatment so they do not confuse development, testing, or stakeholder review.

## Current Baseline

Known current state:

- The app is a React + Vite frontend using Zustand memory state and mock data.
- Role/use-case hardening has been completed for the prototype layer.
- `BOM Editor`, `Part Library`, and `Tooling Hub` exist, but they are not yet a persistent connected system.
- `Tooling Hub` is mostly read-only and disconnected from BOM/Part Library edit flows.
- `services/ApiInterface.ts` is an interface and mock transition layer; most methods are not implemented.
- `Settings`, `ERP Connect`, `Supply Chain`, `Compare`, `ECO`, `Product Matrix`, `EBOM Architecture`, `MBOM Delta`, and Dashboard are useful for prototype context but should not remain visually equal to production-ready core modules during the next build phase.

Reference docs:

- `README.md`
- `docs/testing-guide.md`
- `docs/user-tests/20260604-role-usecase-hardening-final/final-pass-fail-report.md`
- `docs/superpowers/plans/2026-06-04-zbom-role-usecase-hardening-subagent-plan.md`

## Production-Level Definition

A module is considered production-level for this phase only when all of the following are true:

- Data is loaded from and saved to a persistent backend or durable repository, not only local mock/Zustand state.
- Create, update, delete, search, filter, sort, validation, loading, empty, success, error, conflict, and permission-denied states are implemented.
- UI paths can be completed by real users without placeholder buttons or ambiguous simulated behavior.
- Cross-module links are consistent: a part edited in `Part Library` is reflected in BOM usage and tooling context; a BOM item can reference a library part; tooling records link to real part/design-master records.
- Frontend permission behavior is mirrored by backend/API authorization or at least by a server-side policy layer.
- Audit-relevant actions create traceable events: who changed what, when, and from which module.
- Automated tests cover domain logic, API/repository behavior, UI flows, and role-specific user paths.
- Browser QA confirms the critical paths at desktop and narrow viewport.

## Core Product Model To Unify

The next session should start by defining a single core model shared by the three modules.

### Canonical Entities

- `Project`
- `Part`
- `PartRevision`
- `BOM`
- `BOMNode`
- `BOMRevision` or `BOMSnapshot`
- `DesignMasterPart`
- `ConcretePartMapping`
- `ToolingRecord`
- `ToolingMilestone`
- `Supplier`
- `AVL`
- `AttachmentMetadata`
- `AuditEvent`
- `User`
- `Role`

### Required Relationships

- A `BOMNode` should reference either:
  - an existing `Part` / `PartRevision`, or
  - a clearly marked custom/local item that can later be promoted into `Part Library`.
- A `Part` should know:
  - where it is used in BOMs,
  - which suppliers/AVL entries are associated with it,
  - whether it belongs to a design-master family,
  - which tooling records are related through design-master or concrete part mapping.
- A `ToolingRecord` should reference:
  - one `DesignMasterPart`,
  - one or more concrete part numbers or part IDs,
  - supplier/toolmaker,
  - milestones and status history.
- Audit events should attach to part, BOM node, tooling record, and milestone changes.

## Recommended Architecture Direction

The repo currently has no real backend. For the next session, choose a small but real backend before expanding UI behavior.

Recommended path:

- Add a local API layer for the core modules.
- Use a durable development database such as SQLite with a migration-friendly schema, while keeping the design compatible with Postgres later.
- Keep Vite as the frontend.
- Introduce a typed API client used by stores/pages instead of directly mutating mock data.
- Retain mock data only as seed data.

Alternative if dependency installation or backend setup is blocked:

- Implement a file-backed repository under a local API facade as a temporary stepping stone.
- Keep the same service contracts so the storage layer can be swapped later.

## System Scope Decision

### Production Core

These modules should remain first-class in navigation:

- `BOM Editor`
- `Part Library`
- `Tooling Hub`

### In Development Modules

These modules should be visibly marked as in development or routed to a status page:

- Dashboard
- Product Matrix
- EBOM Architecture
- MBOM Delta
- Change Orders / ECO
- Compare Revisions
- Supply Chain
- Settings
- ERP Connect

Recommended UI treatment:

- Keep only the three core modules visually primary.
- Add an `In development` badge to non-core nav items, or group them under a collapsed `Development Preview` section.
- Non-core pages should show a consistent status banner: `In development - not part of the production core test scope`.
- Tests for non-core modules should be limited to route visibility, status treatment, and no-crash checks.

## Wave 0: Discovery And Scope Freeze

Purpose: prevent new-session drift before implementation.

Tasks:

- [ ] Read `README.md`, `docs/testing-guide.md`, and this plan.
- [ ] Run `git status --short` and identify unrelated dirty files.
- [ ] Run current baseline:
  - `./node_modules/.bin/vitest run --reporter=verbose`
  - `npm run build`
- [ ] Inspect current shapes of:
  - `types.ts`
  - `stores/useBOMStore.ts`
  - `stores/useToolingStore.ts`
  - `pages/BOMEditor.tsx`
  - `pages/PartLibrary.tsx`
  - `pages/ToolingHub.tsx`
  - `services/ApiInterface.ts`
- [ ] Freeze the production-core scope to the three modules only.
- [ ] Create a core integration checklist under `docs/user-tests/`.

Acceptance:

- The team has a written list of existing state, data gaps, and UI gaps before changing code.

## Wave 1: Core Domain And Persistence Agent

Purpose: define the persistent data model and repository/API contracts for the three core modules.

Owned areas:

- Domain types
- Repository interfaces
- API contracts
- Seed data
- Migration or persistence setup

Tasks:

- [ ] Define canonical `Part`, `PartRevision`, `BOMNode`, `DesignMasterPart`, `ToolingRecord`, `ToolingMilestone`, `Supplier`, `AVL`, and `AuditEvent` models.
- [ ] Decide whether to use Prisma/SQLite, another lightweight backend, or file-backed storage as the first durable layer.
- [ ] Convert current mock BOM, part library, supplier, and tooling data into seed data.
- [ ] Implement repository operations:
  - create/update/delete/search parts
  - get part usage in BOM
  - create/update/delete BOM nodes
  - create/update BOM snapshots/revisions
  - create/update tooling records
  - update tooling milestones
  - link tooling to design-master and concrete parts
  - write audit events
- [ ] Add server-side validation rules for core entity writes.
- [ ] Add tests for repository persistence and relationship integrity.

Acceptance:

- Restarting the app/backend does not lose core module changes.
- Part, BOM, and tooling records can be read and written through one typed repository/API layer.
- Invalid writes fail with clear validation errors.

## Wave 2: Core API And Store Migration Agent

Purpose: move the frontend away from direct mock mutations for the three production-core modules.

Owned areas:

- `services/ApiInterface.ts`
- API client
- Zustand stores or query/data hooks
- Loading/error state contracts

Tasks:

- [ ] Replace unimplemented `ApiInterface` methods for core modules.
- [ ] Add typed API methods for:
  - parts search/create/update/delete
  - part usage lookup
  - BOM load/create/update/delete node
  - BOM recalculation or server-confirmed totals
  - tooling load/create/update milestone
  - design-master mapping
  - audit history lookup
- [ ] Refactor `useBOMStore` so core changes flow through the API layer.
- [ ] Split library-specific state from BOM tree state if current store becomes too broad.
- [ ] Refactor `useToolingStore` so milestone updates persist.
- [ ] Add optimistic update behavior only where rollback is implemented.
- [ ] Implement consistent loading, save-in-progress, retry, and error states.

Acceptance:

- Frontend stores no longer treat mock arrays as the source of truth for production-core modules.
- Failed API writes do not leave the UI in a false success state.
- A part updated in `Part Library` is reflected in BOM and tooling context after reload.

## Wave 3: BOM Editor Production UX Agent

Purpose: make BOM editing complete, durable, and safe.

Owned areas:

- `pages/BOMEditor.tsx`
- BOM table/editor components
- BOM domain helpers
- BOM tests

Required user paths:

- Admin creates a BOM item from an existing library part.
- Admin creates a local/custom BOM item and later links or promotes it to Part Library.
- Engineer edits allowed BOM structure/metadata.
- Sourcing reviews procurement fields without editing engineering-only structure.
- Viewer navigates read-only without cost leaks or mutation controls.
- User imports CSV and receives validation mapping feedback before commit.
- User exports current BOM and receives a real file or clear generated artifact.
- User creates a snapshot/revision and can reload it.
- User sees recalculated totals after changes.

Tasks:

- [ ] Replace free-form add item with a production flow:
  - choose existing part
  - or create local item
  - parent selector
  - quantity/unit/type validation
  - duplicate part handling
  - cancel/save states
- [ ] Add edit/delete behavior with confirmation and permission checks.
- [ ] Improve CSV import with preview, row-level errors, and commit step.
- [ ] Implement real export output for BOM view.
- [ ] Add persisted snapshot/revision creation.
- [ ] Show change history/audit for selected node.
- [ ] Add clear unsaved/saving/saved/error states.
- [ ] Tighten UI density and responsive behavior for large BOMs.

Acceptance:

- A complete add/edit/delete/import/export/snapshot workflow can be executed through UI and remains after reload.
- All write operations show success or actionable error feedback.
- Role restrictions are enforced in UI and API layer.

## Wave 4: Part Library Production UX Agent

Purpose: make Part Library the master data surface for BOM and tooling.

Owned areas:

- `pages/PartLibrary.tsx`
- part forms
- search/filter/sort
- AVL/supplier editing
- part usage panel

Required user paths:

- Sourcing creates a commercial part with supplier, MOQ, SPQ, pricing tiers, lead time, and AVL status.
- Engineer creates or updates engineering metadata if permitted.
- Admin merges or deactivates duplicate parts.
- User searches by part number, MPN, description, supplier, category, lifecycle, and stock status.
- User opens a part and sees:
  - BOM usage
  - tooling linkage
  - suppliers/AVL
  - price history/current price
  - audit history

Tasks:

- [ ] Build full create/edit form with field groups:
  - identity
  - engineering metadata
  - commercial/procurement
  - supplier/AVL
  - lifecycle/status
- [ ] Implement server-backed search, filter, sort, and pagination.
- [ ] Add validation for duplicate part numbers and invalid pricing tiers.
- [ ] Add BOM usage panel using real relationship data.
- [ ] Add tooling relationship panel.
- [ ] Add supplier/AVL edit flow with permission checks.
- [ ] Add deactivate/archive behavior instead of unsafe hard delete by default.
- [ ] Add audit history panel.

Acceptance:

- Part Library becomes the authoritative source for part data used by BOM and tooling.
- Editing commercial fields updates related BOM procurement views after reload.
- Viewer cannot see protected commercial values.

## Wave 5: Tooling Hub Production UX Agent

Purpose: turn Tooling Hub from read-only overview into an operational tooling tracker connected to parts.

Owned areas:

- `pages/ToolingHub.tsx`
- tooling forms
- milestone editor
- design-master/concrete mapping
- tooling tests

Required user paths:

- Engineer/Admin creates a design-master part.
- Engineer/Admin maps concrete parts from Part Library to a design master.
- Engineer/Admin creates a tooling record for the design master.
- Engineer/Admin assigns supplier/toolmaker, cavity count, planned dates, and owner.
- Engineer/Admin updates milestone status and actual date.
- User sees derived kickoff-to-T1 lead time.
- User navigates from Tooling Hub to related Part Library records and BOM usage.
- Viewer can inspect tooling status read-only.

Tasks:

- [ ] Add create/edit design-master part flow.
- [ ] Add concrete part mapping selector backed by Part Library.
- [ ] Add create/edit tooling record flow.
- [ ] Add milestone editor:
  - status
  - planned date
  - actual date
  - owner
  - notes/blocker reason
- [ ] Persist milestone updates.
- [ ] Add tooling status summary, overdue state, blocked state, and lead-time metrics.
- [ ] Add links to related parts and BOM usage.
- [ ] Add audit history for milestone changes.

Acceptance:

- Tooling changes persist after reload.
- Tooling is traceably linked to Part Library and BOM usage.
- Milestone updates are actionable and role-gated.

## Wave 6: Non-Core Module Status Agent

Purpose: reduce confusion by clearly separating production core from development previews.

Owned areas:

- `components/Sidebar.tsx`
- `App.tsx`
- shared status/banner component
- tests for navigation/status

Tasks:

- [ ] Define `productionCore` nav group:
  - BOM Editor
  - Part Library
  - Tooling Hub
- [ ] Define `Development Preview` nav group for all other modules.
- [ ] Add `In development` badge or status treatment to non-core nav items.
- [ ] Add a consistent banner to non-core pages.
- [ ] Update tests so non-core pages are not treated as production-complete paths.
- [ ] Update README and testing guide after implementation.

Acceptance:

- A tester immediately knows which modules are production-core and which are preview/development.
- Browser use-case testing cannot accidentally judge non-core modules as production-ready.

## Wave 7: Granular User-Path QA Agent

Purpose: after the system is connected, perform a deeper user-path inspection and turn findings into UI improvements.

Create:

- `docs/user-tests/YYYYMMDD-core-modules-production-usecase-check/`
- structured results JSON
- screenshots/videos where useful
- issue list with severity and owning module

### Detailed Use Cases

#### BOM Editor

- UC-BOM-01: Add existing library part to BOM.
- UC-BOM-02: Add local/custom item, validate errors, save, reload.
- UC-BOM-03: Edit quantity/unit/type and confirm recalculated totals.
- UC-BOM-04: Delete or remove BOM node with confirmation and audit trail.
- UC-BOM-05: Import CSV with valid rows and invalid rows; commit only valid or block with clear errors.
- UC-BOM-06: Export current tree/flat view.
- UC-BOM-07: Create snapshot/revision and reload snapshot.
- UC-BOM-08: Viewer read-only navigation and cost masking.
- UC-BOM-09: Sourcing flat procurement review.
- UC-BOM-10: Narrow viewport BOM operation.

#### Part Library

- UC-PL-01: Create new part with required identity fields.
- UC-PL-02: Edit commercial fields as Sourcing.
- UC-PL-03: Edit engineering metadata as Engineer.
- UC-PL-04: Duplicate part number validation.
- UC-PL-05: Search/filter/sort large result list.
- UC-PL-06: Open BOM usage panel.
- UC-PL-07: Open tooling linkage panel.
- UC-PL-08: Archive/deactivate part and check downstream behavior.
- UC-PL-09: Viewer protected commercial data masking.
- UC-PL-10: Audit history inspection.

#### Tooling Hub

- UC-TH-01: Create design-master part.
- UC-TH-02: Map concrete parts from Part Library.
- UC-TH-03: Create tooling record.
- UC-TH-04: Edit supplier/toolmaker and cavity count.
- UC-TH-05: Update milestone planned/actual dates.
- UC-TH-06: Mark milestone blocked and add blocker reason.
- UC-TH-07: Confirm kickoff-to-T1 lead time calculation.
- UC-TH-08: Navigate to linked part and BOM usage.
- UC-TH-09: Viewer read-only tooling inspection.
- UC-TH-10: Narrow viewport tooling operation.

### QA Output Format

For each use case record:

- role
- preconditions
- steps
- expected result
- actual result
- pass/fail
- severity
- screenshot path
- notes
- recommended fix

## Wave 8: UI Refinement Agent

Purpose: convert granular QA findings into production UI improvements.

Focus areas:

- Form layout and validation clarity
- Dense data tables and column usability
- Empty/loading/error/conflict states
- Permission-denied explanations
- Cross-module navigation links
- Drawer/modal behavior and Escape handling
- Responsive layout at 390px and tablet widths
- Bulk actions and long-list ergonomics
- Save feedback and dirty-state warnings

Tasks:

- [ ] Prioritize QA findings by severity.
- [ ] Fix P0/P1 issues first.
- [ ] Add or update tests for each fixed issue.
- [ ] Re-run full regression and browser use-case checks.
- [ ] Update documentation and final evidence.

Acceptance:

- No P0/P1 production-core UX blockers remain.
- P2 items are documented with owner/reason.

## Testing Strategy

Minimum automated gates before final handoff:

```bash
./node_modules/.bin/vitest run --reporter=verbose
npm run build
```

New tests to add:

- repository/API tests for core persistence
- role API authorization tests
- `BOMEditor` production workflow tests
- `PartLibrary` production workflow tests
- `ToolingHub` production workflow tests
- cross-module relationship tests
- non-core status/navigation tests
- browser/e2e tests if a browser test harness is added

Manual/browser gates:

- desktop core workflow walkthrough
- 390px viewport walkthrough
- role-by-role walkthrough
- reload/persistence check
- network/API failure simulation
- duplicate/conflict simulation

## Suggested Sub-Agent Split

1. `core-domain-persistence-agent`
2. `api-store-migration-agent`
3. `bom-editor-production-agent`
4. `part-library-production-agent`
5. `tooling-hub-production-agent`
6. `non-core-status-agent`
7. `granular-usecase-qa-agent`
8. `ui-refinement-agent`
9. `integration-coordinator`

Coordinator rule:

- Do not let UI agents start broad rewrites until the domain/API contracts are stable.
- Do not treat non-core module polish as in scope unless it is needed for navigation/status clarity.
- Every agent must report changed files, tests run, residual gaps, and screenshots if UI changed.

## New Session Starter Prompt

Use this prompt to start the next detailed development session:

```text
请基于当前仓库状态和 docs/superpowers/plans/2026-06-05-zbom-core-modules-production-integration-plan.md 开始执行下一阶段开发。

目标：
1. 将 BOM Editor、Part Library、Tooling Hub 三个模块打通到生产级核心流程。
2. 引入真实持久化/API 或明确的 durable repository 层，替换三大核心模块对 mock/Zustand 内存数据的依赖。
3. 让三大模块共享统一 Part/BOM/Tooling 数据模型和关系：Part Library 是主数据源，BOM 节点引用 Part，Tooling 通过 design-master/concrete part 映射连接 Part Library 和 BOM usage。
4. 将其他模块标记为 In development 或 Development Preview，避免测试和开发范围混淆。
5. 系统打通后，按计划中的 granular use cases 进行细节用户路径检查，并据此改善 UI/UX。

请先执行 Wave 0：读取 README、docs/testing-guide.md、本计划，运行 git status、baseline test/build，输出当前差距清单和具体 Wave 1 实施方案。不要先做大范围 UI 重写。
```

