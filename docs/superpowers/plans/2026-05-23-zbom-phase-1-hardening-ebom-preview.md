# zBOM Phase 1 Hardening and EBOM Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the completed Phase 1 domain slice and connect resolved EBOM architecture data to the existing legacy BOM table as a read-only preview.

**Architecture:** Keep the new product configuration, EBOM inheritance, MBOM delta, and tooling domains separate from the legacy `BOMNode` / `useBOMStore` path. Use `resolveEBOMBase` plus `toLegacyBOMNode` as a one-way adapter for read-only rendering inside `EBOMArchitectureWorkspace`; do not write preview edits back into EBOM or legacy BOM state. Fix the known adapter and tooling edge cases while adding route/sidebar regression coverage.

**Tech Stack:** React 18, TypeScript, Vite, Zustand, Vitest, Testing Library, lucide-react, @tanstack/react-virtual.

---

## Starting Context

Use this plan after `docs/superpowers/specs/2026-05-22-zbom-phase1-implementation-handoff.md`.

Current important files:

- `App.tsx`: page switch for legacy and Phase 1 modules.
- `components/Sidebar.tsx`: permission-filtered navigation.
- `components/BOMTable.tsx`: existing legacy virtualized tree table.
- `pages/EBOMArchitectureWorkspace.tsx`: current read-only EBOM inheritance page using mock data directly.
- `utils/ebomInheritance.ts`: pure EBOM inheritance resolver.
- `utils/legacyBomAdapter.ts`: read-only projection from resolved `EBOMItem[]` to legacy `BOMNode`.
- `stores/useToolingStore.ts`: tooling lookup, milestone update, and Kickoff-to-T1 lead time.
- `tests/PhaseOneWorkflowPages.test.tsx`: current Phase 1 workflow-page coverage.
- `tests/legacyBomAdapter.test.ts`: adapter coverage.
- `tests/toolingStore.test.ts`: tooling store coverage.

Non-negotiable boundary:

- Do not collapse the new EBOM domain into `BOMNode`.
- Do not mutate `useBOMStore` from the EBOM architecture page.
- Do not enable edit/write-back behavior in the legacy BOM preview.

## File Structure

Modify:

- `tests/AppNavigation.test.tsx`: add route/sidebar integration regression tests.
- `utils/legacyBomAdapter.ts`: add item-parent cycle detection and namespace EBOM metadata under `customAttributes.zbom`.
- `tests/legacyBomAdapter.test.ts`: update metadata expectations and add cycle coverage.
- `components/BOMTable.tsx`: add optional initial expansion support so non-legacy root IDs can render expanded in previews.
- `pages/EBOMArchitectureWorkspace.tsx`: add a read-only legacy BOM preview panel fed by `resolveEBOMBase` and `toLegacyBOMNode`.
- `tests/PhaseOneWorkflowPages.test.tsx`: assert the adapter-driven EBOM preview renders and switches with selected base.
- `stores/useToolingStore.ts`: normalize negative Kickoff-to-T1 lead time to `null`.
- `tests/toolingStore.test.ts`: cover negative lead-time policy.

Avoid:

- `stores/useBOMStore.ts`
- `context/AppContext.tsx`
- `data/mockBOM.ts`
- `pages/BOMEditor.tsx`

---

## Task 1: Route and Sidebar Regression Tests

**Files:**

- Create or modify: `tests/AppNavigation.test.tsx`
- Read: `App.tsx`
- Read: `components/Sidebar.tsx`
- Read: `stores/useAuthStore.ts`

- [ ] **Step 1: Write failing navigation tests**

Add tests that render `App` and click every Phase 1 sidebar entry:

```tsx
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from '../App';
import { useAuthStore } from '../stores/useAuthStore';

describe('App phase 1 navigation', () => {
  beforeEach(() => {
    useAuthStore.getState().switchRole('ADMIN');
  });

  it('routes to every phase 1 workflow from the sidebar', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Product Matrix/i }));
    expect(screen.getByText('Product Matrix Center')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /EBOM Architecture/i }));
    expect(screen.getByText('EBOM Architecture Workspace')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /MBOM Delta/i }));
    expect(screen.getByText('MBOM Delta Console')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Tooling Hub/i }));
    expect(screen.getByText('Tooling Hub')).toBeInTheDocument();
  });

  it('keeps phase 1 BOM-facing modules visible to viewer role', () => {
    useAuthStore.getState().switchRole('VIEWER');

    render(<App />);

    expect(screen.getByRole('button', { name: /Product Matrix/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /EBOM Architecture/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /MBOM Delta/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tooling Hub/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure if the file is new**

Run:

```bash
npx vitest run tests/AppNavigation.test.tsx
```

Expected: fail only if accessible names or page titles do not match current markup; use the failure to align the assertions with existing UI text.

- [ ] **Step 3: Make minimal fixes only if tests expose an actual route/sidebar issue**

Allowed edits:

- `App.tsx` route IDs only if the existing IDs drift from the handoff.
- `components/Sidebar.tsx` labels or permissions only if the tests expose a mismatch.

- [ ] **Step 4: Re-run focused test**

Run:

```bash
npx vitest run tests/AppNavigation.test.tsx
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add tests/AppNavigation.test.tsx App.tsx components/Sidebar.tsx
git commit -m "test: cover phase one navigation"
```

---

## Task 2: Harden `legacyBomAdapter`

**Files:**

- Modify: `utils/legacyBomAdapter.ts`
- Modify: `tests/legacyBomAdapter.test.ts`

- [ ] **Step 1: Add failing tests for metadata namespace and malformed parent cycles**

Update the metadata expectation:

```ts
expect(root.customAttributes).toEqual({
  zbom: {
    baseId: 'base-child',
    sourceItemId: 'source-item',
    sourceBaseId: 'base-parent',
    inheritanceState: 'locked',
    designMasterPartId: 'design-master-1',
    lockedFields: ['quantity', 'revision'],
  },
});
```

Add cycle coverage:

```ts
it('throws a clear error for item parent cycles reachable from the selected root', () => {
  const resolvedItems: EBOMItem[] = [
    item({ id: 'root' }),
    item({ id: 'child-a', parentItemId: 'root' }),
    item({ id: 'child-b', parentItemId: 'child-a' }),
    item({ id: 'child-a', parentItemId: 'child-b' }),
  ];

  expect(() => toLegacyBOMNode(resolvedItems, 'root')).toThrow(
    /EBOM item parent cycle detected/,
  );
});
```

This intentionally uses a duplicate `child-a` ID to model malformed resolved EBOM data where a reachable child points back to an ancestor. The important behavior is: the adapter must not recurse forever and must report the malformed parent chain clearly.

- [ ] **Step 2: Run adapter tests to verify failure**

Run:

```bash
npx vitest run tests/legacyBomAdapter.test.ts
```

Expected: fail for the old flat custom attributes shape and missing cycle guard.

- [ ] **Step 3: Namespace metadata**

In `utils/legacyBomAdapter.ts`, change the adapter metadata shape:

```ts
type LegacyEBOMAttributes = {
  zbom: {
    baseId: string;
    sourceItemId?: string;
    sourceBaseId?: string;
    inheritanceState: EBOMItem['inheritanceState'];
    designMasterPartId?: string;
    lockedFields?: EBOMItem['lockedFields'];
  };
};
```

Return `{ zbom }` from `toCustomAttributes`.

- [ ] **Step 4: Add reachable-cycle detection**

Inside `toLegacyBOMNode`, track the current recursion stack:

```ts
const buildNode = (item: EBOMItem, ancestors: string[] = []): BOMNode => {
  if (ancestors.includes(item.id)) {
    throw new Error(
      `EBOM item parent cycle detected: ${[...ancestors, item.id].join(' -> ')}`,
    );
  }

  const nextAncestors = [...ancestors, item.id];
  const childItems = childrenByParentId.get(item.id) ?? [];
  const children = childItems.map((child) => buildNode(child, nextAncestors));

  // existing BOMNode return shape
};
```

Keep the adapter pure and do not mutate `resolvedItems`.

- [ ] **Step 5: Re-run adapter tests**

Run:

```bash
npx vitest run tests/legacyBomAdapter.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add utils/legacyBomAdapter.ts tests/legacyBomAdapter.test.ts
git commit -m "fix: harden ebom legacy adapter"
```

---

## Task 3: Add Read-Only EBOM Preview Through Existing `BOMTable`

**Files:**

- Modify: `components/BOMTable.tsx`
- Modify: `pages/EBOMArchitectureWorkspace.tsx`
- Modify: `tests/PhaseOneWorkflowPages.test.tsx`

- [ ] **Step 1: Write failing page test for adapter-driven preview**

Extend the EBOM Architecture test:

```tsx
expect(screen.getByText('Legacy BOM Preview')).toBeInTheDocument();
expect(screen.getByText(/Read-only projection/i)).toBeInTheDocument();
expect(screen.getByText(/Virtual Tree View/i)).toBeInTheDocument();
expect(screen.getAllByText('ZP26-3200').length).toBeGreaterThan(1);

fireEvent.change(baseSelect, { target: { value: 'ebom-structure-zp-a-pro' } });

expect(screen.getAllByText('Camera Module, Triple Lens Pro').length).toBeGreaterThan(0);
```

- [ ] **Step 2: Run focused page tests to verify failure**

Run:

```bash
npx vitest run tests/PhaseOneWorkflowPages.test.tsx
```

Expected: fail because the legacy preview section does not exist yet.

- [ ] **Step 3: Add optional initial expansion support to `BOMTable`**

Change the prop interface:

```tsx
interface BOMTableProps {
  data: BOMNode;
  onSelect: (node: BOMNode) => void;
  selectedId: string | null;
  isMBOMView: boolean;
  initialExpandedIds?: string[];
}
```

Initialize expanded IDs from the prop while preserving current defaults:

```tsx
const [expandedIds, setExpandedIds] = React.useState<Set<string>>(
  () => new Set(initialExpandedIds ?? ['root', 'n1', 'n2', 'n2-3']),
);
```

Use the prop only for initial state. Do not add write-back or editing behavior.

- [ ] **Step 4: Build legacy preview data in `EBOMArchitectureWorkspace`**

Import:

```tsx
import type { BOMNode } from '../types';
import { BOMTable } from '../components/BOMTable';
import { toLegacyBOMNode } from '../utils/legacyBomAdapter';
```

Add local selected preview state:

```tsx
const [selectedPreviewNodeId, setSelectedPreviewNodeId] = useState<string | null>(null);
```

Create preview data:

```tsx
const legacyPreviewRoot = useMemo<BOMNode | null>(() => {
  if (!selectedBase) {
    return null;
  }

  try {
    return toLegacyBOMNode(resolvedItems, selectedBase.rootItemId);
  } catch (error) {
    console.error(error);
    return null;
  }
}, [resolvedItems, selectedBase]);
```

- [ ] **Step 5: Render the read-only preview panel**

Add a section below the resolved-items table:

```tsx
<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
  <div className="mb-4">
    <h2 className="text-lg font-bold text-slate-900">Legacy BOM Preview</h2>
    <p className="mt-1 text-sm text-slate-500">
      Read-only projection through the legacy BOM table. This does not write back to EBOM architecture state.
    </p>
  </div>
  <div className="h-[420px]">
    {legacyPreviewRoot ? (
      <BOMTable
        data={legacyPreviewRoot}
        selectedId={selectedPreviewNodeId}
        onSelect={(node) => setSelectedPreviewNodeId(node.id)}
        isMBOMView={false}
        initialExpandedIds={[legacyPreviewRoot.id]}
      />
    ) : (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
        Unable to build legacy BOM preview for this EBOM base.
      </div>
    )}
  </div>
</section>
```

If the table keeps stale expansion when `selectedBaseId` changes, set `key={legacyPreviewRoot.id}` on `BOMTable`.

- [ ] **Step 6: Re-run focused page tests**

Run:

```bash
npx vitest run tests/PhaseOneWorkflowPages.test.tsx
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add components/BOMTable.tsx pages/EBOMArchitectureWorkspace.tsx tests/PhaseOneWorkflowPages.test.tsx
git commit -m "feat: add read-only ebom legacy preview"
```

---

## Task 4: Normalize Negative Tooling Lead Time

**Files:**

- Modify: `stores/useToolingStore.ts`
- Modify: `tests/toolingStore.test.ts`

- [ ] **Step 1: Add failing negative lead-time test**

Add a test:

```ts
it('returns null when T1 is before kickoff', () => {
  useToolingStore.getState().updateMilestone('tooling-zp-a-cover-injection', 'kickoff', {
    plannedDate: '2026-05-20',
    actualDate: undefined,
  });
  useToolingStore.getState().updateMilestone('tooling-zp-a-cover-injection', 't1', {
    plannedDate: '2026-05-10',
    actualDate: undefined,
  });

  expect(useToolingStore.getState().getLeadTimeDays('tooling-zp-a-cover-injection')).toBeNull();
});
```

- [ ] **Step 2: Run tooling tests to verify failure**

Run:

```bash
npx vitest run tests/toolingStore.test.ts
```

Expected: fail because the current implementation returns a negative number.

- [ ] **Step 3: Normalize negative result**

In `getLeadTimeDays`, compute the rounded day difference and guard it:

```ts
const leadTimeDays = Math.round((t1Time - kickoffTime) / millisecondsPerDay);

return leadTimeDays < 0 ? null : leadTimeDays;
```

- [ ] **Step 4: Re-run tooling tests**

Run:

```bash
npx vitest run tests/toolingStore.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add stores/useToolingStore.ts tests/toolingStore.test.ts
git commit -m "fix: normalize invalid tooling lead time"
```

---

## Task 5: Full Verification

**Files:**

- No code changes expected unless verification exposes a real bug.

- [ ] **Step 1: Run all tests**

Run:

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: build passes. The existing Vite chunk-size warning is acceptable unless the warning changes into a failure.

- [ ] **Step 3: Manual QA**

Start dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000/
```

Check:

- Existing pages still render: Dashboard, BOM Editor, Compare Revisions, Part Library, Supply Chain, ECO Manager.
- Phase 1 pages still render: Product Matrix, EBOM Architecture, MBOM Delta, Tooling Hub.
- EBOM Architecture base selector changes inheritance chain, resolved items, and legacy BOM preview.
- Legacy BOM preview shows as read-only and selecting a row only highlights preview state.
- Adapter metadata appears under `customAttributes.zbom` if inspected through React dev tools or tests.
- Tooling Hub shows `TBD` for invalid negative Kickoff-to-T1 data.

- [ ] **Step 4: Final commit if verification required fixes**

```bash
git add <changed-files>
git commit -m "fix: address phase one hardening verification"
```

---

## Out of Scope

- Editable EBOM override and lock workflow.
- Persisting EBOM or MBOM data to a backend.
- Rewriting `BOMEditor` to use new EBOM domain state.
- Full SKU-specific MBOM preview generation.
- Release/change-control workflow.
- Bundle-size optimization.

## Recommended Follow-Up Plan

After this plan passes, create a separate plan for the editable EBOM Architecture slice:

- add a focused `useEBOMArchitectureStore`
- implement controlled local override actions
- implement controlled lock/unlock actions
- keep mutation tests at the store and resolver level first
- add UI editing only after store behavior is stable
