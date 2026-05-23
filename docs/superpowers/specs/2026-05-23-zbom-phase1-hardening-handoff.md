# zBOM Phase 1 Hardening Handoff

Date: 2026-05-23

## Purpose

This handoff captures the completed Phase 1 hardening and EBOM preview integration work, plus the recommended starting point for the next development session.

Use this together with:

- `README.md`
- `docs/superpowers/specs/2026-05-22-zbom-platform-redesign-design.md`
- `docs/superpowers/specs/2026-05-22-zbom-session-handoff.md`
- `docs/superpowers/specs/2026-05-22-zbom-phase1-implementation-handoff.md`
- `docs/superpowers/plans/2026-05-23-zbom-phase-1-hardening-ebom-preview.md`

## Current Repository State

Current branch:

```text
main
```

Current HEAD:

```text
4fb6b08368d595bbca9bbbd6fe26a36d2acfbaba fix: isolate ebom preview table controls
```

Working tree status at handoff creation:

```text
clean
```

The implementation was completed directly on `main` through the following commits:

```text
443541c docs: add phase 1 hardening plan
d08dc1d test: cover phase one navigation
3a9108d test: assert tooling hub navigation title
4202afe test: match tooling hub navigation spec
533b384 fix: harden ebom legacy adapter
b6e9f70 test: cover unique ebom parent cycle
2bde8a1 feat: add read-only ebom legacy preview
b7e7bdc test: scope ebom preview assertions
84d9fd0 fix: normalize invalid tooling lead time
4fb6b08 fix: isolate ebom preview table controls
```

## Runtime Status

The Vite dev server was started from the repository root during verification.

Local URL:

```text
http://localhost:3000/
```

Observed network URLs:

```text
http://192.168.2.90:3000/
http://100.110.251.37:3000/
http://198.18.0.1:3000/
```

Access check completed:

```text
curl -I http://localhost:3000/
HTTP/1.1 200 OK
```

If the next session cannot access the server, restart it from the repository root with:

```bash
npm run dev
```

## Verification Completed

The following verification commands passed after the final fix:

```bash
npx vitest run
npm run build
```

Final test result:

```text
14 test files passed
72 tests passed
```

Build result:

```text
passed
```

Known warnings:

```text
tests/AppNavigation.test.tsx emits Recharts jsdom chart-size warnings.
npm run build emits Vite chunk-size warning for the main JS bundle.
```

Both warnings were present during successful verification and are not blocking the current handoff.

## Completed Scope

The full plan in `docs/superpowers/plans/2026-05-23-zbom-phase-1-hardening-ebom-preview.md` is complete.

Completed tasks:

1. Route and sidebar regression tests
2. `legacyBomAdapter` metadata and cycle hardening
3. Read-only EBOM legacy preview integration
4. Negative tooling lead-time normalization
5. Full verification and final review fixes

## Files Changed

Navigation regression coverage:

```text
tests/AppNavigation.test.tsx
```

EBOM legacy adapter hardening:

```text
utils/legacyBomAdapter.ts
tests/legacyBomAdapter.test.ts
```

Read-only EBOM preview:

```text
components/BOMTable.tsx
pages/EBOMArchitectureWorkspace.tsx
tests/PhaseOneWorkflowPages.test.tsx
```

Tooling lead-time normalization:

```text
stores/useToolingStore.ts
tests/toolingStore.test.ts
```

Planning and handoff:

```text
docs/superpowers/plans/2026-05-23-zbom-phase-1-hardening-ebom-preview.md
docs/superpowers/specs/2026-05-23-zbom-phase1-hardening-handoff.md
```

## Important Implementation Notes

### Navigation Coverage

Added `tests/AppNavigation.test.tsx`.

Coverage:

- Product Matrix sidebar route
- EBOM Architecture sidebar route
- MBOM Delta sidebar route
- Tooling Hub sidebar route
- Viewer-role visibility for the four Phase 1 BOM-facing modules

No production navigation changes were needed.

### Legacy Adapter Hardening

Updated:

```text
utils/legacyBomAdapter.ts
```

Behavior:

- EBOM metadata now appears under `BOMNode.customAttributes.zbom`.
- Adapter still does not import stores.
- Adapter still does not write back to EBOM or legacy BOM state.
- Adapter now detects reachable item-parent cycles and throws a clear error.

Metadata shape:

```ts
customAttributes: {
  zbom: {
    baseId: string;
    sourceItemId?: string;
    sourceBaseId?: string;
    inheritanceState: EBOMItem['inheritanceState'];
    designMasterPartId?: string;
    lockedFields?: EBOMItem['lockedFields'];
  }
}
```

Cycle test now uses unique item IDs:

```text
root -> child-a -> child-b -> root
```

### EBOM Architecture Preview

Updated:

```text
pages/EBOMArchitectureWorkspace.tsx
components/BOMTable.tsx
```

The EBOM Architecture Workspace now renders a `Legacy BOM Preview` section below the resolved items table.

Preview data flow:

```text
selected EBOMBase
-> resolveEBOMBase(...)
-> toLegacyBOMNode(resolvedItems, selectedBase.rootItemId)
-> BOMTable
```

Boundary:

- preview is read-only
- selection is local React state only
- no write-back to EBOM architecture data
- no write-back to `useBOMStore`
- preview passes `enableColumnControls={false}`
- preview passes `enableWhereUsed={false}`

The last two props are important. They prevent the preview from:

- opening `WhereUsedModal`, which is backed by legacy BOM data
- mutating persisted `useViewStore` column preferences shared with legacy BOM pages

### BOMTable Compatibility

Updated:

```text
components/BOMTable.tsx
```

New optional props:

```ts
initialExpandedIds?: string[];
enableColumnControls?: boolean;
enableWhereUsed?: boolean;
```

Defaults preserve legacy behavior:

```text
enableColumnControls = true
enableWhereUsed = true
```

Existing legacy BOM table callers keep:

- global column control behavior
- Where Used affordance
- existing default expansion IDs

EBOM preview opts out of legacy-only affordances.

`Collapse All` now uses `initialExpandedIds` when supplied, instead of always resetting to hard-coded `root`.

### Tooling Lead Time

Updated:

```text
stores/useToolingStore.ts
```

Behavior:

- `getLeadTimeDays` still uses actual date first, planned date fallback.
- missing or invalid Kickoff/T1 date still returns `null`.
- positive Kickoff-to-T1 values still return rounded day count.
- negative Kickoff-to-T1 values now return `null`.

This means bad milestone data is surfaced as unknown lead time instead of a negative duration.

## Review Notes

Implementation followed subagent-driven development with per-task spec and quality reviews.

The final review originally found two important coupling risks in the EBOM preview:

1. `Where Used` would read from the legacy BOM store.
2. `Columns` would mutate persisted legacy view preferences.

Both were fixed in:

```text
4fb6b08 fix: isolate ebom preview table controls
```

Final review after the fix found no critical or important issues.

## Manual QA Checklist For Next Session

Use:

```text
http://localhost:3000/
```

Check existing legacy pages still render:

- Dashboard
- BOM Editor
- Compare Revisions
- Part Library
- Supply Chain
- ECO Manager

Check Phase 1 pages:

- Product Matrix
- EBOM Architecture
- MBOM Delta
- Tooling Hub

EBOM Architecture specific checks:

- base selector changes inheritance chain
- resolved item list changes by selected base
- `Legacy BOM Preview` appears below resolved items
- preview rows update when base changes
- preview does not show `Columns`
- preview does not show `Where Used`
- selecting a preview row only highlights the preview row

Tooling Hub specific checks:

- design master part selector changes tooling records
- Kickoff-to-T1 still shows positive values where valid
- invalid negative Kickoff-to-T1 data would display `TBD`

## Recommended Next Session Goal

Recommended next goal:

```text
Start editable EBOM Architecture workflow planning.
```

Suggested next plan:

```text
docs/superpowers/plans/YYYY-MM-DD-zbom-editable-ebom-architecture.md
```

Recommended scope:

1. Create or introduce a focused EBOM architecture store if needed.
2. Add controlled local override actions.
3. Add controlled lock/unlock actions.
4. Add store/resolver tests before UI editing.
5. Add UI editing only after mutation behavior is stable.

Important boundary to preserve:

```text
new EBOM domain state remains separate from legacy useBOMStore
legacy BOMNode remains a read-only compatibility target for previews
```

## Out Of Scope From Completed Work

The following remain intentionally unimplemented:

- editable EBOM override workflow
- editable EBOM lock/unlock workflow
- backend persistence
- release/change-control workflow
- full SKU-specific MBOM generation
- bundle-size optimization
- Recharts jsdom warning cleanup

## Key Rule For Next Session

Do not collapse the new domain model back into legacy `BOMNode`.

The intended architecture remains:

```text
new domain stores for new workflows
legacy useBOMStore for existing pages
legacyBomAdapter only for read-only compatibility
```
