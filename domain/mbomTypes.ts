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
