# zBOM EBOM/MBOM User-Testable Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a realistic EBOM-to-MBOM trial workflow so users can select a SKU, inspect the scoped EBOM, publish draft EBOM changes, review MBOM deltas for that same SKU, and preview the composed MBOM.

**Architecture:** Keep the Phase 1 in-memory, adapter-based architecture. Add a shared product workflow selection slice to the product config store, resolve EBOM bases from selected SKU structure context, and add a pure MBOM composition utility consumed by the MBOM delta store and page. Do not add release control, backend persistence, external integrations, or git-tracked real customer data in this batch.

**Tech Stack:** React 18, TypeScript, Zustand, Vitest, Testing Library, Vite, Tailwind CSS, lucide-react.

---

## Scope

This plan is based on `docs/superpowers/specs/2026-05-24-zbom-editable-ebom-architecture-handoff.md`.

In scope:

- Shared selected SKU context across Product Matrix, EBOM Architecture, and MBOM Delta.
- EBOM Architecture defaults and labels that make selected project, series, structure, EBOM base, and SKU scope visible.
- Working MBOM full preview that composes base EBOM-derived rows plus delta packs.
- More realistic mock data for user testing, including delta types currently missing from seed data.
- A short manual user-test script in docs.
- Focused tests and final verification.

Out of scope:

- Release and Change Control.
- `useReleaseStore`.
- Frozen ReleasedMBOM snapshot workflow.
- Tooling risk dashboard expansion.
- Backend persistence.
- ERP, approval workflow, or external system integration.

Real Feishu/Lark data note:

- The user supplied `https://orka.feishu.cn/wiki/OxoCw7rfZi4FTTk42vZc7lXhntd?table=tblYVia8cz3ge6s5&view=vew7timWwM` as optional verification data.
- If used, export or transform it only into local ignored paths, preferably under `.agent/real-data/`.
- Do not commit, snapshot, paste wholesale, or upload that data to git.
- Interpret `Audio Frame` and `Hearing Frame` as model flags: each represents one model, and checked/unchecked means whether the row is used in that model.

## File Structure

Modify:

- `domain/productTypes.ts`
  - Add a small workflow context type only if useful for store typing.
- `domain/mbomTypes.ts`
  - Add composed MBOM row types and source markers.
- `data/mockProductConfig.ts`
  - Add realistic SKUs and second-structure coverage while staying synthetic.
- `data/mockMBOMDeltas.ts`
  - Add delta packs/items covering add, remove, replace, quantity-change, manufacturing-only, and packaging/label/regional.
- `data/mockEBOMArchitecture.ts`
  - Add enough EBOM item differences to make STD vs PRO and inherited vs locked behavior visible.
- `stores/useProductConfigStore.ts`
  - Add selected workflow SKU state and selectors/actions.
- `stores/useMBOMDeltaStore.ts`
  - Add composed MBOM preview selector.
- `pages/ProductMatrixCenter.tsx`
  - Let users choose the active workflow SKU from the matrix.
- `pages/EBOMArchitectureWorkspace.tsx`
  - Bind default EBOM base/context display to selected SKU structure.
- `pages/MBOMDeltaConsole.tsx`
  - Use the shared selected SKU and replace placeholder preview with composed rows.
- `tests/productConfigStore.test.ts`
  - Add shared selected SKU coverage.
- `tests/mbomDeltaStore.test.ts`
  - Add composition behavior coverage.
- `tests/PhaseOneWorkflowPages.test.tsx`
  - Add cross-page user-test workflow coverage.
- `tests/ProductMatrixCenter.test.tsx`
  - Add select-workflow-SKU UI coverage.

Create:

- `utils/mbomComposition.ts`
  - Pure function for composing EBOM-derived base rows with ordered delta rows.
- `tests/mbomComposition.test.ts`
  - Unit tests for all delta types and source markers.
- `docs/user-tests/2026-05-24-ebom-mbom-trial-script.md`
  - Manual 5-8 step observer script.

Do not modify unless a test forces it:

- `repositories/ebomArchitectureRepository.ts`
- `components/BOMTable.tsx`
- Tooling files.

## Task 0: Baseline Verification

**Files:**
- Read only: current repository.

- [ ] **Step 1: Check worktree**

Run:

```bash
git status --short
```

Expected: only known unrelated untracked directories such as `.superpowers/` and `graphify-out/`, unless the user has added more work.

- [ ] **Step 2: Run baseline tests**

Run:

```bash
npx vitest run
```

Expected: `16 test files passed` and `102 tests passed` before implementation. If counts differ because new tests already exist, inspect failures before continuing.

- [ ] **Step 3: Run baseline build**

Run:

```bash
npm run build
```

Expected: build passes. Existing Vite chunk-size and Node deprecation warnings are non-blocking.

- [ ] **Step 4: Commit only if baseline docs changed**

Usually no commit for this task.

## Task 1: Shared Workflow SKU Context

**Files:**
- Modify: `domain/productTypes.ts`
- Modify: `stores/useProductConfigStore.ts`
- Test: `tests/productConfigStore.test.ts`

- [ ] **Step 1: Write failing store tests**

Add tests for:

```ts
it('tracks the selected workflow SKU and resolves its context', () => {
  const store = useProductConfigStore.getState();

  store.selectWorkflowSKU('sku-zp-a-pro-blk-us-rtl');

  expect(useProductConfigStore.getState().selectedWorkflowSKUId).toBe('sku-zp-a-pro-blk-us-rtl');
  expect(useProductConfigStore.getState().getSelectedWorkflowSKUContext()).toMatchObject({
    sku: { id: 'sku-zp-a-pro-blk-us-rtl' },
    structure: { id: 'structure-zp-a-pro' },
    series: { id: 'series-zp-a' },
    project: { id: 'project-zphone-2026' },
  });
});
```

Also add a reconciliation test: when active project changes and selected SKU is no longer in scope, the selector returns the first SKU in the active project.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run tests/productConfigStore.test.ts
```

Expected: FAIL because `selectedWorkflowSKUId`, `selectWorkflowSKU`, and `getSelectedWorkflowSKUContext` do not exist.

- [ ] **Step 3: Add workflow context types**

In `domain/productTypes.ts`, add:

```ts
export interface SelectedWorkflowSKUContext {
  sku: SKU;
  project: ProjectProgram;
  series: ProductSeries;
  structure: ProductStructure;
}
```

- [ ] **Step 4: Implement product store state and selectors**

In `stores/useProductConfigStore.ts`, add to `ProductConfigState`:

```ts
selectedWorkflowSKUId: string;
selectWorkflowSKU: (skuId: string) => void;
getSelectedWorkflowSKUContext: () => SelectedWorkflowSKUContext | null;
```

Initialize `selectedWorkflowSKUId` from `mockSKUs[0]?.id ?? ''`.

Implement:

```ts
selectWorkflowSKU: (skuId: string) => {
  set((state) => ({
    selectedWorkflowSKUId: state.skus.some((sku) => sku.id === skuId) ? skuId : state.selectedWorkflowSKUId,
  }));
},
```

Implement `getSelectedWorkflowSKUContext()` by resolving selected SKU, active project, series, and structure. If the selected SKU is not in `activeProjectId`, fall back to the first SKU for that active project. Return `null` if any required context is missing.

- [ ] **Step 5: Run store tests**

Run:

```bash
npx vitest run tests/productConfigStore.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add domain/productTypes.ts stores/useProductConfigStore.ts tests/productConfigStore.test.ts
git commit -m "feat: add shared workflow sku context"
```

## Task 2: Realistic Synthetic EBOM/MBOM Trial Data

**Files:**
- Modify: `data/mockProductConfig.ts`
- Modify: `data/mockEBOMArchitecture.ts`
- Modify: `data/mockMBOMDeltas.ts`
- Test: `tests/productConfigStore.test.ts`
- Test: `tests/mbomDeltaStore.test.ts`

- [ ] **Step 1: Write failing data expectations**

In `tests/mbomDeltaStore.test.ts`, add expectations that seed data includes all delta types:

```ts
expect(new Set(useMBOMDeltaStore.getState().deltaItems.map((item) => item.type))).toEqual(new Set([
  'add',
  'remove',
  'replace',
  'quantity-change',
  'manufacturing-only-material',
  'packaging-label-regional',
]));
```

In `tests/productConfigStore.test.ts`, assert there are active, candidate, suppressed, and frozen SKUs across at least two structures.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run tests/productConfigStore.test.ts tests/mbomDeltaStore.test.ts
```

Expected: FAIL because current MBOM seed data lacks `add`, `remove`, and `replace` deltas.

- [ ] **Step 3: Extend synthetic product config**

Keep current project. Add enough synthetic SKU rows to cover:

- Standard active and frozen SKUs.
- Pro candidate and suppressed SKUs.
- At least one Pro active SKU for MBOM preview.

Use synthetic IDs only. Do not encode real Feishu row contents.

- [ ] **Step 4: Extend EBOM architecture seed**

Add one or two synthetic EBOM items that make composition visible:

- A base packaging label item that a delta can replace.
- A screw or bracket item that a quantity-change delta can update.
- A Pro-only local component already present in `ebom-structure-zp-a-pro` or a new equivalent.

Preserve existing inheritance test fixtures: `item-std-battery-locked`, `item-series-display`, and `item-pro-display-override` must continue to exist.

- [ ] **Step 5: Extend MBOM delta seed**

Add delta packs/items for at least two SKUs:

- STD SKU pack:
  - `packaging-label-regional`
  - `manufacturing-only-material`
  - `quantity-change`
- PRO SKU pack:
  - `add`
  - `remove`
  - `replace`

Keep `deltaItemIds` ordered because the preview will apply them in order.

- [ ] **Step 6: Run data tests**

Run:

```bash
npx vitest run tests/productConfigStore.test.ts tests/mbomDeltaStore.test.ts tests/ebomInheritance.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add data/mockProductConfig.ts data/mockEBOMArchitecture.ts data/mockMBOMDeltas.ts tests/productConfigStore.test.ts tests/mbomDeltaStore.test.ts
git commit -m "test: expand ebom mbom trial seed data"
```

## Task 3: MBOM Composition Utility

**Files:**
- Modify: `domain/mbomTypes.ts`
- Create: `utils/mbomComposition.ts`
- Test: `tests/mbomComposition.test.ts`

- [ ] **Step 1: Write failing composition tests**

Cover:

- Base EBOM rows become composed rows with `source: 'base'`.
- `add` inserts a delta row.
- `remove` marks matching target row removed or excludes it, depending on display decision.
- `replace` swaps matching part number and marks `source: 'delta replace'`.
- `quantity-change` updates quantity and marks `source: 'quantity change'`.
- `manufacturing-only-material` creates a manufacturing-only row.
- `packaging-label-regional` replaces or adds a packaging row with a regional marker.
- Unknown target part numbers do not crash and create a warning marker.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run tests/mbomComposition.test.ts
```

Expected: FAIL because `utils/mbomComposition.ts` does not exist.

- [ ] **Step 3: Add composed row types**

In `domain/mbomTypes.ts`, add:

```ts
export type ComposedMBOMSource =
  | 'base'
  | 'delta-add'
  | 'delta-remove'
  | 'delta-replace'
  | 'quantity-change'
  | 'manufacturing-only'
  | 'packaging-label-regional';

export interface ComposedMBOMRow {
  id: string;
  partNumber: string;
  name: string;
  quantity: number;
  unit: string;
  revision?: string;
  source: ComposedMBOMSource;
  deltaItemId?: string;
  targetPartNumber?: string;
  reason?: string;
  warning?: string;
}
```

- [ ] **Step 4: Implement pure composition**

In `utils/mbomComposition.ts`, export:

```ts
export const composeMBOMPreview = (
  baseItems: EBOMItem[],
  deltaItems: MBOMDeltaItem[],
): ComposedMBOMRow[] => {
  // Convert EBOM items to base rows.
  // Apply delta items in input order.
  // Keep deterministic IDs and do not mutate inputs.
};
```

Implementation rules:

- Ignore EBOM root rows only if they are assembly roots and would make the preview noisy; otherwise keep them but mark as `base`.
- Match target deltas by exact `partNumber`.
- For `remove`, retain a visible removed row with `source: 'delta-remove'` so reviewers can see the action.
- For `replace`, use `newPartNumber` and keep `targetPartNumber`.
- For `add`, `manufacturing-only-material`, and targetless packaging deltas, append rows.
- If quantity is missing on an appended delta row, default to `1`.
- Use `reason` as the row name fallback only when no better label exists.

- [ ] **Step 5: Run composition tests**

Run:

```bash
npx vitest run tests/mbomComposition.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add domain/mbomTypes.ts utils/mbomComposition.ts tests/mbomComposition.test.ts
git commit -m "feat: compose mbom preview rows"
```

## Task 4: MBOM Store Preview Selector

**Files:**
- Modify: `stores/useMBOMDeltaStore.ts`
- Test: `tests/mbomDeltaStore.test.ts`

- [ ] **Step 1: Write failing selector tests**

Add a test:

```ts
const rows = useMBOMDeltaStore.getState().getComposedMBOMPreview({
  skuId: 'sku-zp-a-std-blk-us-rtl',
  baseItems: resolvedEBOMItems,
});

expect(rows.some((row) => row.source === 'quantity-change')).toBe(true);
expect(rows.some((row) => row.source === 'manufacturing-only')).toBe(true);
```

Use `resolveEBOMBase()` and mock EBOM data to produce `resolvedEBOMItems`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run tests/mbomDeltaStore.test.ts
```

Expected: FAIL because `getComposedMBOMPreview` does not exist.

- [ ] **Step 3: Add selector**

In `stores/useMBOMDeltaStore.ts`, add:

```ts
getComposedMBOMPreview: (input: { skuId: string; baseItems: EBOMItem[] }) => ComposedMBOMRow[];
```

Implementation:

```ts
getComposedMBOMPreview: ({ skuId, baseItems }) => composeMBOMPreview(
  baseItems,
  get().getDeltaItemsBySKU(skuId),
),
```

- [ ] **Step 4: Run MBOM tests**

Run:

```bash
npx vitest run tests/mbomDeltaStore.test.ts tests/mbomComposition.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add stores/useMBOMDeltaStore.ts tests/mbomDeltaStore.test.ts
git commit -m "feat: expose composed mbom preview selector"
```

## Task 5: Product Matrix Workflow Selection UI

**Files:**
- Modify: `pages/ProductMatrixCenter.tsx`
- Test: `tests/ProductMatrixCenter.test.tsx`

- [ ] **Step 1: Write failing UI test**

Extend `tests/ProductMatrixCenter.test.tsx`:

```ts
fireEvent.click(screen.getByTestId('select-workflow-sku-zp-a-pro-blk-us-rtl'));

expect(useProductConfigStore.getState().selectedWorkflowSKUId).toBe('sku-zp-a-pro-blk-us-rtl');
expect(screen.getByTestId('sku-row-sku-zp-a-pro-blk-us-rtl')).toHaveTextContent('Selected');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run tests/ProductMatrixCenter.test.tsx
```

Expected: FAIL because the selection button does not exist.

- [ ] **Step 3: Add UI control**

In `pages/ProductMatrixCenter.tsx`:

- Read `selectedWorkflowSKUId` and `selectWorkflowSKU`.
- Add a compact selected badge in the SKU row.
- Add an icon button or text button labeled `Select for Workflow`.
- Keep existing activate/freeze/suppress behavior.

- [ ] **Step 4: Run UI test**

Run:

```bash
npx vitest run tests/ProductMatrixCenter.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pages/ProductMatrixCenter.tsx tests/ProductMatrixCenter.test.tsx
git commit -m "feat: select workflow sku from product matrix"
```

## Task 6: EBOM Workspace Selected SKU Context

**Files:**
- Modify: `pages/EBOMArchitectureWorkspace.tsx`
- Test: `tests/PhaseOneWorkflowPages.test.tsx`

- [ ] **Step 1: Write failing page test**

Add a test that sets:

```ts
useProductConfigStore.getState().selectWorkflowSKU('sku-zp-a-pro-blk-us-rtl');
```

Then render `EBOMArchitectureWorkspace` and expect:

- Selected context shows SKU code `ZP-A-PRO-BLK-US-RTL`.
- Structure context shows `Pro Structure`.
- EBOM base selection resolves to `ebom-structure-zp-a-pro` once loaded.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run tests/PhaseOneWorkflowPages.test.tsx
```

Expected: FAIL because EBOM page is not bound to selected workflow SKU.

- [ ] **Step 3: Bind default base to selected SKU structure**

In `pages/EBOMArchitectureWorkspace.tsx`:

- Import `useProductConfigStore`.
- Read `getSelectedWorkflowSKUContext()`.
- After EBOM `load()` completes, if selected SKU has `structureId`, select matching base where `base.scope === 'structure' && base.structureId === context.structure.id`.
- Do not override user base selection after they manually change it during the same render lifecycle unless selected SKU changes.

- [ ] **Step 4: Add context labels**

Add a compact context strip near the top:

- Project code/name.
- Series code.
- Structure name/code.
- SKU code/status.
- EBOM base ID.

Keep the existing EBOM base dropdown for debugging and manual inspection.

- [ ] **Step 5: Run page tests**

Run:

```bash
npx vitest run tests/PhaseOneWorkflowPages.test.tsx tests/ebomArchitectureStore.test.ts tests/ebomInheritance.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add pages/EBOMArchitectureWorkspace.tsx tests/PhaseOneWorkflowPages.test.tsx
git commit -m "feat: scope ebom workspace to selected sku"
```

## Task 7: MBOM Console Shared Context and Full Preview

**Files:**
- Modify: `pages/MBOMDeltaConsole.tsx`
- Test: `tests/PhaseOneWorkflowPages.test.tsx`

- [ ] **Step 1: Write failing full-preview test**

Extend the MBOM page test:

```ts
useProductConfigStore.getState().selectWorkflowSKU('sku-zp-a-std-blk-us-rtl');
render(<MBOMDeltaConsole />);

expect(screen.getByText('Composed MBOM Preview')).toBeInTheDocument();
expect(screen.queryByText(/Placeholder only/i)).not.toBeInTheDocument();
expect(screen.getByText('quantity change')).toBeInTheDocument();
expect(screen.getByText('manufacturing only')).toBeInTheDocument();
```

Add a second assertion for selecting the Pro SKU and seeing `add`, `remove`, and `replace` source markers.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run tests/PhaseOneWorkflowPages.test.tsx
```

Expected: FAIL because preview is still placeholder-only.

- [ ] **Step 3: Resolve EBOM base items in MBOM page**

In `pages/MBOMDeltaConsole.tsx`:

- Use `getSelectedWorkflowSKUContext()` and `selectWorkflowSKU`.
- Load EBOM store if needed, using existing `load()`.
- Resolve matching structure EBOM base for selected SKU.
- Use `resolveEBOMBase()` to produce base items.
- Use `getComposedMBOMPreview({ skuId, baseItems })`.

If EBOM cannot resolve, show a recoverable alert but keep delta packs visible.

- [ ] **Step 4: Replace placeholder section**

Replace `Full MBOM Preview` placeholder with a table:

- Part Number.
- Name.
- Qty.
- Source.
- Target Part.
- Reason/warning.

Use source labels:

- `base`
- `delta add`
- `delta remove`
- `delta replace`
- `quantity change`
- `manufacturing only`
- `packaging/label/regional`

- [ ] **Step 5: Keep SKU selection synchronized**

The SKU dropdown should call `selectWorkflowSKU()` so Product Matrix, EBOM, and MBOM stay aligned.

- [ ] **Step 6: Run page tests**

Run:

```bash
npx vitest run tests/PhaseOneWorkflowPages.test.tsx tests/mbomDeltaStore.test.ts tests/mbomComposition.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add pages/MBOMDeltaConsole.tsx tests/PhaseOneWorkflowPages.test.tsx
git commit -m "feat: preview composed mbom by selected sku"
```

## Task 8: Cross-Page User-Test Path

**Files:**
- Modify: `tests/PhaseOneWorkflowPages.test.tsx`
- Modify: `tests/AppNavigation.test.tsx`

- [ ] **Step 1: Write failing workflow test**

Add an integration-style test that:

1. Renders `ProductMatrixCenter`.
2. Selects `sku-zp-a-pro-blk-us-rtl` for workflow.
3. Renders `EBOMArchitectureWorkspace` and confirms Pro EBOM context.
4. Publishes a simple EBOM draft change.
5. Renders `MBOMDeltaConsole` and confirms the same SKU code and composed MBOM preview are visible.

- [ ] **Step 2: Run test to verify it fails if any workflow link is incomplete**

Run:

```bash
npx vitest run tests/PhaseOneWorkflowPages.test.tsx
```

Expected: PASS if previous tasks are complete; if FAIL, fix the specific context propagation gap.

- [ ] **Step 3: Add navigation smoke coverage**

In `tests/AppNavigation.test.tsx`, assert navigation labels still load after the new selected SKU context fields are added.

- [ ] **Step 4: Run app/page test subset**

Run:

```bash
npx vitest run tests/PhaseOneWorkflowPages.test.tsx tests/AppNavigation.test.tsx tests/ProductMatrixCenter.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/PhaseOneWorkflowPages.test.tsx tests/AppNavigation.test.tsx
git commit -m "test: cover ebom mbom user test path"
```

## Task 9: Manual User-Test Script

**Files:**
- Create: `docs/user-tests/2026-05-24-ebom-mbom-trial-script.md`

- [ ] **Step 1: Draft script**

Create a short Markdown document with:

- Purpose.
- Setup.
- Data note explaining synthetic app data and optional local-only Feishu confirmation data.
- 5-8 manual tasks.
- Observer notes template.

Include tasks:

1. Pick an active Standard SKU in Product Matrix.
2. Open EBOM Architecture and identify inherited, overridden, local, and locked rows.
3. Edit an inherited EBOM item quantity, publish the change package, and verify the draft clears.
4. Switch to MBOM Delta and inspect delta packs for the same SKU.
5. Read the composed MBOM preview and identify base vs delta rows.
6. Switch to a Pro SKU and compare EBOM/MBOM differences.
7. Record confusing terminology or missing decision points.

- [ ] **Step 2: Check docs formatting**

Run:

```bash
sed -n '1,220p' docs/user-tests/2026-05-24-ebom-mbom-trial-script.md
```

Expected: readable script, no real Feishu data pasted.

- [ ] **Step 3: Commit**

```bash
git add docs/user-tests/2026-05-24-ebom-mbom-trial-script.md
git commit -m "docs: add ebom mbom trial script"
```

## Task 10: Optional Local-Only Real Data Confirmation

**Files:**
- Local only, ignored: `.agent/real-data/*`
- Do not commit any files from this task.

- [ ] **Step 1: Confirm ignored location**

Run:

```bash
git check-ignore .agent/real-data/feishu-export.json
```

Expected: `.agent/real-data/feishu-export.json` is ignored because `.agent/*` is already in `.gitignore`.

- [ ] **Step 2: If using Feishu Base, export locally only**

Use the appropriate Lark/Feishu Base workflow only if needed. Save local notes under `.agent/real-data/`.

Validation rule:

- Treat `Audio Frame` as one model flag.
- Treat `Hearing Frame` as one model flag.
- Checked means the row is used in that model.
- Unchecked means the row is not used in that model.

- [ ] **Step 3: Compare concepts, not raw records**

Use the real data only to answer:

- Do synthetic SKU/model labels feel plausible?
- Are rows with multiple model flags represented clearly enough?
- Are EBOM/MBOM source labels understandable?

Do not copy raw rows into source files or docs.

- [ ] **Step 4: Verify no real data is tracked**

Run:

```bash
git status --short
```

Expected: no `.agent/real-data` files appear.

## Task 11: Final Verification

**Files:**
- All modified implementation, test, and docs files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npx vitest run tests/productConfigStore.test.ts tests/mbomComposition.test.ts tests/mbomDeltaStore.test.ts tests/ProductMatrixCenter.test.tsx tests/PhaseOneWorkflowPages.test.tsx tests/AppNavigation.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full tests**

Run:

```bash
npx vitest run
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS. Existing Vite chunk-size and Node deprecation warnings are acceptable unless new errors appear.

- [ ] **Step 4: Inspect final diff**

Run:

```bash
git diff --stat HEAD
git status --short
```

Expected:

- Only intended source, test, and docs files are changed or committed.
- `.superpowers/`, `graphify-out/`, and `.agent/real-data/*` are not committed.

- [ ] **Step 5: Final commit if needed**

If any verification-only fixes were made:

```bash
git add <changed-files>
git commit -m "fix: stabilize ebom mbom trial workflow"
```

## Acceptance Criteria

- Product Matrix can choose the shared workflow SKU.
- EBOM Architecture shows the selected SKU context and selects the matching structure EBOM base by default.
- EBOM draft edit/publish behavior from the previous batch still works.
- MBOM Delta uses the same selected SKU and shows delta packs for that SKU.
- Full MBOM preview is no longer a placeholder.
- Preview rows distinguish base, add, remove, replace, quantity-change, manufacturing-only, and packaging/label/regional sources.
- Synthetic seed data is rich enough for a real user to compare at least Standard vs Pro structures and active/candidate/frozen/suppressed SKU states.
- Manual user-test script exists.
- Real Feishu data, if used, remains local-only and outside git.
- `npx vitest run` and `npm run build` pass.
