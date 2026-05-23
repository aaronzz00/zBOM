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
  type EBOMArchitectureRepository,
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

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const initialState = {
  snapshotBases: [],
  snapshotItems: [],
  bases: [],
  items: [],
  changeRecords: [],
  draftOperationsByBaseId: {},
  selectedBaseId: '',
  status: 'idle' as EBOMArchitectureStatus,
  error: undefined,
  repository: ebomArchitectureRepository,
};

const getDefaultBaseId = (bases: EBOMBase[]) => (
  bases.find((base) => base.id === 'ebom-structure-zp-a-std')?.id
    ?? bases[0]?.id
    ?? ''
);

const getBaseId = (state: EBOMArchitectureState, baseId?: string) => (
  baseId ?? state.selectedBaseId
);

const getOperationsByBase = (
  operationsByBaseId: Record<string, EBOMDraftOperation[]>,
  baseId: string,
) => operationsByBaseId[baseId] ?? [];

const applyOperationToItems = (
  bases: EBOMBase[],
  items: EBOMItem[],
  operation: EBOMDraftOperation,
) => {
  if (operation.type === 'add-local-item' && operation.itemSnapshot) {
    return [...items.filter((item) => item.id !== operation.itemSnapshot?.id), clone(operation.itemSnapshot)];
  }

  if (operation.type !== 'override-field' || !operation.field) {
    return items;
  }

  const base = bases.find((item) => item.id === operation.baseId);
  if (!base) {
    return items;
  }

  const resolvedItem = resolveEBOMBase(operation.baseId, bases, items).find(
    (item) => item.id === operation.itemId,
  );
  if (!resolvedItem) {
    return items;
  }

  const existingIndex = items.findIndex(
    (item) => item.id === operation.itemId && item.baseId === operation.baseId,
  );
  const existingItem = existingIndex >= 0 ? items[existingIndex] : undefined;
  const itemToUpdate: EBOMItem = {
    ...resolvedItem,
    ...existingItem,
    id: operation.itemId,
    baseId: operation.baseId,
    sourceItemId: existingItem?.sourceItemId ?? resolvedItem.sourceItemId ?? resolvedItem.id,
    sourceBaseId: existingItem?.sourceBaseId ?? resolvedItem.sourceBaseId ?? resolvedItem.baseId,
    inheritanceState: existingItem?.inheritanceState ?? 'overridden',
    [operation.field]: operation.nextValue,
  };

  if (existingIndex >= 0) {
    return items.map((item, index) => (index === existingIndex ? itemToUpdate : item));
  }

  return [...items, itemToUpdate];
};

const replayDraftOperations = (
  snapshotBases: EBOMBase[],
  snapshotItems: EBOMItem[],
  operationsByBaseId: Record<string, EBOMDraftOperation[]>,
) => {
  let items = clone(snapshotItems);

  for (const operations of Object.values(operationsByBaseId)) {
    const activeOperations: EBOMDraftOperation[] = [];

    for (const operation of operations) {
      if (operation.type === 'revert-item') {
        for (let index = activeOperations.length - 1; index >= 0; index -= 1) {
          const activeOperation = activeOperations[index];
          if (activeOperation.baseId === operation.baseId && activeOperation.itemId === operation.itemId) {
            activeOperations.splice(index, 1);
          }
        }
      }

      activeOperations.push(operation);
    }

    for (const operation of activeOperations) {
      items = applyOperationToItems(snapshotBases, items, operation);
    }
  }

  return items;
};

export const useEBOMArchitectureStore = create<EBOMArchitectureState>((set, get) => ({
  ...initialState,

  reset: () => {
    set({ ...initialState, repository: ebomArchitectureRepository });
  },

  setRepository: (repository) => {
    set({ repository });
  },

  load: async () => {
    const { repository } = get();
    set({ status: 'loading', error: undefined });

    try {
      const snapshot = await repository.loadSnapshot();
      const draftEntries = await Promise.all(
        snapshot.bases.map(async (base) => [
          base.id,
          await repository.loadDraftOperations(base.id),
        ] as const),
      );
      const draftOperationsByBaseId = Object.fromEntries(draftEntries);
      const items = replayDraftOperations(snapshot.bases, snapshot.items, draftOperationsByBaseId);

      set({
        snapshotBases: snapshot.bases,
        snapshotItems: snapshot.items,
        bases: snapshot.bases,
        items,
        changeRecords: snapshot.changeRecords,
        draftOperationsByBaseId,
        selectedBaseId: get().selectedBaseId || getDefaultBaseId(snapshot.bases),
        status: 'ready',
        error: undefined,
      });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unable to load EBOM architecture.',
      });
    }
  },

  selectBase: (baseId) => {
    set({ selectedBaseId: baseId });
  },

  getSelectedBase: () => {
    const state = get();
    return state.bases.find((base) => base.id === state.selectedBaseId);
  },

  getResolvedItems: (baseId) => {
    const state = get();
    const selectedBaseId = getBaseId(state, baseId);

    return selectedBaseId ? resolveEBOMBase(selectedBaseId, state.bases, state.items) : [];
  },

  getDraftOperations: (baseId) => {
    const state = get();
    return getOperationsByBase(state.draftOperationsByBaseId, getBaseId(state, baseId));
  },

  isDirty: (baseId) => get().getDraftOperations(baseId).length > 0,

  overrideField: async () => {},

  lockField: async () => {},

  unlockField: async () => {},

  addLocalItem: async () => {},

  revertItemDraft: async () => {},

  resetDraft: async () => {},

  publishChangePackage: async () => {},
}));
