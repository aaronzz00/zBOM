# zBOM Editable EBOM Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first editable EBOM Architecture workflow with a local repository port, draft operations, publishable change packages, and a read-only legacy preview.

**Architecture:** Add EBOM workflow types and an async repository interface, backed first by an in-memory repository seeded from `mockEBOMArchitecture`. Add a dedicated `useEBOMArchitectureStore` for selected base, draft mutations, dirty state, repository errors, and publish semantics. Refactor `EBOMArchitectureWorkspace` to read from the store and add edit/change-package controls while keeping `toLegacyBOMNode` as a one-way read-only preview adapter.

**Tech Stack:** React 18, TypeScript, Vite, Zustand, Vitest, Testing Library, lucide-react, @tanstack/react-virtual.

---

## Starting Context

Use this plan after:

- `docs/superpowers/specs/2026-05-23-zbom-editable-ebom-architecture-design.md`
- `docs/superpowers/specs/2026-05-23-zbom-phase1-hardening-handoff.md`

Current important files:

- `domain/ebomArchitectureTypes.ts`: EBOM base and item domain types.
- `data/mockEBOMArchitecture.ts`: current mock EBOM bases and items.
- `utils/ebomInheritance.ts`: pure inheritance resolver. Keep pure.
- `utils/legacyBomAdapter.ts`: one-way EBOM-to-legacy `BOMNode` adapter. Keep read-only.
- `pages/EBOMArchitectureWorkspace.tsx`: current read-only EBOM page.
- `tests/ebomInheritance.test.ts`: existing resolver coverage.
- `tests/legacyBomAdapter.test.ts`: existing preview adapter coverage.
- `tests/PhaseOneWorkflowPages.test.tsx`: current page coverage.

Non-negotiable boundary:

- Do not write EBOM edits into `stores/useBOMStore.ts`.
- Do not make legacy `BOMNode` the editable EBOM state.
- Do not add backend persistence in this phase.
- Keep `BOMTable` preview controls isolated with `enableColumnControls={false}` and `enableWhereUsed={false}`.

## File Structure

Create:

- `repositories/ebomArchitectureRepository.ts`: repository contract and in-memory implementation.
- `stores/useEBOMArchitectureStore.ts`: Zustand store for editable EBOM workflow.
- `tests/ebomArchitectureRepository.test.ts`: repository contract tests.
- `tests/ebomArchitectureStore.test.ts`: store mutation and publish tests.

Modify:

- `domain/ebomArchitectureTypes.ts`: add draft operation and change record types.
- `pages/EBOMArchitectureWorkspace.tsx`: read from store and add editing/change package UI.
- `tests/PhaseOneWorkflowPages.test.tsx`: update setup and add editable workflow assertions.

Avoid:

- `stores/useBOMStore.ts`
- `context/AppContext.tsx`
- `data/mockBOM.ts`
- legacy BOM editor write paths

---

## Task 1: EBOM Workflow Domain Types

**Files:**

- Modify: `domain/ebomArchitectureTypes.ts`
- Test indirectly in later repository/store tests.

- [ ] **Step 1: Add workflow types**

Append these types to `domain/ebomArchitectureTypes.ts`:

```ts
export type EBOMEditableField =
  | 'partNumber'
  | 'name'
  | 'quantity'
  | 'unit'
  | 'revision'
  | 'designMasterPartId';

export type EBOMFieldValue = string | number | undefined;

export type EBOMDraftOperationType =
  | 'override-field'
  | 'lock-field'
  | 'unlock-field'
  | 'add-local-item'
  | 'revert-item';

export interface EBOMDraftOperation {
  id: string;
  baseId: string;
  itemId: string;
  type: EBOMDraftOperationType;
  field?: EBOMEditableField;
  previousValue?: EBOMFieldValue;
  nextValue?: EBOMFieldValue;
  itemSnapshot?: EBOMItem;
  createdAt: string;
}

export interface EBOMChangeRecord {
  id: string;
  baseId: string;
  revision: string;
  state: 'recorded';
  summary: string;
  operationIds: string[];
  publishedAt: string;
}
```

- [ ] **Step 2: Run typecheck through build**

Run:

```bash
npm run build
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add domain/ebomArchitectureTypes.ts
git commit -m "feat: add ebom draft workflow types"
```

---

## Task 2: Repository Port and In-Memory Adapter

**Files:**

- Create: `repositories/ebomArchitectureRepository.ts`
- Create: `tests/ebomArchitectureRepository.test.ts`
- Read: `data/mockEBOMArchitecture.ts`
- Read: `domain/ebomArchitectureTypes.ts`

- [ ] **Step 1: Write failing repository tests**

Create `tests/ebomArchitectureRepository.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  createInMemoryEBOMArchitectureRepository,
} from '../repositories/ebomArchitectureRepository';

describe('ebomArchitectureRepository', () => {
  it('loads a cloned snapshot of EBOM bases, items, and change records', async () => {
    const repository = createInMemoryEBOMArchitectureRepository();

    const snapshot = await repository.loadSnapshot();

    expect(snapshot.bases.map((base) => base.id)).toContain('ebom-structure-zp-a-std');
    expect(snapshot.items.map((item) => item.id)).toContain('item-std-battery-locked');
    expect(snapshot.changeRecords).toEqual([]);

    snapshot.bases[0].revision = 'MUTATED';
    const nextSnapshot = await repository.loadSnapshot();
    expect(nextSnapshot.bases[0].revision).not.toBe('MUTATED');
  });

  it('saves draft operations without exposing mutable repository state', async () => {
    const repository = createInMemoryEBOMArchitectureRepository();
    await repository.saveDraftOperations('ebom-structure-zp-a-std', [
      {
        id: 'op-1',
        baseId: 'ebom-structure-zp-a-std',
        itemId: 'item-std-display',
        type: 'override-field',
        field: 'quantity',
        previousValue: 1,
        nextValue: 2,
        createdAt: '2026-05-23T00:00:00.000Z',
      },
    ]);

    const drafts = await repository.loadDraftOperations('ebom-structure-zp-a-std');
    expect(drafts).toHaveLength(1);

    drafts[0].nextValue = 99;
    const nextDrafts = await repository.loadDraftOperations('ebom-structure-zp-a-std');
    expect(nextDrafts[0].nextValue).toBe(2);
  });

  it('publishes a change package atomically and clears persisted drafts', async () => {
    const repository = createInMemoryEBOMArchitectureRepository({
      now: () => '2026-05-23T01:00:00.000Z',
      id: (prefix) => `${prefix}-fixed`,
    });
    const operation = {
      id: 'op-1',
      baseId: 'ebom-structure-zp-a-std',
      itemId: 'item-std-display',
      type: 'override-field' as const,
      field: 'quantity' as const,
      previousValue: 1,
      nextValue: 2,
      createdAt: '2026-05-23T00:00:00.000Z',
    };

    await repository.saveDraftOperations('ebom-structure-zp-a-std', [operation]);
    const record = await repository.publishChangePackage({
      baseId: 'ebom-structure-zp-a-std',
      revision: 'A.01',
      summary: 'Update Standard EBOM draft',
      operations: [operation],
    });

    expect(record).toEqual({
      id: 'change-fixed',
      baseId: 'ebom-structure-zp-a-std',
      revision: 'A.01',
      state: 'recorded',
      summary: 'Update Standard EBOM draft',
      operationIds: ['op-1'],
      publishedAt: '2026-05-23T01:00:00.000Z',
    });
    await expect(repository.loadDraftOperations('ebom-structure-zp-a-std')).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Run repository tests to verify failure**

Run:

```bash
npx vitest run tests/ebomArchitectureRepository.test.ts
```

Expected: fail because `repositories/ebomArchitectureRepository.ts` does not exist.

- [ ] **Step 3: Implement repository contract**

Create `repositories/ebomArchitectureRepository.ts`:

```ts
import { mockEBOMBases, mockEBOMItems } from '../data/mockEBOMArchitecture';
import type {
  EBOMBase,
  EBOMChangeRecord,
  EBOMDraftOperation,
  EBOMItem,
} from '../domain/ebomArchitectureTypes';

export interface EBOMArchitectureSnapshot {
  bases: EBOMBase[];
  items: EBOMItem[];
  changeRecords: EBOMChangeRecord[];
}

export interface PublishEBOMChangePackageInput {
  baseId: string;
  revision: string;
  summary: string;
  operations: EBOMDraftOperation[];
}

export interface EBOMArchitectureRepository {
  loadSnapshot: () => Promise<EBOMArchitectureSnapshot>;
  loadDraftOperations: (baseId: string) => Promise<EBOMDraftOperation[]>;
  saveDraftOperations: (baseId: string, operations: EBOMDraftOperation[]) => Promise<void>;
  publishChangePackage: (
    input: PublishEBOMChangePackageInput,
  ) => Promise<EBOMChangeRecord>;
}

interface InMemoryRepositoryOptions {
  bases?: EBOMBase[];
  items?: EBOMItem[];
  changeRecords?: EBOMChangeRecord[];
  now?: () => string;
  id?: (prefix: string) => string;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function createInMemoryEBOMArchitectureRepository(
  options: InMemoryRepositoryOptions = {},
): EBOMArchitectureRepository {
  let bases = clone(options.bases ?? mockEBOMBases);
  let items = clone(options.items ?? mockEBOMItems);
  let changeRecords = clone(options.changeRecords ?? []);
  const draftsByBaseId = new Map<string, EBOMDraftOperation[]>();
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.id ?? ((prefix: string) => `${prefix}-${crypto.randomUUID()}`);

  return {
    async loadSnapshot() {
      return clone({ bases, items, changeRecords });
    },
    async loadDraftOperations(baseId) {
      return clone(draftsByBaseId.get(baseId) ?? []);
    },
    async saveDraftOperations(baseId, operations) {
      draftsByBaseId.set(baseId, clone(operations));
    },
    async publishChangePackage(input) {
      const record: EBOMChangeRecord = {
        id: id('change'),
        baseId: input.baseId,
        revision: input.revision,
        state: 'recorded',
        summary: input.summary,
        operationIds: input.operations.map((operation) => operation.id),
        publishedAt: now(),
      };

      changeRecords = [...changeRecords, record];
      draftsByBaseId.set(input.baseId, []);

      bases = bases.map((base) => (
        base.id === input.baseId && base.status === 'draft'
          ? { ...base, status: 'review' }
          : base
      ));
      items = clone(items);

      return clone(record);
    },
  };
}

export const ebomArchitectureRepository = createInMemoryEBOMArchitectureRepository();
```

- [ ] **Step 4: Run repository tests**

Run:

```bash
npx vitest run tests/ebomArchitectureRepository.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add repositories/ebomArchitectureRepository.ts tests/ebomArchitectureRepository.test.ts
git commit -m "feat: add ebom architecture repository"
```

---

## Task 3: EBOM Architecture Store

**Files:**

- Create: `stores/useEBOMArchitectureStore.ts`
- Create: `tests/ebomArchitectureStore.test.ts`
- Read: `utils/ebomInheritance.ts`
- Read: `repositories/ebomArchitectureRepository.ts`

- [ ] **Step 1: Write failing store tests for load and selection**

Create `tests/ebomArchitectureStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryEBOMArchitectureRepository } from '../repositories/ebomArchitectureRepository';
import { useEBOMArchitectureStore } from '../stores/useEBOMArchitectureStore';

describe('useEBOMArchitectureStore', () => {
  beforeEach(() => {
    useEBOMArchitectureStore.getState().reset();
    useEBOMArchitectureStore.getState().setRepository(
      createInMemoryEBOMArchitectureRepository({
        now: () => '2026-05-23T00:00:00.000Z',
        id: (prefix) => `${prefix}-fixed`,
      }),
    );
  });

  it('loads EBOM data and selects the Standard structure base by default', async () => {
    await useEBOMArchitectureStore.getState().load();

    const state = useEBOMArchitectureStore.getState();
    expect(state.status).toBe('ready');
    expect(state.selectedBaseId).toBe('ebom-structure-zp-a-std');
    expect(state.bases.map((base) => base.id)).toContain('ebom-structure-zp-a-std');
    expect(state.getSelectedBase()?.id).toBe('ebom-structure-zp-a-std');
    expect(state.getResolvedItems()).toHaveLength(4);
  });

  it('switches selected bases and resolves the selected item list', async () => {
    await useEBOMArchitectureStore.getState().load();

    useEBOMArchitectureStore.getState().selectBase('ebom-structure-zp-a-pro');

    expect(useEBOMArchitectureStore.getState().selectedBaseId).toBe('ebom-structure-zp-a-pro');
    expect(useEBOMArchitectureStore.getState().getResolvedItems().map((item) => item.id)).toContain(
      'item-pro-camera-local',
    );
  });
});
```

- [ ] **Step 2: Run store tests to verify failure**

Run:

```bash
npx vitest run tests/ebomArchitectureStore.test.ts
```

Expected: fail because `stores/useEBOMArchitectureStore.ts` does not exist.

- [ ] **Step 3: Implement store shell**

Create `stores/useEBOMArchitectureStore.ts` with:

```ts
import { create } from 'zustand';
import type {
  EBOMBase,
  EBOMChangeRecord,
  EBOMDraftOperation,
  EBOMEditableField,
  EBOMFieldValue,
  EBOMItem,
} from '../domain/ebomArchitectureTypes';
import {
  EBOMArchitectureRepository,
  ebomArchitectureRepository,
} from '../repositories/ebomArchitectureRepository';
import { resolveEBOMBase } from '../utils/ebomInheritance';

type EBOMArchitectureStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'publishing' | 'error';

export interface AddLocalItemInput {
  parentItemId?: string;
  partNumber: string;
  name: string;
  quantity: number;
  unit: string;
  revision: string;
  designMasterPartId?: string;
}

export interface EBOMArchitectureState {
  snapshotBases: EBOMBase[];
  snapshotItems: EBOMItem[];
  bases: EBOMBase[];
  items: EBOMItem[];
  changeRecords: EBOMChangeRecord[];
  draftOperationsByBaseId: Record<string, EBOMDraftOperation[]>;
  selectedBaseId: string;
  status: EBOMArchitectureStatus;
  error?: string;
  repository: EBOMArchitectureRepository;
  reset: () => void;
  setRepository: (repository: EBOMArchitectureRepository) => void;
  load: () => Promise<void>;
  selectBase: (baseId: string) => void;
  getSelectedBase: () => EBOMBase | undefined;
  getResolvedItems: (baseId?: string) => EBOMItem[];
  getDraftOperations: (baseId?: string) => EBOMDraftOperation[];
  isDirty: (baseId?: string) => boolean;
  overrideField: (itemId: string, field: EBOMEditableField, value: EBOMFieldValue) => Promise<void>;
  lockField: (itemId: string, field: EBOMEditableField) => Promise<void>;
  unlockField: (itemId: string, field: EBOMEditableField) => Promise<void>;
  addLocalItem: (input: AddLocalItemInput) => Promise<void>;
  revertItemDraft: (itemId: string) => Promise<void>;
  resetDraft: (baseId?: string) => Promise<void>;
  publishChangePackage: (summary: string) => Promise<void>;
}
```

Implement only load, select, getters, reset, and setRepository first. Use deterministic default selection:

```ts
const getDefaultBaseId = (bases: EBOMBase[]) => (
  bases.find((base) => base.id === 'ebom-structure-zp-a-std')?.id
    ?? bases[0]?.id
    ?? ''
);
```

Important implementation model:

- `snapshotBases` and `snapshotItems` are the last clean repository snapshot.
- `bases` and `items` are derived editable view state.
- `load()` must call `repository.loadSnapshot()`, then call `repository.loadDraftOperations(base.id)` for every loaded base.
- After loading persisted draft operations, recompute `bases` and `items` by replaying those operations over the clean snapshot.
- `reset()` clears local state and restores the default repository instance, but does not mutate repository data.

- [ ] **Step 4: Run load/selection tests**

Run:

```bash
npx vitest run tests/ebomArchitectureStore.test.ts
```

Expected: current tests pass.

- [ ] **Step 5: Commit store shell**

```bash
git add stores/useEBOMArchitectureStore.ts tests/ebomArchitectureStore.test.ts
git commit -m "feat: add ebom architecture store shell"
```

- [ ] **Step 6: Add failing persisted draft reload test**

Append a test proving `load()` reads draft operations saved in the repository and replays them:

```ts
it('loads persisted draft operations from the repository and replays them', async () => {
  const repository = createInMemoryEBOMArchitectureRepository({
    now: () => '2026-05-23T00:00:00.000Z',
    id: (prefix) => `${prefix}-fixed`,
  });
  await repository.saveDraftOperations('ebom-structure-zp-a-std', [
    {
      id: 'op-existing',
      baseId: 'ebom-structure-zp-a-std',
      itemId: 'item-std-display',
      type: 'override-field',
      field: 'quantity',
      previousValue: 1,
      nextValue: 4,
      createdAt: '2026-05-23T00:00:00.000Z',
    },
  ]);
  useEBOMArchitectureStore.getState().setRepository(repository);

  await useEBOMArchitectureStore.getState().load();

  const state = useEBOMArchitectureStore.getState();
  expect(state.getDraftOperations()).toHaveLength(1);
  expect(state.getResolvedItems().find((item) => item.id === 'item-std-display')?.quantity).toBe(4);
  expect(state.isDirty()).toBe(true);
});
```

- [ ] **Step 7: Implement persisted draft replay**

Add a pure helper inside `stores/useEBOMArchitectureStore.ts`:

```ts
const replayDraftOperations = (
  snapshotBases: EBOMBase[],
  snapshotItems: EBOMItem[],
  operationsByBaseId: Record<string, EBOMDraftOperation[]>,
): EBOMItem[] => {
  // Apply operations in recorded order without mutating snapshotItems.
};
```

Rules:

- Pass `snapshotBases` into replay so inherited-item override replay can resolve source rows when no current-base item stub exists.
- `override-field`, `lock-field`, and `unlock-field` must create/update a current-base item if needed.
- `add-local-item` operations must store the complete created local item in `itemSnapshot`; do not overload `nextValue` with object payloads.
- `revert-item` removes prior operations for the same `baseId` and `itemId` during replay, but leaves operations for other items intact.
- `resetDraft(baseId)` clears operations for that base, calls `saveDraftOperations(baseId, [])`, and recomputes from `snapshotItems`.

- [ ] **Step 8: Run store tests and commit**

Run:

```bash
npx vitest run tests/ebomArchitectureStore.test.ts
```

Expected: pass.

Commit:

```bash
git add stores/useEBOMArchitectureStore.ts tests/ebomArchitectureStore.test.ts
git commit -m "feat: replay persisted ebom drafts"
```

---

## Task 4: Store Draft Mutations

**Files:**

- Modify: `stores/useEBOMArchitectureStore.ts`
- Modify: `tests/ebomArchitectureStore.test.ts`

- [ ] **Step 1: Add failing tests for override, lock, unlock, local item, revert, and reset**

Append tests to `tests/ebomArchitectureStore.test.ts`:

```ts
it('overrides an inherited field and records a draft operation', async () => {
  await useEBOMArchitectureStore.getState().load();

  await useEBOMArchitectureStore.getState().overrideField('item-std-display', 'quantity', 3);

  const state = useEBOMArchitectureStore.getState();
  const display = state.getResolvedItems().find((item) => item.id === 'item-std-display');
  expect(display).toMatchObject({
    quantity: 3,
    inheritanceState: 'overridden',
    baseId: 'ebom-structure-zp-a-std',
  });
  expect(state.getDraftOperations()).toMatchObject([
    {
      type: 'override-field',
      field: 'quantity',
      previousValue: 1,
      nextValue: 3,
    },
  ]);
  expect(state.isDirty()).toBe(true);
});

it('locks and unlocks fields while recording operations', async () => {
  await useEBOMArchitectureStore.getState().load();

  await useEBOMArchitectureStore.getState().lockField('item-std-display', 'quantity');
  expect(useEBOMArchitectureStore.getState().getResolvedItems().find(
    (item) => item.id === 'item-std-display',
  )?.lockedFields).toEqual(['quantity']);

  await useEBOMArchitectureStore.getState().unlockField('item-std-display', 'quantity');
  const state = useEBOMArchitectureStore.getState();
  expect(state.getResolvedItems().find((item) => item.id === 'item-std-display')?.lockedFields).toEqual([]);
  expect(state.getDraftOperations().map((operation) => operation.type)).toEqual([
    'lock-field',
    'unlock-field',
  ]);
});

it('adds a local child item under the selected base', async () => {
  await useEBOMArchitectureStore.getState().load();

  await useEBOMArchitectureStore.getState().addLocalItem({
    parentItemId: 'item-std-root',
    partNumber: 'ZP-A-STD-9900',
    name: 'Local Test Fixture',
    quantity: 1,
    unit: 'EA',
    revision: 'A',
  });

  const state = useEBOMArchitectureStore.getState();
  expect(state.getResolvedItems().find((item) => item.partNumber === 'ZP-A-STD-9900')).toMatchObject({
    inheritanceState: 'local',
    baseId: 'ebom-structure-zp-a-std',
  });
  expect(state.getDraftOperations().at(-1)).toMatchObject({ type: 'add-local-item' });
});

it('reverts one item draft while preserving other item operations', async () => {
  await useEBOMArchitectureStore.getState().load();

  await useEBOMArchitectureStore.getState().overrideField('item-std-display', 'quantity', 3);
  await useEBOMArchitectureStore.getState().overrideField('item-std-battery-locked', 'revision', 'B');
  await useEBOMArchitectureStore.getState().revertItemDraft('item-std-display');

  const state = useEBOMArchitectureStore.getState();
  expect(state.getResolvedItems().find((item) => item.id === 'item-std-display')?.quantity).toBe(1);
  expect(state.getResolvedItems().find((item) => item.id === 'item-std-battery-locked')?.revision).toBe('B');
  expect(state.getDraftOperations().map((operation) => operation.type)).toContain('revert-item');
});

it('resets draft changes for the selected base', async () => {
  await useEBOMArchitectureStore.getState().load();

  await useEBOMArchitectureStore.getState().overrideField('item-std-display', 'quantity', 3);
  await useEBOMArchitectureStore.getState().resetDraft();

  const state = useEBOMArchitectureStore.getState();
  expect(state.getResolvedItems().find((item) => item.id === 'item-std-display')?.quantity).toBe(1);
  expect(state.getDraftOperations()).toEqual([]);
  expect(state.isDirty()).toBe(false);
});

it('keeps local draft state when saving draft operations fails', async () => {
  const failingRepository = createInMemoryEBOMArchitectureRepository();
  failingRepository.saveDraftOperations = async () => {
    throw new Error('save failed');
  };
  useEBOMArchitectureStore.getState().setRepository(failingRepository);
  await useEBOMArchitectureStore.getState().load();

  await useEBOMArchitectureStore.getState().overrideField('item-std-display', 'quantity', 3);

  const state = useEBOMArchitectureStore.getState();
  expect(state.error).toMatch(/save failed/);
  expect(state.getResolvedItems().find((item) => item.id === 'item-std-display')?.quantity).toBe(3);
  expect(state.getDraftOperations()).toHaveLength(1);
  expect(state.isDirty()).toBe(true);
});
```

- [ ] **Step 2: Run store tests to verify failure**

Run:

```bash
npx vitest run tests/ebomArchitectureStore.test.ts
```

Expected: fail for unimplemented mutation methods.

- [ ] **Step 3: Implement mutation helpers**

In `stores/useEBOMArchitectureStore.ts`, add helpers:

```ts
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const createOperationId = () => `op-${crypto.randomUUID()}`;
const createItemId = () => `item-local-${crypto.randomUUID()}`;

const getOperationTime = () => new Date().toISOString();
```

Implementation rules:

- Resolve current selected base through `get().getSelectedBase()`.
- Reject edits when no base is selected.
- Reject edits when selected base status is `released`.
- For an inherited item override, append an operation and then recompute `items` by replaying all operations over `snapshotItems`; do not mutate parent-base source items.
- If replay needs a current-base override item and the selected base does not already contain that item ID, create one by cloning the resolved item and setting:

```ts
{
  id: resolvedItem.id,
  baseId: selectedBase.id,
  sourceItemId: resolvedItem.sourceItemId ?? resolvedItem.id,
  sourceBaseId: resolvedItem.sourceBaseId ?? resolvedItem.baseId,
  inheritanceState: 'overridden',
}
```

- For lock, ensure the field is present in `lockedFields` and set `inheritanceState` to `locked`.
- For unlock, remove the field from `lockedFields`; if none remain, set state to `overridden`.
- For local add, record an `add-local-item` operation whose payload can recreate a new `EBOMItem` with `inheritanceState: 'local'` during replay.
- For revert, do not delete arbitrary current-base items directly. Append a `revert-item` operation; replay must ignore earlier operations for that same base/item while preserving operations for other items.
- After each explicit edit action, call `repository.saveDraftOperations(baseId, operations)`.
- On save failure, keep local state and set `status: 'error'` plus `error`.

- [ ] **Step 4: Run mutation tests**

Run:

```bash
npx vitest run tests/ebomArchitectureStore.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add stores/useEBOMArchitectureStore.ts tests/ebomArchitectureStore.test.ts
git commit -m "feat: add ebom draft mutations"
```

---

## Task 5: Store Publish and Failure Semantics

**Files:**

- Modify: `stores/useEBOMArchitectureStore.ts`
- Modify: `tests/ebomArchitectureStore.test.ts`

- [ ] **Step 1: Add failing publish tests**

Append tests:

```ts
it('publishes a draft base change package and clears dirty state', async () => {
  await useEBOMArchitectureStore.getState().load();
  await useEBOMArchitectureStore.getState().overrideField('item-std-display', 'quantity', 3);

  await useEBOMArchitectureStore.getState().publishChangePackage('Standard draft update');

  const state = useEBOMArchitectureStore.getState();
  expect(state.getDraftOperations()).toEqual([]);
  expect(state.isDirty()).toBe(false);
  expect(state.getSelectedBase()).toMatchObject({ status: 'review', revision: 'A.01' });
  expect(state.changeRecords).toEqual([
    {
      id: 'change-fixed',
      baseId: 'ebom-structure-zp-a-std',
      revision: 'A.01',
      state: 'recorded',
      summary: 'Standard draft update',
      operationIds: expect.any(Array),
      publishedAt: '2026-05-23T00:00:00.000Z',
    },
  ]);
});

it('keeps review bases in review after publish', async () => {
  await useEBOMArchitectureStore.getState().load();
  useEBOMArchitectureStore.getState().selectBase('ebom-series-zp-a');
  await useEBOMArchitectureStore.getState().overrideField('item-series-display', 'quantity', 2);

  await useEBOMArchitectureStore.getState().publishChangePackage('Series update');

  expect(useEBOMArchitectureStore.getState().getSelectedBase()).toMatchObject({
    id: 'ebom-series-zp-a',
    status: 'review',
  });
});

it('blocks edits and publish for released bases', async () => {
  await useEBOMArchitectureStore.getState().load();
  useEBOMArchitectureStore.getState().selectBase('ebom-platform-zp26');

  await useEBOMArchitectureStore.getState().overrideField('item-platform-display', 'quantity', 2);
  expect(useEBOMArchitectureStore.getState().error).toMatch(/released EBOM base/i);
  expect(useEBOMArchitectureStore.getState().isDirty()).toBe(false);
});

it('preserves dirty state and operations on publish failure', async () => {
  const failingRepository = createInMemoryEBOMArchitectureRepository();
  failingRepository.publishChangePackage = async () => {
    throw new Error('publish failed');
  };
  useEBOMArchitectureStore.getState().setRepository(failingRepository);
  await useEBOMArchitectureStore.getState().load();
  await useEBOMArchitectureStore.getState().overrideField('item-std-display', 'quantity', 3);

  await useEBOMArchitectureStore.getState().publishChangePackage('Broken publish');

  const state = useEBOMArchitectureStore.getState();
  expect(state.error).toMatch(/publish failed/);
  expect(state.isDirty()).toBe(true);
  expect(state.getDraftOperations()).toHaveLength(1);
});
```

- [ ] **Step 2: Run store tests to verify failure**

Run:

```bash
npx vitest run tests/ebomArchitectureStore.test.ts
```

Expected: fail until publish semantics are implemented.

- [ ] **Step 3: Implement publish semantics**

In `publishChangePackage`:

- require selected base
- reject released base
- no-op if there are no operations
- set status to `publishing`
- call `repository.publishChangePackage({ baseId, revision, summary, operations })`
- on success:
  - append returned change record
  - clear `draftOperationsByBaseId[baseId]`
  - update selected base status from `draft` to `review`
  - do not change revision
  - set status to `ready`
- on failure:
  - leave operations untouched
  - leave base status untouched
  - set status to `error`
  - set error message

- [ ] **Step 4: Run store tests**

Run:

```bash
npx vitest run tests/ebomArchitectureStore.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add stores/useEBOMArchitectureStore.ts tests/ebomArchitectureStore.test.ts
git commit -m "feat: publish ebom change packages"
```

---

## Task 6: Refactor EBOM Page to Store

**Files:**

- Modify: `pages/EBOMArchitectureWorkspace.tsx`
- Modify: `tests/PhaseOneWorkflowPages.test.tsx`
- Read: `stores/useEBOMArchitectureStore.ts`

- [ ] **Step 1: Update page test setup to reset EBOM store without preloading it**

In `tests/PhaseOneWorkflowPages.test.tsx`, import the store:

```ts
import { useEBOMArchitectureStore } from '../stores/useEBOMArchitectureStore';
import { createInMemoryEBOMArchitectureRepository } from '../repositories/ebomArchitectureRepository';
```

Update `beforeEach`:

```ts
beforeEach(() => {
  useProductConfigStore.getState().reset();
  useMBOMDeltaStore.getState().reset();
  useToolingStore.getState().reset();
  useEBOMArchitectureStore.getState().reset();
  useEBOMArchitectureStore.getState().setRepository(createInMemoryEBOMArchitectureRepository());
});
```

Do not preload the EBOM store in the page tests. The page itself must call `load()` when it renders with an idle store. Always install a fresh in-memory repository in `beforeEach` so draft operations, change records, and status changes cannot leak between page tests.

- [ ] **Step 2: Add failing self-loading page assertions**

Convert the existing EBOM page test to wait for store-loaded content:

```ts
it('self-loads EBOM architecture data from the store', async () => {
  render(<EBOMArchitectureWorkspace />);

  expect(screen.getByText(/Loading EBOM architecture/i)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('EBOM Architecture Workspace')).toBeInTheDocument());
  expect(screen.getByText(/Draft Status/i)).toBeInTheDocument();
  expect(screen.getAllByText('ebom-structure-zp-a-std').length).toBeGreaterThan(0);
});
```

Expected: this fails until the page displays store-backed draft status.

- [ ] **Step 3: Refactor page imports**

In `pages/EBOMArchitectureWorkspace.tsx`:

- remove `mockEBOMBases` and `mockEBOMItems` imports
- import `useEBOMArchitectureStore`
- derive:

```ts
const {
  bases,
  selectedBaseId,
  selectBase,
  getSelectedBase,
  getResolvedItems,
  getDraftOperations,
  isDirty,
  status,
  error,
} = useEBOMArchitectureStore();
```

- add `useEffect` and call `load()` when `status === 'idle'`
- use `bases` for the selector
- use `selectBase(event.target.value)` for base changes
- use `getSelectedBase()` for the selected base
- use `getResolvedItems()` for resolved rows
- use store `bases` and resolved items for inheritance and preview

- [ ] **Step 4: Add loading and load-error UI**

Add early page states:

```tsx
if (status === 'idle' || status === 'loading') {
  return <div className="flex-1 bg-slate-50 p-6">Loading EBOM architecture...</div>;
}

if (status === 'error' && bases.length === 0) {
  return (
    <div className="flex-1 bg-slate-50 p-6">
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
        {error ?? 'Unable to load EBOM architecture.'}
      </div>
      <button type="button" onClick={() => void load()}>Retry</button>
    </div>
  );
}
```

- [ ] **Step 5: Add draft status display**

Add a summary card or inline panel:

```tsx
<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Draft Status</div>
  <div className="mt-2 text-2xl font-bold text-slate-900">
    {isDirty() ? `${getDraftOperations().length} pending` : 'Clean'}
  </div>
</div>
```

- [ ] **Step 6: Add failing load failure test**

Use a repository whose `loadSnapshot` rejects:

```ts
it('shows a recoverable EBOM load error', async () => {
  const repository = createInMemoryEBOMArchitectureRepository();
  repository.loadSnapshot = async () => {
    throw new Error('load failed');
  };
  useEBOMArchitectureStore.getState().setRepository(repository);

  render(<EBOMArchitectureWorkspace />);

  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('load failed'));
  expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
});
```

- [ ] **Step 7: Add resolver and preview error boundaries**

Wrap `getInheritanceChain`, `getResolvedItems`, and `toLegacyBOMNode` calls in `useMemo` blocks that return error strings instead of throwing through React render.

Required UI:

- if inheritance/resolution fails, show `Unable to resolve EBOM items.`
- if only legacy preview fails, keep resolved table visible and show `Unable to build legacy BOM preview for this EBOM base.`

Add a focused page test with cyclic or malformed repository data to verify resolver failure does not crash the page.

- [ ] **Step 8: Run page tests**

Run:

```bash
npx vitest run tests/PhaseOneWorkflowPages.test.tsx
```

Expected: pass, with existing legacy preview isolation assertions still passing.

- [ ] **Step 9: Commit**

```bash
git add pages/EBOMArchitectureWorkspace.tsx tests/PhaseOneWorkflowPages.test.tsx
git commit -m "feat: load ebom architecture page from store"
```

---

## Task 7: Editing UI, Local Item UI, and Change Package Panel

**Files:**

- Modify: `pages/EBOMArchitectureWorkspace.tsx`
- Modify: `tests/PhaseOneWorkflowPages.test.tsx`

- [ ] **Step 1: Add failing UI test for editing inherited row fields and publishing**

Add an EBOM-specific test:

```ts
it('edits inherited EBOM fields, updates the change package, and publishes', async () => {
  render(<EBOMArchitectureWorkspace />);
  await waitFor(() => expect(screen.getByText('EBOM Architecture Workspace')).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: /Edit ZP26-4100/i }));
  fireEvent.change(screen.getByLabelText('Part Number'), { target: { value: 'ZP26-4100-EDIT' } });
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Edited Display Module' } });
  const quantityInput = screen.getByLabelText('Quantity') as HTMLInputElement;
  fireEvent.change(quantityInput, { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'SET' } });
  fireEvent.change(screen.getByLabelText('Revision'), { target: { value: 'B' } });
  fireEvent.change(screen.getByLabelText('Design Master Part'), {
    target: { value: 'dmp-edited-display' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Apply Override/i }));

  expect(screen.getByText('6 pending')).toBeInTheDocument();
  expect(screen.getByText(/override-field/i)).toBeInTheDocument();
  expect(screen.getAllByText('ZP26-4100-EDIT').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Edited Display Module').length).toBeGreaterThan(0);
  expect(screen.getAllByText('3 SET').length).toBeGreaterThan(0);
  expect(screen.getAllByText('B').length).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole('button', { name: /Publish Change Package/i }));

  await waitFor(() => expect(screen.getByText('Clean')).toBeInTheDocument());
  expect(screen.getByText('review')).toBeInTheDocument();
});
```

Use unique accessible labels if the current table text creates duplicates.

- [ ] **Step 2: Add failing UI test for adding a local child item**

Add:

```ts
it('adds a local child item from the EBOM edit workflow', async () => {
  render(<EBOMArchitectureWorkspace />);
  await waitFor(() => expect(screen.getByText('EBOM Architecture Workspace')).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: /Add Local Item/i }));
  fireEvent.change(screen.getByLabelText('Local Part Number'), {
    target: { value: 'ZP-A-STD-9900' },
  });
  fireEvent.change(screen.getByLabelText('Local Name'), {
    target: { value: 'Local Test Fixture' },
  });
  fireEvent.change(screen.getByLabelText('Local Quantity'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Local Unit'), { target: { value: 'EA' } });
  fireEvent.change(screen.getByLabelText('Local Revision'), { target: { value: 'A' } });
  fireEvent.change(screen.getByLabelText('Local Design Master Part'), {
    target: { value: 'dmp-local-test-fixture' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Create Local Item/i }));

  expect(screen.getByText('1 pending')).toBeInTheDocument();
  expect(screen.getAllByText('ZP-A-STD-9900').length).toBeGreaterThan(0);
  expect(screen.getByText(/add-local-item/i)).toBeInTheDocument();
});
```

- [ ] **Step 3: Add failing UI test for lock, unlock, and revert**

Add:

```ts
it('locks, unlocks, and reverts an EBOM item draft from the edit panel', async () => {
  render(<EBOMArchitectureWorkspace />);
  await waitFor(() => expect(screen.getByText('EBOM Architecture Workspace')).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: /Edit ZP26-4100/i }));
  fireEvent.click(screen.getByRole('button', { name: /Lock Quantity/i }));
  expect(screen.getByText(/lock-field/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Unlock Quantity/i }));
  expect(screen.getByText(/unlock-field/i)).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: /Apply Override/i }));
  fireEvent.click(screen.getByRole('button', { name: /Revert Item Draft/i }));

  expect(screen.getByText(/revert-item/i)).toBeInTheDocument();
  expect(screen.queryByText('3 EA')).not.toBeInTheDocument();
});
```

- [ ] **Step 4: Add failing UI test for publish failure**

Inject a failing repository through the store before render:

```ts
it('keeps pending EBOM operations visible when publish fails', async () => {
  const repository = createInMemoryEBOMArchitectureRepository();
  repository.publishChangePackage = async () => {
    throw new Error('publish failed');
  };
  useEBOMArchitectureStore.getState().reset();
  useEBOMArchitectureStore.getState().setRepository(repository);
  await useEBOMArchitectureStore.getState().load();

  render(<EBOMArchitectureWorkspace />);
  await waitFor(() => expect(screen.getByText('EBOM Architecture Workspace')).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: /Edit ZP26-4100/i }));
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: /Apply Override/i }));
  fireEvent.click(screen.getByRole('button', { name: /Publish Change Package/i }));

  await waitFor(() => expect(screen.getByText(/publish failed/i)).toBeInTheDocument());
  expect(screen.getByText('1 pending')).toBeInTheDocument();
});
```

- [ ] **Step 5: Run page tests to verify failure**

Run:

```bash
npx vitest run tests/PhaseOneWorkflowPages.test.tsx
```

Expected: fail because complete editing UI does not exist.

- [ ] **Step 6: Add row edit controls**

In the resolved items table:

- add an `Actions` header
- add a button with accessible label `Edit ${item.partNumber}`
- track `selectedEditItemId`
- show an edit panel below or beside the table

Use stable labels:

```tsx
<button
  type="button"
  aria-label={`Edit ${item.partNumber}`}
  onClick={() => setSelectedEditItemId(item.id)}
>
  Edit
</button>
```

- [ ] **Step 7: Add edit panel for all first-version fields**

Panel fields:

- selected item identity
- `Part Number` input
- `Name` input
- `Quantity` input
- `Unit` input
- `Revision` input
- `Design Master Part` input
- buttons:
  - `Apply Override`
  - `Lock Quantity`
  - `Unlock Quantity`
  - `Revert Item Draft`

`Apply Override` should compare the form values with the selected item and call `overrideField` once for each changed field. Do not create operations for unchanged values.

- [ ] **Step 8: Add local item panel**

Add a compact local-item form near the resolved items table or edit panel.

Fields:

- `Local Parent Item` select, defaulting to selected edit item or selected base root
- `Local Part Number`
- `Local Name`
- `Local Quantity`
- `Local Unit`
- `Local Revision`
- `Local Design Master Part`
- `Create Local Item`

The create action calls `addLocalItem`.

- [ ] **Step 9: Add change package panel**

Show:

- `Clean` or `{count} pending`
- list of operation types
- error text if `error`
- `Publish Change Package`
- `Reset Draft`

Publish button calls:

```ts
void publishChangePackage(`${selectedBase.id} draft update`);
```

Disable publish when:

- no selected base
- selected base is `released`
- no pending operations
- status is `publishing`

- [ ] **Step 10: Add resolver/preview error tests if not already covered in Task 6**

Ensure at least one page test covers each behavior:

- failed repository load shows retry UI
- resolver errors show `Unable to resolve EBOM items.`
- legacy preview errors show preview error while resolved table remains visible

- [ ] **Step 11: Run page tests**

Run:

```bash
npx vitest run tests/PhaseOneWorkflowPages.test.tsx
```

Expected: pass.

- [ ] **Step 12: Commit**

```bash
git add pages/EBOMArchitectureWorkspace.tsx tests/PhaseOneWorkflowPages.test.tsx
git commit -m "feat: add editable ebom architecture workflow"
```

---

## Task 8: Focused Regression and Full Verification

**Files:**

- Modify only if verification exposes real issues.

- [ ] **Step 1: Run focused EBOM tests**

Run:

```bash
npx vitest run tests/ebomArchitectureRepository.test.ts tests/ebomArchitectureStore.test.ts tests/PhaseOneWorkflowPages.test.tsx tests/legacyBomAdapter.test.ts tests/ebomInheritance.test.ts
```

Expected: pass.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npx vitest run
```

Expected: pass. Known Recharts jsdom chart-size warnings may appear.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: pass. Existing Vite chunk-size warning may appear.

- [ ] **Step 4: Commit verification fixes if needed**

Only if fixes were required:

```bash
git add <changed-files>
git commit -m "fix: stabilize editable ebom workflow"
```

- [ ] **Step 5: Final status check**

Run:

```bash
git status --short
git log --oneline -8
```

Expected:

- no tracked file changes left uncommitted
- only intentional untracked local artifacts, if any
