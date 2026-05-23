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
    expect(state.getResolvedItems()).toHaveLength(3);
  });

  it('switches selected bases and resolves the selected item list', async () => {
    await useEBOMArchitectureStore.getState().load();

    useEBOMArchitectureStore.getState().selectBase('ebom-structure-zp-a-pro');

    expect(useEBOMArchitectureStore.getState().selectedBaseId).toBe('ebom-structure-zp-a-pro');
    expect(useEBOMArchitectureStore.getState().getResolvedItems().map((item) => item.id)).toContain(
      'item-pro-camera-local',
    );
  });

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
    expect(state.getDraftOperations().at(-1)).toMatchObject({
      type: 'add-local-item',
      itemSnapshot: expect.objectContaining({ partNumber: 'ZP-A-STD-9900' }),
    });
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
});
