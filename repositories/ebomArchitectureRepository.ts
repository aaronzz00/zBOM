import { mockEBOMBases, mockEBOMItems } from '../data/mockEBOMArchitecture';
import type {
  EBOMBase,
  EBOMChangeRecord,
  EBOMDraftOperation,
  EBOMItem,
} from '../domain/ebomArchitectureTypes';
import { resolveEBOMBase } from '../utils/ebomInheritance';

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

const getActiveOperations = (operations: EBOMDraftOperation[]) => {
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

  return activeOperations;
};

const getUpdatedItemForOperation = (
  bases: EBOMBase[],
  items: EBOMItem[],
  operation: EBOMDraftOperation,
): EBOMItem | null => {
  const resolvedItem = resolveEBOMBase(operation.baseId, bases, items).find(
    (item) => item.id === operation.itemId,
  );
  if (!resolvedItem) {
    return null;
  }

  const existingItem = items.find(
    (item) => item.id === operation.itemId && item.baseId === operation.baseId,
  );
  const baseItem: EBOMItem = {
    ...resolvedItem,
    ...existingItem,
    id: operation.itemId,
    baseId: operation.baseId,
    sourceItemId: existingItem?.sourceItemId ?? resolvedItem.sourceItemId ?? resolvedItem.id,
    sourceBaseId: existingItem?.sourceBaseId ?? resolvedItem.sourceBaseId ?? resolvedItem.baseId,
    inheritanceState: existingItem?.inheritanceState ?? 'overridden',
    lockedFields: existingItem?.lockedFields ? [...existingItem.lockedFields] : undefined,
  };

  if (operation.type === 'override-field' && operation.field) {
    return {
      ...baseItem,
      inheritanceState: 'overridden',
      [operation.field]: operation.nextValue,
    };
  }

  if (operation.type === 'lock-field' && operation.field) {
    return {
      ...baseItem,
      inheritanceState: 'locked',
      lockedFields: Array.from(new Set([...(baseItem.lockedFields ?? []), operation.field])),
    };
  }

  if (operation.type === 'unlock-field' && operation.field) {
    const lockedFields = (baseItem.lockedFields ?? []).filter((field) => field !== operation.field);

    return {
      ...baseItem,
      inheritanceState: lockedFields.length > 0 ? 'locked' : 'inherited',
      lockedFields,
    };
  }

  return null;
};

const applyOperationToItems = (
  bases: EBOMBase[],
  items: EBOMItem[],
  operation: EBOMDraftOperation,
) => {
  if (operation.type === 'add-local-item' && operation.itemSnapshot) {
    return [...items.filter((item) => item.id !== operation.itemSnapshot?.id), clone(operation.itemSnapshot)];
  }

  if (!['override-field', 'lock-field', 'unlock-field'].includes(operation.type)) {
    return items;
  }

  const itemToUpdate = getUpdatedItemForOperation(bases, items, operation);
  if (!itemToUpdate) {
    return items;
  }
  const existingIndex = items.findIndex(
    (item) => item.id === operation.itemId && item.baseId === operation.baseId,
  );

  if (existingIndex >= 0) {
    return items.map((item, index) => (index === existingIndex ? itemToUpdate : item));
  }

  return [...items, itemToUpdate];
};

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

      for (const operation of getActiveOperations(input.operations)) {
        items = applyOperationToItems(bases, items, operation);
      }
      changeRecords = [...changeRecords, record];
      draftsByBaseId.set(input.baseId, []);
      bases = bases.map((base) => (
        base.id === input.baseId && base.status === 'draft'
          ? { ...base, status: 'review' }
          : base
      ));

      return clone(record);
    },
  };
}

export const ebomArchitectureRepository = createInMemoryEBOMArchitectureRepository();
