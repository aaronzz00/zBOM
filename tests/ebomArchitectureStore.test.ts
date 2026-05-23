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
});
