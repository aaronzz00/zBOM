import { EBOMItem } from '../domain/ebomArchitectureTypes';
import { BOMNode, ComponentType, LifecycleState } from '../types';

type LegacyEBOMAttributes = {
  zbom: {
    baseId: string;
    sourceItemId?: string;
    sourceBaseId?: string;
    inheritanceState: EBOMItem['inheritanceState'];
    designMasterPartId?: string;
    lockedFields?: EBOMItem['lockedFields'];
  };
};

const toCustomAttributes = (item: EBOMItem): LegacyEBOMAttributes => {
  const zbom: LegacyEBOMAttributes['zbom'] = {
    baseId: item.baseId,
    inheritanceState: item.inheritanceState,
  };

  if (item.sourceItemId) {
    zbom.sourceItemId = item.sourceItemId;
  }

  if (item.sourceBaseId) {
    zbom.sourceBaseId = item.sourceBaseId;
  }

  if (item.designMasterPartId) {
    zbom.designMasterPartId = item.designMasterPartId;
  }

  if (item.lockedFields) {
    zbom.lockedFields = [...item.lockedFields];
  }

  return { zbom };
};

export function toLegacyBOMNode(resolvedItems: EBOMItem[], rootItemId: string): BOMNode {
  const rootItem = resolvedItems.find((item) => item.id === rootItemId);

  if (!rootItem) {
    throw new Error(`EBOM root item not found: ${rootItemId}`);
  }

  const childrenByParentId = new Map<string, EBOMItem[]>();

  for (const item of resolvedItems) {
    if (!item.parentItemId) {
      continue;
    }

    const siblings = childrenByParentId.get(item.parentItemId) ?? [];
    siblings.push(item);
    childrenByParentId.set(item.parentItemId, siblings);
  }

  const buildNode = (item: EBOMItem, ancestors: string[] = []): BOMNode => {
    if (ancestors.includes(item.id)) {
      throw new Error(`EBOM item parent cycle detected: ${[...ancestors, item.id].join(' -> ')}`);
    }

    const nextAncestors = [...ancestors, item.id];
    const childItems = childrenByParentId.get(item.id) ?? [];
    const children = childItems.map((child) => buildNode(child, nextAncestors));

    return {
      id: item.id,
      partNumber: item.partNumber,
      name: item.name,
      revision: item.revision,
      state: LifecycleState.Draft,
      type: children.length > 0 ? ComponentType.Assembly : ComponentType.Part,
      quantity: item.quantity,
      unit: item.unit,
      cost: 0,
      currency: 'USD',
      customAttributes: toCustomAttributes(item),
      ...(children.length > 0 ? { children } : {}),
    };
  };

  return buildNode(rootItem);
}
