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
