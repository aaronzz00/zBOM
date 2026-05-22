import type { EBOMBase, EBOMItem } from '../domain/ebomArchitectureTypes';

export interface OverrideSummary {
  inherited: number;
  overridden: number;
  local: number;
  locked: number;
}

const LOCAL_IDENTITY_FIELDS = new Set<keyof EBOMItem>([
  'id',
  'baseId',
  'parentItemId',
  'sourceItemId',
  'sourceBaseId',
  'inheritanceState',
  'lockedFields',
]);

export function getInheritanceChain(baseId: string, bases: EBOMBase[]): EBOMBase[] {
  const basesById = new Map(bases.map((base) => [base.id, base]));
  const chain: EBOMBase[] = [];
  const visited = new Set<string>();

  let currentBase = basesById.get(baseId);
  if (!currentBase) {
    throw new Error(`EBOM base not found: ${baseId}`);
  }

  while (currentBase) {
    if (visited.has(currentBase.id)) {
      throw new Error(
        `EBOM inheritance cycle detected: ${[...chain.map((base) => base.id), currentBase.id].join(' -> ')}`,
      );
    }

    visited.add(currentBase.id);
    chain.push(currentBase);

    if (!currentBase.parentBaseId) {
      break;
    }

    const parentBase = basesById.get(currentBase.parentBaseId);
    if (!parentBase) {
      throw new Error(
        `EBOM parent base not found: ${currentBase.parentBaseId} for base ${currentBase.id}`,
      );
    }

    currentBase = parentBase;
  }

  return chain.reverse();
}

export function resolveEBOMBase(baseId: string, bases: EBOMBase[], items: EBOMItem[]): EBOMItem[] {
  const chain = getInheritanceChain(baseId, bases);
  const resolved: EBOMItem[] = [];

  for (const base of chain) {
    const baseItems = items.filter((item) => item.baseId === base.id);

    for (const item of baseItems) {
      const replacementIndex = item.sourceItemId
        ? findSourceItemIndex(resolved, item.sourceItemId)
        : -1;
      const sourceItem = replacementIndex >= 0 ? resolved[replacementIndex] : undefined;
      const resolvedItem =
        item.inheritanceState === 'locked' && sourceItem
          ? mergeLockedItem(sourceItem, item)
          : cloneItem(item);

      if (replacementIndex >= 0) {
        resolved.splice(replacementIndex, 1, resolvedItem);
      } else {
        resolved.push(resolvedItem);
      }
    }
  }

  return resolved;
}

export function getOverrideSummary(
  baseId: string,
  bases: EBOMBase[],
  items: EBOMItem[],
): OverrideSummary {
  return resolveEBOMBase(baseId, bases, items).reduce<OverrideSummary>(
    (summary, item) => {
      summary[item.inheritanceState] += 1;
      return summary;
    },
    {
      inherited: 0,
      overridden: 0,
      local: 0,
      locked: 0,
    },
  );
}

function findSourceItemIndex(resolved: EBOMItem[], sourceItemId: string): number {
  return resolved.findIndex(
    (item) => item.id === sourceItemId || item.sourceItemId === sourceItemId,
  );
}

function mergeLockedItem(sourceItem: EBOMItem, localItem: EBOMItem): EBOMItem {
  const merged = {
    ...cloneItem(sourceItem),
    id: localItem.id,
    baseId: localItem.baseId,
    parentItemId: localItem.parentItemId,
    sourceItemId: localItem.sourceItemId,
    sourceBaseId: localItem.sourceBaseId,
    inheritanceState: localItem.inheritanceState,
    lockedFields: localItem.lockedFields ? [...localItem.lockedFields] : undefined,
  };

  for (const key of localItem.lockedFields ?? []) {
    if (LOCAL_IDENTITY_FIELDS.has(key)) {
      continue;
    }

    merged[key] = localItem[key] as never;
  }

  return merged;
}

function cloneItem(item: EBOMItem): EBOMItem {
  return {
    ...item,
    lockedFields: item.lockedFields ? [...item.lockedFields] : undefined,
  };
}
