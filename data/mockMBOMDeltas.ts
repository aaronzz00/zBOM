import { MBOMDeltaItem, MBOMDeltaPack } from '../domain/mbomTypes';

export const mockMBOMDeltaPacks: MBOMDeltaPack[] = [
    {
        id: 'mbom-delta-pack-zp-a-std-blk-us-rtl-rev-a',
        projectId: 'project-zphone-2026',
        skuId: 'sku-zp-a-std-blk-us-rtl',
        baseStructureId: 'structure-zp-a-std',
        name: 'US Retail Black Standard Manufacturing Delta',
        status: 'released',
        deltaItemIds: [
            'mbom-delta-item-us-retail-label',
            'mbom-delta-item-adhesive-fixture',
            'mbom-delta-item-screw-quantity',
        ],
    },
];

export const mockMBOMDeltaItems: MBOMDeltaItem[] = [
    {
        id: 'mbom-delta-item-us-retail-label',
        packId: 'mbom-delta-pack-zp-a-std-blk-us-rtl-rev-a',
        type: 'packaging-label-regional',
        targetPartNumber: 'PKG-LABEL-BASE-001',
        newPartNumber: 'PKG-LABEL-US-RTL-001',
        reason: 'US retail channel requires FCC and regional compliance label artwork.',
    },
    {
        id: 'mbom-delta-item-adhesive-fixture',
        packId: 'mbom-delta-pack-zp-a-std-blk-us-rtl-rev-a',
        type: 'manufacturing-only-material',
        newPartNumber: 'MFG-ADH-FIX-003',
        quantity: 2,
        reason: 'Final assembly uses temporary adhesive tabs for US retail pack-out fixtures.',
    },
    {
        id: 'mbom-delta-item-screw-quantity',
        packId: 'mbom-delta-pack-zp-a-std-blk-us-rtl-rev-a',
        type: 'quantity-change',
        targetPartNumber: 'SCR-M1.4-BLK-002',
        quantity: 6,
        reason: 'Manufacturing route consumes two additional black chassis screws for retail security bracket.',
    },
];
