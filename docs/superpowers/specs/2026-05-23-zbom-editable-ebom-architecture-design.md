# zBOM Editable EBOM Architecture Design

Date: 2026-05-23

## 1. Background

Phase 1 established the new zBOM domain slices for product configuration, EBOM inheritance, MBOM deltas, and tooling. The EBOM Architecture Workspace currently resolves mock EBOM bases and renders:

- inheritance chain
- resolved EBOM item table
- read-only legacy BOM preview through `toLegacyBOMNode`

The next step is to make EBOM Architecture editable while preserving the Phase 1 boundary:

- new EBOM domain state remains separate from legacy `useBOMStore`
- legacy `BOMNode` remains a read-only compatibility projection
- `resolveEBOMBase` remains a pure resolver, not a mutation layer

The selected scope is **C2 - Repository Port**: implement local editable draft behavior now, but introduce a repository interface that a backend adapter can later replace.

## 2. Goals

The editable EBOM Architecture workflow should:

1. Add an independent EBOM architecture store for bases, items, draft state, selected base, and change records.
2. Add a repository interface for loading EBOM data, saving draft changes, and publishing change packages.
3. Provide an in-memory repository seeded from `mockEBOMArchitecture` for the current prototype.
4. Support local draft mutations:
   - override inherited item fields
   - lock fields
   - unlock fields
   - add local child items
   - reset or revert draft changes
5. Generate a structured change package on publish.
6. Keep the legacy BOM preview read-only and isolated from `useBOMStore`.

## 3. Non-Goals

This phase does not implement:

- real backend persistence
- multi-user conflict resolution
- approval routing
- role-specific edit permissions beyond existing page visibility
- full release/change-control workflow
- legacy BOM editor write-back
- SKU-specific MBOM generation

## 4. Architecture

### 4.1 Repository port

Introduce an EBOM architecture repository interface, likely under `repositories/ebomArchitectureRepository.ts`.

The interface should describe the contract the store needs, not a specific transport:

```ts
export interface EBOMArchitectureSnapshot {
  bases: EBOMBase[];
  items: EBOMItem[];
  changeRecords: EBOMChangeRecord[];
}

export interface PublishEBOMChangePackageInput {
  baseId: string;
  summary: string;
  operations: EBOMDraftOperation[];
}

export interface EBOMArchitectureRepository {
  loadSnapshot: () => Promise<EBOMArchitectureSnapshot>;
  saveDraftOperations: (baseId: string, operations: EBOMDraftOperation[]) => Promise<void>;
  publishChangePackage: (
    input: PublishEBOMChangePackageInput,
  ) => Promise<EBOMChangeRecord>;
}
```

The first implementation should be an in-memory repository. It may resolve immediately, but it should still be asynchronous so UI and store error paths match a future backend adapter.

`saveDraftOperations` should be called by explicit store actions, not as a background call after every keystroke. Field edits may update local draft state immediately, but persistence through the repository should happen when the user applies an edit, adds a local item, changes a lock state, resets a draft, or publishes. This keeps the first implementation deterministic and gives a future backend adapter a clear save boundary.

### 4.2 Domain additions

Extend `domain/ebomArchitectureTypes.ts` with workflow concepts:

```ts
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
  field?: keyof EBOMItem;
  previousValue?: EBOMItem[keyof EBOMItem];
  nextValue?: EBOMItem[keyof EBOMItem];
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

The implementation can refine names and field shapes, but the design intent is clear:

- draft operations are audit-friendly intent records
- current item state is updated for immediate UI feedback
- publish converts the current draft operation list into a durable change record shape
- `EBOMChangeRecord.state` describes the package record, not `EBOMBase.status`

### 4.3 Store boundary

Introduce `stores/useEBOMArchitectureStore.ts`.

Responsibilities:

- load initial snapshot from repository
- track selected base
- expose resolved items for a selected base
- mutate draft EBOM items
- track dirty state by base
- expose draft operations by base
- publish a base change package
- preserve failed drafts when repository calls fail
- reset to the repository snapshot

The store should own editable EBOM state. The page should not import `mockEBOMArchitecture` directly after this change.

The store may accept a repository dependency through a setter or factory to keep tests deterministic.

### 4.4 Resolver boundary

`resolveEBOMBase` should remain pure:

```text
bases + items + selected base id -> resolved EBOM items
```

It should not know about Zustand, repository state, dirty flags, UI selection, or legacy BOM preview.

If helper functions are needed for draft mutation, they should live outside `utils/ebomInheritance.ts` unless they are pure inheritance utilities.

### 4.5 Legacy preview boundary

The existing preview path remains:

```text
store bases/items
-> resolveEBOMBase(...)
-> toLegacyBOMNode(...)
-> BOMTable
```

The EBOM Architecture page must continue to pass:

```tsx
enableColumnControls={false}
enableWhereUsed={false}
```

No EBOM edit action may write to `useBOMStore`.

## 5. User Workflow

### 5.1 Base selection

The user selects an EBOM base from the existing selector. The page shows:

- base scope, revision, and status
- inheritance chain
- resolved EBOM items
- draft status for the selected base
- legacy BOM preview

### 5.2 Item editing

The user selects a resolved item and opens an edit panel or drawer.

Supported first-version actions:

- override editable fields such as `partNumber`, `name`, `quantity`, `unit`, `revision`, and `designMasterPartId`
- lock a field so local value is preserved against inherited source changes
- unlock a field so inherited source value can flow again
- add a local child item under the selected item
- revert draft changes for the selected item

Inherited rows become explicit current-base draft rows when overridden. Local rows remain local. Locked fields remain tracked through `lockedFields`.

Item-level revert should remove unapplied draft state for that item from the current base and append a `revert-item` operation to the draft operation list. The operation list should preserve that a revert happened, while the resolved item state should return to the repository snapshot plus any remaining operations for other items.

### 5.3 Change package

The page shows a change package summary for the selected base:

- number of draft operations
- affected item count
- operation list grouped by type
- publish action
- reset draft action

Publish should call the repository port. On success:

- create a local `EBOMChangeRecord`
- clear draft operations for that base
- clear dirty state for that base
- update local base status according to the prototype policy

`publishChangePackage` should be treated as the atomic repository operation that records the package and clears persisted draft operations for the base. The store should not call `saveDraftOperations(baseId, [])` as a separate success cleanup step.

Prototype publish policy:

- released bases are read-only and cannot publish draft changes in this phase
- publishing a `draft` base moves it to `review`
- publishing a `review` base keeps it in `review`
- publishing does not auto-increment `revision`
- the created `EBOMChangeRecord` stores the current base `revision`

Revision bumping and release approval remain part of the future release/change-control workflow.

On failure:

- keep draft operations
- keep dirty state
- show a non-destructive error state

## 6. UI Direction

The existing page structure should be preserved. Add editing affordances without turning the page into the legacy BOM editor.

Recommended layout:

- keep the current top base selector and summary cards
- keep the inheritance chain section
- keep the resolved items table as the primary editing surface
- add row-level edit actions or row selection with an edit drawer
- add a change package panel near the resolved table
- keep the legacy preview below the resolved items table

The UI should make inheritance state visible:

- inherited
- overridden
- local
- locked
- draft modified

The page should avoid legacy-only controls in the preview. The resolved EBOM table is the edit surface; the legacy BOM preview is inspection only.

## 7. Error Handling

Repository failures should be modeled explicitly.

Required behavior:

- failed load shows a recoverable error state
- failed draft save keeps local draft state
- failed publish keeps dirty state and draft operations
- resolver errors do not crash the page; show an EBOM-specific preview/resolution error
- legacy preview adapter errors do not block the editable resolved table

The store should expose enough status for the UI:

```ts
status: 'idle' | 'loading' | 'ready' | 'saving' | 'publishing' | 'error';
error?: string;
```

Exact status names can change in implementation, but the UI must distinguish loading, save failure, and publish failure.

## 8. Testing Strategy

Testing should start at the domain/store layer.

Required store tests:

- loads bases, items, and change records from the repository
- overrides an inherited field and records an `override-field` operation
- locks a field and records a `lock-field` operation
- unlocks a field and records an `unlock-field` operation
- adds a local child item and records an `add-local-item` operation
- reverts item draft state, records a `revert-item` operation, and preserves other item operations
- resets draft changes for a base
- publishes a change package and clears dirty state on success
- preserves dirty state and operations on publish failure

Required resolver/adapter regression tests:

- existing `resolveEBOMBase` tests continue passing
- legacy adapter preview still renders from resolved items
- EBOM preview remains isolated from legacy `Where Used` and column controls

Required UI tests:

- EBOM Architecture page loads from the EBOM architecture store
- selecting a base updates resolved rows and preview
- editing an inherited row creates a dirty draft state
- change package summary updates after edits
- publish clears dirty state on success
- publish failure shows an error and keeps pending operations

Full verification remains:

```bash
npx vitest run
npm run build
```

## 9. Implementation Sequence

Recommended implementation order:

1. Add domain types and repository interface.
2. Add in-memory repository seeded from mock EBOM data.
3. Add `useEBOMArchitectureStore` with load, selection, mutation, dirty, reset, and publish actions.
4. Add store tests before UI editing.
5. Refactor `EBOMArchitectureWorkspace` to read from the store instead of direct mock imports.
6. Add edit UI and change package summary.
7. Keep legacy preview read-only and assert the boundary in tests.
8. Run full verification.

## 10. Key Rule

Do not collapse editable EBOM state into legacy `BOMNode`.

The intended architecture remains:

```text
EBOM domain store + repository port
-> pure EBOM resolver
-> editable resolved EBOM workflow
-> read-only legacy preview adapter
```
