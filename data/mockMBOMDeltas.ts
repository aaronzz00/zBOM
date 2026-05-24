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
    {
        id: 'mbom-delta-pack-zp-a-pro-blk-us-rtl-active-rev-a',
        projectId: 'project-zphone-2026',
        skuId: 'sku-zp-a-pro-blk-us-rtl-active',
        baseStructureId: 'structure-zp-a-pro',
        name: 'US Retail Black Pro Manufacturing Delta',
        status: 'draft',
        deltaItemIds: [
            'mbom-delta-item-pro-camera-bracket-add',
            'mbom-delta-item-pro-camera-module-remove',
            'mbom-delta-item-pro-display-replace',
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
    {
        id: 'mbom-delta-item-pro-camera-bracket-add',
        packId: 'mbom-delta-pack-zp-a-pro-blk-us-rtl-active-rev-a',
        type: 'add',
        newPartNumber: 'ZP26-5400-PRO-BRKT',
        quantity: 1,
        reason: 'Pro camera station adds a local alignment bracket during manufacturing assembly.',
    },
    {
        id: 'mbom-delta-item-pro-camera-module-remove',
        packId: 'mbom-delta-pack-zp-a-pro-blk-us-rtl-active-rev-a',
        type: 'remove',
        targetPartNumber: 'ZP26-5300-PRO',
        reason: 'Manufacturing preview removes the engineering camera module before applying localized MBOM replacements.',
    },
    {
        id: 'mbom-delta-item-pro-display-replace',
        packId: 'mbom-delta-pack-zp-a-pro-blk-us-rtl-active-rev-a',
        type: 'replace',
        targetPartNumber: 'ZP26-4100-PRO',
        newPartNumber: 'ZP26-4100-PRO-US-MFG',
        quantity: 1,
        reason: 'US retail Pro manufacturing uses a pre-kitted display module variant.',
    },
];
