# zBOM Core Modules Production Integration - Wave 0 Discovery

Date: 2026-06-05

## Scope Freeze

Production-core scope for the next implementation wave is limited to:

- BOM Editor
- Part Library
- Tooling Hub

All other modules should be treated as `In development` or `Development Preview` during production-core testing.

## Baseline Verification

- `git status --short --branch`
  - `## main...origin/main`
  - `?? docs/superpowers/plans/2026-06-05-zbom-core-modules-production-integration-plan.md`
- `./node_modules/.bin/vitest run --reporter=verbose`
  - Passed: 18 test files
  - Passed: 131 tests
- `npm run build`
  - Passed
  - Main entry chunk: `dist/assets/index-DoJvZx86.js` at 21.02 kB gzip 7.20 kB
  - Largest vendor chunk: `dist/assets/vendor-BZ9uhB4c.js` at 458.52 kB gzip 141.33 kB
  - No Vite 500 kB chunk warning observed

## Current State

- README and testing guide confirm the app is a React 18 + TypeScript + Vite frontend prototype.
- Data source is still `data/` mock data plus Zustand memory state.
- `services/ApiInterface.ts` exists, but the core BOM methods throw `Method not implemented`.
- `useBOMStore` owns BOM tree, library parts, suppliers, snapshots, attributes, and attachments in one memory store.
- `useToolingStore` owns design-master parts and tooling records in memory, seeded from `data/mockTooling.ts`.
- `PartLibrary` reads and mutates `libraryParts` through the BOM store facade.
- `ToolingHub` reads design-master/tooling data from a separate store and is not connected to Part Library records or BOM usage.
- `Sidebar` currently presents all major modules as peer navigation items; non-core modules are not visibly marked as development previews.

## Current Gap List

### Data And Persistence

- No durable persistence for production-core changes.
- No SQLite/file-backed repository or backend API for core entities.
- Mock data is treated as source of truth instead of seed data.
- Existing EBOM architecture repository is in-memory only and scoped to a non-core preview module.
- BOM snapshots are created in Zustand memory and disappear after refresh.
- Attachments use `URL.createObjectURL` only and do not produce durable metadata.

### Shared Core Model

- `LibraryPart` is not a canonical `Part` master-data model.
- `BOMNode` duplicates part fields such as part number, name, cost, manufacturer, MPN, MOQ, SPQ, and pricing tiers instead of referencing a `Part` / `PartRevision`.
- There is no explicit `PartRevision` entity.
- There is no canonical `BOM`, `BOMRevision`, or `BOMSnapshot` entity separate from a root `BOMNode`.
- `DesignMasterPart` stores concrete part numbers as strings, not part IDs/revisions.
- `Tooling` does not link to real Part Library records or BOM usage.
- No `AuditEvent` model exists for Part/BOM/Tooling changes.

### API And Authorization

- `ApiClient` lacks core operations for part create/update/delete, BOM snapshot/revision, tooling create/update, design-master mapping, audit lookup, and conflict handling.
- `MockApiClient` returns empty library/supplier data and throws for BOM operations.
- Permission behavior is frontend-only; there is no repository/API policy layer.
- No standard API error shape for validation, permission denied, not found, conflict, or persistence failure.

### BOM Editor UX

- Add item flow is free-form and creates local nodes directly.
- No existing-library-part selector or local-item promotion path.
- No delete operation or durable edit confirmation path.
- CSV import commits a parsed tree after `window.confirm`; there is no preview or row-level validation.
- Snapshot creation uses `prompt` and stores only in memory.
- No persisted audit/history for selected node edits.
- Save/loading/error/conflict states are not modeled.

### Part Library UX

- Search/filter/sort are local array operations.
- Create form is minimal and does not cover supplier/AVL, lifecycle, MOQ, SPQ, pricing tiers, lead time, or engineering metadata.
- Duplicate part-number validation is absent.
- Where-used is calculated by matching `partNumber` strings in the current memory BOM tree.
- No tooling relationship panel.
- No deactivate/archive flow or audit history panel.

### Tooling Hub UX

- Tooling Hub is read-only in the page copy and UI.
- No create/edit design-master flow.
- No concrete-part mapping selector backed by Part Library.
- No create/edit tooling record flow.
- No milestone editor for owner, notes, blocker reason, actual/planned dates, or status changes.
- Lead time is derived in store memory only.
- No navigation to related Part Library records or BOM usage.

### Test Scope

- Current tests validate prototype role/use-case behavior and in-memory stores.
- There are no repository persistence tests for the three core modules.
- There are no relationship integrity tests across Part Library, BOM usage, and Tooling mappings.
- Non-core pages are still tested as normal workflow surfaces rather than development previews.

## Wave 1 Implementation Plan

### Architecture Decision

Use a durable repository layer first, then migrate UI stores to it in Wave 2.

Implemented first step:

- Add a durable browser-local repository under `repositories/core/` for zero new runtime dependency risk.
- Keep the repository contract storage-agnostic so it can later be backed by SQLite/Postgres.
- Store runtime data in `localStorage` through `createLocalStorageCoreStorage`; tests use `createInMemoryCoreStorage`.
- Keep `data/mockBOM.ts`, `data/mockLibrary.ts`, `data/mockSuppliers.ts`, and `data/mockTooling.ts` as seed inputs only.

SQLite remains the better long-term production target, but browser-local durable persistence is the safest first step because the repo currently has no backend server, no API route runtime, and no DB dependencies.

### Proposed Files

- `domain/coreTypes.ts`
- `repositories/core/coreRepository.ts`
- `repositories/core/coreSeed.ts`
- `repositories/core/coreValidation.ts`
- `repositories/core/corePolicy.ts`
- `tests/coreRepository.test.ts`
- `tests/CoreProductionFlows.test.tsx`

### Canonical Model Additions

- `CorePart`
- `PartRevision`
- `CoreBOM`
- `CoreBOMNode`
- `CoreBOMSnapshot`
- `DesignMasterPart`
- `ConcretePartMapping`
- `ToolingRecord`
- `ToolingMilestone`
- `CoreSupplier`
- `AVL`
- `AttachmentMetadata`
- `AuditEvent`

### Repository Contract

- Load core workspace snapshot.
- Search/create/update/archive parts.
- Detect duplicate part numbers.
- Resolve part usage in BOMs.
- Create/update/delete BOM nodes.
- Link a BOM node to an existing part revision.
- Create local/custom BOM nodes.
- Create/reload BOM snapshots.
- Create/update design-master parts.
- Map concrete parts to design-master parts.
- Create/update tooling records.
- Update tooling milestones.
- Return tooling links for a part.
- Write and query audit events.

### Validation And Policy

- Validate required part identity fields.
- Validate unique part numbers.
- Validate positive BOM quantities.
- Validate BOM parent existence.
- Validate library part references before linking BOM nodes.
- Validate milestone keys/status transitions.
- Enforce role policy in repository methods for core writes.
- Return typed failures for validation, permission denied, not found, conflict, and persistence errors.

### Wave 1 Test Checklist

- Repository seeds from current mock data.
- Repository persists changes across new repository instances.
- Part update is visible through part search, BOM usage, and tooling relationship queries.
- BOM node linked to a part stores part ID/revision reference, not only part number text.
- Local BOM node can exist without a part reference and is clearly typed.
- Design-master mapping references part IDs and rejects unknown parts.
- Tooling milestone update persists and creates audit event.
- Viewer write attempts fail through policy layer.
- Sourcing can edit commercial fields but not engineering-only fields.
- Engineer can edit engineering metadata but not protected commercial fields.
- Duplicate part numbers fail with a conflict-style error.

### Wave 1 Exit Criteria

- Core model and repository contracts are implemented and tested.
- Runtime data survives app/backend restart at repository level.
- Mock files are no longer described as the production-core source of truth.
- No broad UI rewrite has started before the core contracts are stable.
