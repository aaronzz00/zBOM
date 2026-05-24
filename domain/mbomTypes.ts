export type MBOMDeltaType =
    | 'add'
    | 'remove'
    | 'replace'
    | 'quantity-change'
    | 'manufacturing-only-material'
    | 'packaging-label-regional';

export interface MBOMDeltaPack {
    id: string;
    projectId: string;
    skuId: string;
    baseStructureId: string;
    name: string;
    status: 'draft' | 'released';
    deltaItemIds: string[];
}

export interface MBOMDeltaItem {
    id: string;
    packId: string;
    type: MBOMDeltaType;
    targetPartNumber?: string;
    newPartNumber?: string;
    quantity?: number;
    reason: string;
}

export interface ReleasedMBOM {
    id: string;
    projectId: string;
    skuId: string;
    sourceBaseId: string;
    sourceDeltaPackIds: string[];
    releasedAt: string;
    revision: string;
}

export type ComposedMBOMSource =
    | 'base'
    | 'delta-add'
    | 'delta-remove'
    | 'delta-replace'
    | 'quantity-change'
    | 'manufacturing-only'
    | 'packaging-label-regional';

export interface ComposedMBOMRow {
    id: string;
    partNumber: string;
    name: string;
    quantity: number;
    unit: string;
    revision?: string;
    source: ComposedMBOMSource;
    deltaItemId?: string;
    targetPartNumber?: string;
    reason?: string;
    warning?: string;
}
