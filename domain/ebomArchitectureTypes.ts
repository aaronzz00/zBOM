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
