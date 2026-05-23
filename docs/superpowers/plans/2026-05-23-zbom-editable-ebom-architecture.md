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
- For an inherited item override, update the resolved current-base item in `items`; do not mutate parent-base source items.
- If the selected base does not already contain that item ID, create a current-base override item by cloning the resolved item and setting:

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
- For local add, create a new `EBOMItem` with `inheritanceState: 'local'`.
- For revert, remove current-base draft items for `itemId`, then append `revert-item`.
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

- [ ] **Step 1: Update page test setup to reset/load EBOM store**

In `tests/PhaseOneWorkflowPages.test.tsx`, import the store:

```ts
import { useEBOMArchitectureStore } from '../stores/useEBOMArchitectureStore';
```

Update `beforeEach`:

```ts
beforeEach(async () => {
  useProductConfigStore.getState().reset();
  useMBOMDeltaStore.getState().reset();
  useToolingStore.getState().reset();
  useEBOMArchitectureStore.getState().reset();
  await useEBOMArchitectureStore.getState().load();
});
```

If async `beforeEach` causes test ordering issues, load inside EBOM-specific tests instead.

- [ ] **Step 2: Add failing assertion that page no longer depends on direct mock imports**

In the existing EBOM page test, keep the current expectations and add:

```ts
expect(screen.getByText(/Draft Status/i)).toBeInTheDocument();
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

- use `bases` for the selector
- use `selectBase(event.target.value)` for base changes
- use `getSelectedBase()` for the selected base
- use `getResolvedItems()` for resolved rows
- use store `bases` and resolved items for inheritance and preview

- [ ] **Step 4: Add draft status display**

Add a summary card or inline panel:

```tsx
<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Draft Status</div>
  <div className="mt-2 text-2xl font-bold text-slate-900">
    {isDirty() ? `${getDraftOperations().length} pending` : 'Clean'}
  </div>
</div>
```

- [ ] **Step 5: Run page tests**

Run:

```bash
npx vitest run tests/PhaseOneWorkflowPages.test.tsx
```

Expected: pass, with existing legacy preview isolation assertions still passing.

- [ ] **Step 6: Commit**

```bash
git add pages/EBOMArchitectureWorkspace.tsx tests/PhaseOneWorkflowPages.test.tsx
git commit -m "feat: load ebom architecture page from store"
```

---

## Task 7: Editing UI and Change Package Panel

**Files:**

- Modify: `pages/EBOMArchitectureWorkspace.tsx`
- Modify: `tests/PhaseOneWorkflowPages.test.tsx`

- [ ] **Step 1: Add failing UI test for editing inherited row and publishing**

Add an EBOM-specific test:

```ts
it('edits an inherited EBOM item, updates the change package, and publishes', async () => {
  render(<EBOMArchitectureWorkspace />);

  fireEvent.click(screen.getByRole('button', { name: /Edit ZP26-4100/i }));
  const quantityInput = screen.getByLabelText('Quantity') as HTMLInputElement;

  fireEvent.change(quantityInput, { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: /Apply Override/i }));

  expect(screen.getByText('1 pending')).toBeInTheDocument();
  expect(screen.getByText(/override-field/i)).toBeInTheDocument();
  expect(screen.getAllByText('3 EA').length).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole('button', { name: /Publish Change Package/i }));

  await waitFor(() => expect(screen.getByText('Clean')).toBeInTheDocument());
  expect(screen.getByText('review')).toBeInTheDocument();
});
```

Use unique accessible labels if the current table text creates duplicates.

- [ ] **Step 2: Add failing UI test for publish failure**

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

  fireEvent.click(screen.getByRole('button', { name: /Edit ZP26-4100/i }));
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: /Apply Override/i }));
  fireEvent.click(screen.getByRole('button', { name: /Publish Change Package/i }));

  await waitFor(() => expect(screen.getByText(/publish failed/i)).toBeInTheDocument());
  expect(screen.getByText('1 pending')).toBeInTheDocument();
});
```

- [ ] **Step 3: Run page tests to verify failure**

Run:

```bash
npx vitest run tests/PhaseOneWorkflowPages.test.tsx
```

Expected: fail because editing UI does not exist.

- [ ] **Step 4: Add row edit controls**

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

- [ ] **Step 5: Add edit panel**

Panel fields:

- selected item identity
- `Quantity` input
- buttons:
  - `Apply Override`
  - `Lock Quantity`
  - `Unlock Quantity`
  - `Revert Item Draft`

Keep the first UI small. Quantity override is enough for the test path; store methods support the broader workflow.

- [ ] **Step 6: Add change package panel**

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

- [ ] **Step 7: Run page tests**

Run:

```bash
npx vitest run tests/PhaseOneWorkflowPages.test.tsx
```

Expected: pass.

- [ ] **Step 8: Commit**

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

