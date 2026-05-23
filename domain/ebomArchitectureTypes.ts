export type EBOMBaseScope = 'platform' | 'series' | 'structure';

export interface EBOMBase {
  id: string;
  projectId: string;
  scope: EBOMBaseScope;
  seriesId?: string;
  structureId?: string;
  parentBaseId?: string;
  rootItemId: string;
  revision: string;
  status: 'draft' | 'review' | 'released';
}

export type InheritanceState = 'inherited' | 'overridden' | 'local' | 'locked';

export interface EBOMItem {
  id: string;
  baseId: string;
  parentItemId?: string;
  partNumber: string;
  name: string;
  quantity: number;
  unit: string;
  revision: string;
  designMasterPartId?: string;
  sourceItemId?: string;
  sourceBaseId?: string;
  inheritanceState: InheritanceState;
  lockedFields?: Array<keyof EBOMItem>;
}

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
  itemSnapshot?: EBOMItem;
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
