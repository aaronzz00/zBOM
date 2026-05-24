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

Integrated implementation HEAD before this handoff refresh:

```text
99344eb docs: add editable ebom handoff
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

1. Re-run verification from `main` before starting the next implementation batch:

```bash
npx vitest run
npm run build
```

2. Leave `.superpowers/` and `graphify-out/` alone unless the user explicitly asks to clean or inspect them.

3. Backend persistence remains out of scope for this phase. The next backend-facing phase should replace the in-memory repository through the existing repository interface rather than wiring UI or store code directly to transport calls.
