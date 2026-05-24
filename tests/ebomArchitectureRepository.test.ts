import { describe, expect, it } from 'vitest';
import { createInMemoryEBOMArchitectureRepository } from '../repositories/ebomArchitectureRepository';

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

  it('persists published draft operations into the repository snapshot', async () => {
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
    await repository.publishChangePackage({
      baseId: 'ebom-structure-zp-a-std',
      revision: 'A.01',
      summary: 'Update Standard EBOM draft',
      operations: [operation],
    });

    const snapshot = await repository.loadSnapshot();
    expect(snapshot.bases.find((base) => base.id === 'ebom-structure-zp-a-std')?.status).toBe('review');
    expect(snapshot.items.find((item) => item.id === 'item-std-display')).toMatchObject({
      baseId: 'ebom-structure-zp-a-std',
      quantity: 2,
      inheritanceState: 'overridden',
    });
    expect(snapshot.changeRecords).toHaveLength(1);
  });
});
