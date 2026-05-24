# zBOM Editable EBOM Architecture Handoff

Date: 2026-05-24

## Purpose

This handoff captures the completed editable EBOM Architecture workflow implementation, post-merge verification evidence, and the recommended starting point for the next session.

Use this together with:

- `docs/superpowers/specs/2026-05-23-zbom-editable-ebom-architecture-design.md`
- `docs/superpowers/plans/2026-05-23-zbom-editable-ebom-architecture.md`
- `docs/superpowers/specs/2026-05-23-zbom-phase1-hardening-handoff.md`

## Current Repository State

Primary checkout:

```text
/Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM
```

Current branch:

```text
main
```

Current HEAD before this design-status update:

```text
8374e0b docs: update editable ebom handoff after merge
```

Merge status:

```text
feature/editable-ebom-architecture was fast-forward merged into main.
The feature worktree .worktrees/editable-ebom-architecture was removed.
The local feature/editable-ebom-architecture branch was deleted.
```

Working tree status after merge cleanup, before this handoff refresh:

```text
Only unrelated untracked directories remain:
?? .superpowers/
?? graphify-out/
```

## Completed Scope

The implementation plan in `docs/superpowers/plans/2026-05-23-zbom-editable-ebom-architecture.md` is complete.

Completed tasks:

1. EBOM draft workflow domain types.
2. Async EBOM architecture repository with in-memory adapter.
3. Dedicated Zustand store with load, selection, draft replay, dirty state, repository injection, and error state.
4. Draft mutations for override, lock, unlock, local item creation, item revert, and draft reset.
5. Publishable change package flow with released-base blocking and failure preservation.
6. `EBOMArchitectureWorkspace` refactor to load from store with loading, recoverable load errors, resolver errors, and legacy preview fallback.
7. Editable EBOM UI for row editing, local child items, lock/unlock/revert, change package summary, publish, and reset.
8. Final review fixes for publish/reload persistence, reset failure preservation, unlock inheritance semantics, local item parent validity, quantity validation, and stale error cleanup.

## Status Against 2026-05-22 Platform Redesign

Source design:

```text
docs/superpowers/specs/2026-05-22-zbom-platform-redesign-design.md
```

### Completed Or Largely Completed

The following design expectations now have working Phase 1 coverage:

| Design expectation | Current status | Evidence |
| --- | --- | --- |
| Split the new platform domain away from the old single BOM tree | Largely complete for Phase 1 | `domain/productTypes.ts`, `domain/ebomArchitectureTypes.ts`, `domain/mbomTypes.ts`, `domain/toolingTypes.ts` |
| Split store responsibilities instead of extending only the legacy BOM store | Largely complete for Phase 1 | `stores/useProductConfigStore.ts`, `stores/useEBOMArchitectureStore.ts`, `stores/useMBOMDeltaStore.ts`, `stores/useToolingStore.ts` |
| Add Product Matrix Center | Implemented | `pages/ProductMatrixCenter.tsx`, `tests/ProductMatrixCenter.test.tsx`, `tests/productConfigStore.test.ts` |
| Add EBOM Architecture Workspace using base/inheritance thinking | Implemented and now editable | `pages/EBOMArchitectureWorkspace.tsx`, `stores/useEBOMArchitectureStore.ts`, `utils/ebomInheritance.ts`, EBOM tests |
| Support EBOM inheritance states: inherited, overridden, local, locked | Implemented | `domain/ebomArchitectureTypes.ts`, `utils/ebomInheritance.ts`, `tests/ebomInheritance.test.ts` |
| Allow EBOM overrides, locks, unlocks, local additions, and manual publish/change package semantics | Implemented for in-memory Phase 1 | `stores/useEBOMArchitectureStore.ts`, `repositories/ebomArchitectureRepository.ts`, `tests/ebomArchitectureStore.test.ts` |
| Keep legacy BOM preview read-only and isolated from editable EBOM state | Implemented | `utils/legacyBomAdapter.ts`, `pages/EBOMArchitectureWorkspace.tsx`, `tests/PhaseOneWorkflowPages.test.tsx` |
| Add MBOM Delta Console with SKU-first difference retrieval and grouping by delta type | Implemented as a delta review console | `pages/MBOMDeltaConsole.tsx`, `stores/useMBOMDeltaStore.ts`, `tests/mbomDeltaStore.test.ts` |
| Add Tooling Hub based on Design Master Part / Tooling Subject | Implemented as read-oriented milestone view | `domain/toolingTypes.ts`, `stores/useToolingStore.ts`, `pages/ToolingHub.tsx`, `tests/toolingStore.test.ts` |
| Track tooling milestones for Drawing Release, DFM, Quotation, Kickoff, and T1 | Implemented | `domain/toolingTypes.ts`, `data/mockTooling.ts`, `pages/ToolingHub.tsx` |
| Derive kickoff-to-T1 lead time | Implemented with invalid-date and negative-duration guards | `stores/useToolingStore.ts`, `tests/toolingStore.test.ts` |
| Add navigation and viewer visibility for Phase 1 BOM-facing modules | Implemented | `components/Sidebar.tsx`, `App.tsx`, `tests/AppNavigation.test.tsx` |

### Partially Completed

The following areas exist, but are intentionally narrower than the 2026-05-22 target design:

| Design expectation | Current status | Remaining gap |
| --- | --- | --- |
| Core project should contain two series and two structures under each series | Partially complete | Mock data has two series, but only `series-zp-a` has structures; second-series expansion is represented by `baseSeriesId` only, not a full UI workflow. |
| Product Matrix should generate candidates and allow manual activation/freezing/suppression | Partially complete | Store has `generateCandidateSKUs`, `activateSKU`, `freezeSKU`, and `suppressSKU`; page shows existing mock SKUs and actions, but does not yet expose a generate-candidates action. |
| SKU freezing should connect to ReleasedMBOM | Partially complete | SKU status can become `frozen`; `ReleasedMBOM` is only a type in `domain/mbomTypes.ts`, with no release store, snapshot generation, or audit workflow. |
| EBOMBase minimum fields | Partially complete | Implemented fields support Phase 1 inheritance; design fields such as `scopeType`, `scopeId`, and `syncMode` are represented differently or absent. |
| EBOMItem minimum fields | Partially complete | Implemented editable fields cover part number, name, revision, quantity, unit, inheritance state, and `designMasterPartId`; `description` and `itemType` are not present. |
| Product / Series / Structure / Variation / SKU minimum fields | Partially complete | Current types are simplified: several design fields such as owner, description, status, sequence, notes, axis type, active flag, `releasedMbomId`, and `isGenerated` naming are absent or represented differently. |
| MBOM delta pack/item minimum fields | Partially complete | Current model is SKU-based and supports typed items; design fields for base/target scope typing, old quantity, replacement part number naming, and effective axes are simplified. |
| Tooling and DesignMasterPart minimum fields | Partially complete | Current model supports DMP, concrete part numbers, supplier, cavity count, milestones, and lead time; fields such as seriesId, category, status, toolingStrategy, owner, target SOP date, overallStatus, and explicit L/T milestone field are not yet modeled. |
| Tooling daily operation with impact scope | Partially complete | User can select a Design Master Part and view records; affected structures/SKUs and risk prioritization are not computed. |
| MBOM full preview expansion | Placeholder only | `MBOMDeltaConsole` explicitly marks full MBOM preview as a later phase. |

### Not Yet Implemented

The following design expectations remain open:

| Design expectation | Current status |
| --- | --- |
| Release and Change Control module for freezing `ReleasedMBOM` | Not implemented beyond `ReleasedMBOM` type and SKU `frozen` status. |
| `useReleaseStore` or equivalent release workflow store | Not implemented. |
| Frozen full MBOM outputs for selected key SKUs | Not implemented. |
| Impact analysis for base/delta changes | Not implemented: no affected structures, affected SKUs, affected released MBOMs, or locked-object confirmation workflow. |
| Prevention of all full SKU BOM editing outside delta logic | Not complete globally: legacy `BOMEditor` remains available as a transitional module. |
| Full project initialization workflow | Not implemented: current project, series, structures, axes, SKUs, EBOM bases, MBOM deltas, and tooling are seeded mock data. |
| Second-series expansion workflow | Not implemented beyond mock `series-zp-b` with `baseSeriesId`. |
| Backend persistence | Not implemented; only EBOM has a repository port backed by an in-memory adapter. |
| Approval workflow, ERP integration, external system integration, and advanced reporting | Intentionally postponed by the 2026-05-22 design and still not implemented. |

Priority adjustment after user feedback:

```text
Do not start the next batch with Release and Change Control, Tooling expansion, or backend persistence.
The next development target should make the EBOM/MBOM-related workflow realistic enough for real user testing.
```

## Commits

Implementation commits after the finalized plan, now integrated into `main`:

```text
224d481 feat: add ebom draft workflow types
ff63460 feat: add ebom architecture repository
56f95ce feat: add ebom architecture store shell
30ce934 feat: add ebom draft mutations
59236d5 feat: publish ebom change packages
2df1552 feat: load ebom architecture page from store
86db60b feat: add editable ebom architecture workflow
a2d704f test: wait for async ebom navigation
ac2fa73 fix: harden editable ebom draft workflow
```

Earlier supporting design and plan commits on the same branch:

```text
45c311e docs: refine editable ebom publish contract
9ed622f docs: add editable ebom implementation plan
1dcd8ad docs: address editable ebom plan review
9b56690 docs: refine editable ebom plan contracts
```

## Verification Completed

Final verification was run directly from `main` after the feature branch was merged and the feature worktree was removed.

Focused EBOM verification:

```bash
npx vitest run tests/ebomArchitectureRepository.test.ts tests/ebomArchitectureStore.test.ts tests/PhaseOneWorkflowPages.test.tsx tests/legacyBomAdapter.test.ts tests/ebomInheritance.test.ts
```

Result:

```text
5 test files passed
53 tests passed
```

Full test suite:

```bash
npx vitest run
```

Result:

```text
16 test files passed
102 tests passed
```

Production build:

```bash
npm run build
```

Result:

```text
passed
```

Known non-blocking warnings observed during successful verification:

```text
Vitest emits Node localStorage experimental warnings in jsdom-related tests.
tests/AppNavigation.test.tsx emits existing Recharts chart-size warnings under jsdom.
npm run build emits a Vite chunk-size warning for the main JS bundle.
npm run build emits a Node DEP0205 module.register deprecation warning.
```

Note:

```text
One verification run before worktree cleanup scanned both the main checkout and .worktrees/editable-ebom-architecture, producing duplicate counts of 32 files and 204 tests. After cleanup, the final main-only run returned 16 files and 102 tests.
```

## Important Implementation Notes

### Domain and Repository

New workflow types are in:

```text
domain/ebomArchitectureTypes.ts
```

New repository port and in-memory implementation are in:

```text
repositories/ebomArchitectureRepository.ts
```

Repository behavior:

- `loadSnapshot()` returns cloned bases, items, and change records.
- `loadDraftOperations(baseId)` and `saveDraftOperations(baseId, operations)` clone draft state to avoid mutable leakage.
- `publishChangePackage(input)` records a change package, clears persisted drafts for the base, moves draft bases to review, and now applies draft operations into the in-memory item snapshot so published edits survive reload.

### Store

The editable workflow store is:

```text
stores/useEBOMArchitectureStore.ts
```

Key behavior:

- The page calls `load()` when the store is idle.
- Persisted drafts are replayed over a clean snapshot during load.
- Draft save failures preserve local dirty state and operations.
- Publish failures preserve dirty state and operations.
- Reset failures preserve local dirty state and operations.
- Released bases reject edit and publish actions.
- Selecting a base clears stale repository errors.
- Invalid numeric quantity input is rejected before a draft operation is recorded.

### Inheritance Resolver

Updated:

```text
utils/ebomInheritance.ts
```

Important semantic change:

- `locked` items still merge source values and keep explicitly locked local fields.
- `inherited` items with `sourceItemId` now merge source values while preserving local identity fields.
- Unlocking the final locked field moves the item back to `inherited`, allowing source values to flow again.

### Page Workflow

Updated:

```text
pages/EBOMArchitectureWorkspace.tsx
```

The page now has:

- store-backed load, selection, and resolved rows.
- loading and recoverable load error states.
- resolver and legacy-preview fallback errors.
- resolved EBOM row editing for editable fields.
- quantity validation for edit and local item forms.
- local child item creation with parent reset on base changes.
- lock, unlock, and item draft revert actions.
- change package panel with pending operation count, publish, reset, and error display.
- read-only legacy preview through `BOMTable` with `enableColumnControls={false}` and `enableWhereUsed={false}`.

## Review Outcome

Subagent review found two critical issues and several important issues after the first full implementation pass.

Fixed issues:

- Published EBOM item edits were lost after reload because repository publish did not apply operations to the item snapshot.
- Failed draft reset cleared local state before persistence succeeded.
- Unlocking a locked inherited field did not restore source values.
- Local item parent selection could remain stale after base changes.
- Invalid quantities could be converted to invalid numeric state.
- Stale errors could remain visible after switching bases.
- Released bases still exposed active edit controls in the UI.

Regression tests were added for the fixed behaviors.

## Files Changed

Core workflow:

```text
domain/ebomArchitectureTypes.ts
repositories/ebomArchitectureRepository.ts
stores/useEBOMArchitectureStore.ts
utils/ebomInheritance.ts
pages/EBOMArchitectureWorkspace.tsx
```

Tests:

```text
tests/ebomArchitectureRepository.test.ts
tests/ebomArchitectureStore.test.ts
tests/PhaseOneWorkflowPages.test.tsx
tests/AppNavigation.test.tsx
```

Planning and handoff:

```text
docs/superpowers/specs/2026-05-23-zbom-editable-ebom-architecture-design.md
docs/superpowers/plans/2026-05-23-zbom-editable-ebom-architecture.md
docs/superpowers/specs/2026-05-24-zbom-editable-ebom-architecture-handoff.md
```

## Suggested Next Steps

### Next Goal: EBOM/MBOM User-Testable Workflow

The next development batch should prioritize getting EBOM and MBOM modules to a realistic trial state. The success criterion is not production completeness; it is whether real users can run through representative EBOM/MBOM tasks and reveal workflow, data, terminology, and usability problems.

1. Re-run verification from `main` before starting the next implementation batch:

```bash
npx vitest run
npm run build
```

2. Leave `.superpowers/` and `graphify-out/` alone unless the user explicitly asks to clean or inspect them.

3. Build an EBOM-to-MBOM user test path:

```text
Select project/SKU -> inspect EBOM inheritance source -> edit or publish EBOM draft -> inspect MBOM delta packs for the same SKU -> preview the resulting base-plus-delta MBOM.
```

4. Replace the MBOM full-preview placeholder with a working base-plus-delta composition preview.

Minimum behavior:

```text
Resolve selected SKU -> determine base structure -> load base manufacturing structure or EBOM-derived preview -> apply delta items in display order -> show composed rows with source markers: base, delta add, delta remove, delta replace, quantity change, manufacturing-only, packaging/label/regional.
```

5. Connect Product Matrix, EBOM Architecture, and MBOM Delta around the same selected SKU/context.

Minimum behavior:

```text
When a user chooses a SKU, the EBOM view and MBOM view should make it clear which project, series, structure, EBOM base, and delta pack are in scope.
```

6. Improve EBOM/MBOM test data for realistic user testing.

Minimum data additions:

```text
At least two structures with meaningful EBOM differences.
At least several SKUs spanning active, candidate, suppressed, and frozen states.
At least several MBOM delta packs covering add, remove, replace, quantity change, manufacturing-only material, and packaging/label/regional changes.
At least one locked EBOM item and one inherited item whose source change is visible in a child base.
```

7. Add a lightweight user-test support surface.

Minimum behavior:

```text
Provide a short in-app or documented test script with 5-8 user tasks.
Expose enough state and labels for observers to capture where users get confused.
Do not build heavy analytics yet; simple manual observation notes are enough for this phase.
```

8. Defer these areas unless they directly block EBOM/MBOM user testing:

```text
Release and Change Control module.
useReleaseStore.
Frozen ReleasedMBOM snapshot workflow.
Tooling risk dashboard, impact scope, filters, and editable milestone details.
Backend persistence and external integrations.
```

9. Backend persistence remains out of scope for this phase. If persistence becomes necessary for user testing, keep it narrow and adapter-based; do not wire UI or store code directly to transport calls.
