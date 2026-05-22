# zBOM Phase 1 Implementation Handoff

Date: 2026-05-22

## Purpose

This handoff captures the completed Phase 1 implementation work and provides the recommended starting point for the next development session.

Use this together with:

- `README.md`
- `docs/superpowers/specs/2026-05-22-zbom-platform-redesign-design.md`
- `docs/superpowers/specs/2026-05-22-zbom-session-handoff.md`
- `docs/superpowers/plans/2026-05-22-zbom-phase-1-platform-redesign.md`

## Current Repository State

The Phase 1 platform-redesign implementation plan has been completed and merged into `main`.

Current branch:

```text
main
```

Current HEAD:

```text
3e9dfc1 feat: add ebom legacy adapter
```

Working tree status before this handoff document:

```text
clean
```

The feature worktree used for implementation was removed after merge.

## Runtime Status

The app was started in the main working directory for manual testing.

Dev server:

```text
npm run dev
```

Local URL:

```text
http://localhost:3000/
```

Network URL observed:

```text
http://192.168.240.143:3000/
```

If a new session cannot access the server, restart it from the repository root with:

```bash
npm run dev
```

## Verification Completed

After merging into `main`, the following commands passed:

```bash
npx vitest run
npm run build
```

Final test result:

```text
13 test files passed
68 tests passed
```

Build result:

```text
passed
```

Known warning:

```text
Some chunks are larger than 500 kB after minification.
```

This warning already existed as a known frontend bundle-size concern and is not blocking current manual testing.

## Completed Phase 1 Scope

The following plan tasks are complete:

1. Product configuration domain types
2. Product configuration mock data
3. Product configuration store and tests
4. Product Matrix Center page and routing
5. EBOM architecture domain model and mock data
6. EBOM inheritance resolver and tests
7. SKU-first MBOM delta store and tests
8. Tooling subject store and tests
9. Phase 1 workflow pages and routing
10. EBOM-to-legacy BOM adapter and tests

## New Domain Files

Product configuration:

```text
domain/productTypes.ts
data/mockProductConfig.ts
stores/useProductConfigStore.ts
```

EBOM architecture:

```text
domain/ebomArchitectureTypes.ts
data/mockEBOMArchitecture.ts
utils/ebomInheritance.ts
```

MBOM delta:

```text
domain/mbomTypes.ts
data/mockMBOMDeltas.ts
stores/useMBOMDeltaStore.ts
```

Tooling:

```text
domain/toolingTypes.ts
data/mockTooling.ts
stores/useToolingStore.ts
```

Compatibility:

```text
utils/legacyBomAdapter.ts
```

## New Pages

The following Phase 1 modules are now routed through `App.tsx` and visible from the sidebar:

```text
pages/ProductMatrixCenter.tsx
pages/EBOMArchitectureWorkspace.tsx
pages/MBOMDeltaConsole.tsx
pages/ToolingHub.tsx
```

Route IDs:

```text
product-matrix
ebom-architecture
mbom-delta
tooling
```

Sidebar labels:

```text
Product Matrix
EBOM Architecture
MBOM Delta
Tooling Hub
```

All four currently use `Permission.VIEW_BOM` for visibility.

## Test Files Added

```text
tests/productConfigStore.test.ts
tests/ProductMatrixCenter.test.tsx
tests/ebomInheritance.test.ts
tests/mbomDeltaStore.test.ts
tests/toolingStore.test.ts
tests/PhaseOneWorkflowPages.test.tsx
tests/legacyBomAdapter.test.ts
```

## Important Implementation Notes

### Product Configuration

Implemented model:

```text
ProjectProgram -> ProductSeries -> ProductStructure -> VariationAxis / VariationOption -> SKU
```

Store:

```text
stores/useProductConfigStore.ts
```

Capabilities:

- active project state
- candidate / active / frozen / suppressed SKU states
- SKU activation
- SKU freeze
- SKU suppression
- generated candidate SKU calculation
- project/structure SKU selectors

### EBOM Architecture

Implemented model:

```text
Project Platform Base -> Series Base -> Structure Base
```

Resolver:

```text
utils/ebomInheritance.ts
```

Capabilities:

- inheritance chain resolution
- missing base error
- missing parent base error
- cycle detection
- inherited item resolution
- override replacement
- local item inclusion
- locked item merge
- locked field preservation
- override summary counts

Important fix already made:

- Locked item merge now starts from source item, overlays local identity/context, and only preserves local values for locked fields.
- This prevents stale local-only optional fields from surviving when not locked.

### MBOM Delta

Implemented model:

```text
MBOMDeltaPack
MBOMDeltaItem
ReleasedMBOM
```

Store:

```text
stores/useMBOMDeltaStore.ts
```

Capabilities:

- SKU-first delta pack lookup
- SKU-first delta item lookup
- grouping delta items by exact delta type
- reset to mock state

Mock delta types include:

```text
manufacturing-only-material
packaging-label-regional
quantity-change
```

### Tooling

Implemented model:

```text
DesignMasterPart -> Tooling -> ToolingMilestone
```

Store:

```text
stores/useToolingStore.ts
```

Capabilities:

- tooling lookup by DesignMasterPart
- milestone update
- L/T calculation

L/T definition:

```text
Kickoff -> T1
```

Date selection:

```text
actualDate first, plannedDate fallback
```

### Legacy Adapter

Adapter:

```text
utils/legacyBomAdapter.ts
```

Purpose:

- Projects resolved EBOM items into legacy `BOMNode` shape.
- Intended for future read-only reuse of existing BOM tree/table components.
- Does not import stores.
- Does not write back to EBOM state.

Current behavior:

- builds nested `BOMNode` tree from flat `EBOMItem[]`
- selects root by `rootItemId`
- preserves key EBOM fields
- sets legacy defaults
- maps inheritance metadata into `customAttributes`
- excludes unrelated/orphan items outside selected root

## Existing Legacy Pages Preserved

The following legacy modules still compile and are still backed by the existing `useBOMStore` / `BOMNode` path:

```text
Dashboard
BOM Editor
Compare Revisions
Part Library
Supply Chain
ECO Manager
```

No broad rewrite of `useBOMStore`, `BOMEditor`, `BOMTable`, `BOMMatrix`, or `BOMFlatView` was done in this phase.

## Residual Non-Blocking Notes

1. Bundle-size warning remains.

The JS bundle is above Vite's default warning threshold. This is not a functional failure.

2. Some store selectors return live references.

Current state is acceptable for prototype workflow pages. Future interactive UI should mutate only through store actions.

3. `Tooling` negative L/T is not guarded.

If T1 is before Kickoff, current store can return a negative number. Future UI can decide whether to display as bad-data signal or normalize to `null`.

4. `legacyBomAdapter` assumes acyclic item parent relationships.

The EBOM inheritance resolver guards inheritance-base cycles, but the adapter does not currently guard malformed item parent cycles.

5. Phase 1 pages are workflow shells.

They are intentionally read-only/light-interaction views. They are not yet production editing workflows.

## Recommended Next Session Goal

Recommended next goal:

```text
Start Phase 1 hardening and workflow integration.
```

Suggested options:

1. Manual QA pass on the newly added pages.
2. Harden known residual risks.
3. Start editable EBOM Architecture workflow.
4. Connect resolved EBOM preview to existing BOM table components via `legacyBomAdapter`.

## Suggested Manual QA Checklist

Use `http://localhost:3000/`.

Check existing pages still work:

- Dashboard
- BOM Editor
- Compare Revisions
- Part Library
- Supply Chain
- ECO Manager

Check new pages:

- Product Matrix
- EBOM Architecture
- MBOM Delta
- Tooling Hub

Product Matrix:

- Candidate SKU can activate.
- Non-suppressed SKU can freeze.
- Frozen SKU cannot suppress from UI.
- Suppressed SKU is displayed as suppressed.

EBOM Architecture:

- Base selector changes inheritance chain.
- Resolved item list changes by selected base.
- Inheritance badges display inherited / overridden / local / locked.

MBOM Delta:

- SKU selector is SKU-first.
- Delta packs appear for SKU with deltas.
- Delta item groups display by type.
- Full MBOM preview is a placeholder only.

Tooling Hub:

- Design Master Part selector changes detail.
- Concrete part numbers display under selected design subject.
- Tooling records display milestone state.
- L/T displays Kickoff -> T1 days or `Unknown`.

## Suggested Next Implementation Plan

If continuing development, create a new plan for one of these slices:

### Option A: Hardening Slice

- Add route/sidebar integration tests.
- Add cycle guard to `legacyBomAdapter`.
- Namespace EBOM metadata inside legacy `customAttributes`, for example under `zbom`.
- Decide policy for negative tooling L/T.
- Add selectors or shallow subscriptions to reduce full-store re-renders.

### Option B: EBOM Preview Integration Slice

- Use `resolveEBOMBase` + `toLegacyBOMNode`.
- Add read-only legacy BOM tree preview inside `EBOMArchitectureWorkspace`.
- Do not enable write-back yet.
- Add tests for adapter-driven preview.

### Option C: Editable EBOM Architecture Slice

- Add controlled override/lock actions to a dedicated EBOM architecture store.
- Keep changes separate from legacy `useBOMStore`.
- Add tests for lock and override mutations.

## Key Rule For Next Session

Do not collapse the new domain model back into legacy `BOMNode`.

The current architecture intentionally keeps:

```text
new domain stores for new workflows
legacy useBOMStore for existing pages
adapter only for read-only compatibility
```

