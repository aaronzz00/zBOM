import { describe, expect, it } from 'vitest';
import type { EBOMItem } from '../domain/ebomArchitectureTypes';
import type { MBOMDeltaItem } from '../domain/mbomTypes';
import { composeMBOMPreview } from '../utils/mbomComposition';

const baseItems: EBOMItem[] = [
    {
        id: 'item-root',
        baseId: 'base-1',
        partNumber: 'ASM-1000',
        name: 'Phone Assembly',
        quantity: 1,
        unit: 'EA',
        revision: 'A',
        inheritanceState: 'local',
    },
    {
        id: 'item-display',
        baseId: 'base-1',
        parentItemId: 'item-root',
        partNumber: 'DSP-1000',
        name: 'Display Module',
        quantity: 1,
        unit: 'EA',
        revision: 'A',
        inheritanceState: 'local',
    },
    {
        id: 'item-bracket',
        baseId: 'base-1',
        parentItemId: 'item-root',
        partNumber: 'BRK-2000',
        name: 'Support Bracket',
        quantity: 2,
        unit: 'EA',
        revision: 'B',
        inheritanceState: 'local',
    },
    {
        id: 'item-label',
        baseId: 'base-1',
        parentItemId: 'item-root',
        partNumber: 'LBL-GLOBAL',
        name: 'Global Packaging Label',
        quantity: 1,
        unit: 'EA',
        revision: 'A',
        inheritanceState: 'local',
    },
];

const delta = (item: Partial<MBOMDeltaItem> & Pick<MBOMDeltaItem, 'id' | 'type'>): MBOMDeltaItem => ({
    packId: 'pack-1',
    reason: 'Regional manufacturing adjustment',
    ...item,
});

describe('composeMBOMPreview', () => {
    it('converts base EBOM rows into composed base rows', () => {
        expect(composeMBOMPreview(baseItems, [])).toEqual([
            {
                id: 'base:item-root',
                partNumber: 'ASM-1000',
                name: 'Phone Assembly',
                quantity: 1,
                unit: 'EA',
                revision: 'A',
                source: 'base',
            },
            {
                id: 'base:item-display',
                partNumber: 'DSP-1000',
                name: 'Display Module',
                quantity: 1,
                unit: 'EA',
                revision: 'A',
                source: 'base',
            },
            {
                id: 'base:item-bracket',
                partNumber: 'BRK-2000',
                name: 'Support Bracket',
                quantity: 2,
                unit: 'EA',
                revision: 'B',
                source: 'base',
            },
            {
                id: 'base:item-label',
                partNumber: 'LBL-GLOBAL',
                name: 'Global Packaging Label',
                quantity: 1,
                unit: 'EA',
                revision: 'A',
                source: 'base',
            },
        ]);
    });

    it('applies add, remove, replace, quantity, manufacturing, and packaging deltas in input order', () => {
        const deltaItems: MBOMDeltaItem[] = [
            delta({
                id: 'delta-add-screw',
                type: 'add',
                newPartNumber: 'SCR-9000',
                quantity: 4,
                reason: 'Assembly screw added for final build',
            }),
            delta({
                id: 'delta-remove-bracket',
                type: 'remove',
                targetPartNumber: 'BRK-2000',
                reason: 'Bracket is not installed in the factory variant',
            }),
            delta({
                id: 'delta-replace-display',
                type: 'replace',
                targetPartNumber: 'DSP-1000',
                newPartNumber: 'DSP-1000-US',
                reason: 'Use US display supplier',
            }),
            delta({
                id: 'delta-quantity-label',
                type: 'quantity-change',
                targetPartNumber: 'LBL-GLOBAL',
                quantity: 2,
                reason: 'Add spare label for retail packaging',
            }),
            delta({
                id: 'delta-mfg-adhesive',
                type: 'manufacturing-only-material',
                newPartNumber: 'ADH-3000',
                reason: 'Manufacturing adhesive fixture',
            }),
            delta({
                id: 'delta-us-label',
                type: 'packaging-label-regional',
                targetPartNumber: 'LBL-GLOBAL',
                newPartNumber: 'LBL-US-RETAIL',
                reason: 'US retail compliance label',
            }),
            delta({
                id: 'delta-ca-label',
                type: 'packaging-label-regional',
                newPartNumber: 'LBL-CA-RETAIL',
                quantity: 3,
                reason: 'Canada retail compliance label',
            }),
        ];

        const baseBefore = structuredClone(baseItems);
        const deltaBefore = structuredClone(deltaItems);
        const preview = composeMBOMPreview(baseItems, deltaItems);

        expect(preview).toEqual([
            {
                id: 'base:item-root',
                partNumber: 'ASM-1000',
                name: 'Phone Assembly',
                quantity: 1,
                unit: 'EA',
                revision: 'A',
                source: 'base',
            },
            {
                id: 'base:item-display',
                partNumber: 'DSP-1000-US',
                name: 'Display Module',
                quantity: 1,
                unit: 'EA',
                revision: 'A',
                source: 'delta-replace',
                deltaItemId: 'delta-replace-display',
                targetPartNumber: 'DSP-1000',
                reason: 'Use US display supplier',
            },
            {
                id: 'base:item-bracket',
                partNumber: 'BRK-2000',
                name: 'Support Bracket',
                quantity: 2,
                unit: 'EA',
                revision: 'B',
                source: 'delta-remove',
                deltaItemId: 'delta-remove-bracket',
                targetPartNumber: 'BRK-2000',
                reason: 'Bracket is not installed in the factory variant',
            },
            {
                id: 'base:item-label',
                partNumber: 'LBL-US-RETAIL',
                name: 'Global Packaging Label',
                quantity: 2,
                unit: 'EA',
                revision: 'A',
                source: 'packaging-label-regional',
                deltaItemId: 'delta-us-label',
                targetPartNumber: 'LBL-GLOBAL',
                reason: 'US retail compliance label',
            },
            {
                id: 'delta:delta-add-screw',
                partNumber: 'SCR-9000',
                name: 'Assembly screw added for final build',
                quantity: 4,
                unit: 'EA',
                source: 'delta-add',
                deltaItemId: 'delta-add-screw',
                reason: 'Assembly screw added for final build',
            },
            {
                id: 'delta:delta-mfg-adhesive',
                partNumber: 'ADH-3000',
                name: 'Manufacturing adhesive fixture',
                quantity: 1,
                unit: 'EA',
                source: 'manufacturing-only',
                deltaItemId: 'delta-mfg-adhesive',
                reason: 'Manufacturing adhesive fixture',
            },
            {
                id: 'delta:delta-ca-label',
                partNumber: 'LBL-CA-RETAIL',
                name: 'Canada retail compliance label',
                quantity: 3,
                unit: 'EA',
                source: 'packaging-label-regional',
                deltaItemId: 'delta-ca-label',
                reason: 'Canada retail compliance label',
            },
        ]);
        expect(baseItems).toEqual(baseBefore);
        expect(deltaItems).toEqual(deltaBefore);
    });

    it('creates warning rows for unknown target part numbers', () => {
        const preview = composeMBOMPreview(baseItems, [
            delta({
                id: 'delta-remove-missing',
                type: 'remove',
                targetPartNumber: 'MISSING-404',
                reason: 'Attempted removal of unknown part',
            }),
        ]);

        expect(preview.at(-1)).toEqual({
            id: 'warning:delta-remove-missing',
            partNumber: 'MISSING-404',
            name: 'Attempted removal of unknown part',
            quantity: 1,
            unit: 'EA',
            source: 'delta-remove',
            deltaItemId: 'delta-remove-missing',
            targetPartNumber: 'MISSING-404',
            reason: 'Attempted removal of unknown part',
            warning: 'Target part number not found: MISSING-404',
        });
    });

    it('creates independent warning rows for repeated missing-target deltas', () => {
        const preview = composeMBOMPreview(baseItems, [
            delta({
                id: 'delta-remove-missing',
                type: 'remove',
                targetPartNumber: 'MISSING-404',
                reason: 'Attempted removal of unknown part',
            }),
            delta({
                id: 'delta-quantity-missing',
                type: 'quantity-change',
                targetPartNumber: 'MISSING-404',
                quantity: 7,
                reason: 'Attempted quantity change for unknown part',
            }),
        ]);

        const warningRows = preview.filter((row) => row.warning);

        expect(warningRows).toEqual([
            {
                id: 'warning:delta-remove-missing',
                partNumber: 'MISSING-404',
                name: 'Attempted removal of unknown part',
                quantity: 1,
                unit: 'EA',
                source: 'delta-remove',
                deltaItemId: 'delta-remove-missing',
                targetPartNumber: 'MISSING-404',
                reason: 'Attempted removal of unknown part',
                warning: 'Target part number not found: MISSING-404',
            },
            {
                id: 'warning:delta-quantity-missing',
                partNumber: 'MISSING-404',
                name: 'Attempted quantity change for unknown part',
                quantity: 7,
                unit: 'EA',
                source: 'quantity-change',
                deltaItemId: 'delta-quantity-missing',
                targetPartNumber: 'MISSING-404',
                reason: 'Attempted quantity change for unknown part',
                warning: 'Target part number not found: MISSING-404',
            },
        ]);
    });

    it('marks quantity-change when it is the final delta on the target row', () => {
        const preview = composeMBOMPreview(baseItems, [
            delta({
                id: 'delta-quantity-display',
                type: 'quantity-change',
                targetPartNumber: 'DSP-1000',
                quantity: 2,
                reason: 'Use two display protectors during manufacturing',
            }),
        ]);

        expect(preview.find((row) => row.id === 'base:item-display')).toMatchObject({
            partNumber: 'DSP-1000',
            quantity: 2,
            source: 'quantity-change',
            deltaItemId: 'delta-quantity-display',
            targetPartNumber: 'DSP-1000',
            reason: 'Use two display protectors during manufacturing',
        });
    });

    it('matches later deltas against the original target after a replace changes the part number', () => {
        const preview = composeMBOMPreview(baseItems, [
            delta({
                id: 'delta-replace-display',
                type: 'replace',
                targetPartNumber: 'DSP-1000',
                newPartNumber: 'DSP-1000-US',
                reason: 'Use US display supplier',
            }),
            delta({
                id: 'delta-quantity-display',
                type: 'quantity-change',
                targetPartNumber: 'DSP-1000',
                quantity: 2,
                reason: 'Use two display protectors during manufacturing',
            }),
        ]);

        expect(preview.find((row) => row.id === 'base:item-display')).toMatchObject({
            partNumber: 'DSP-1000-US',
            quantity: 2,
            source: 'quantity-change',
            deltaItemId: 'delta-quantity-display',
            targetPartNumber: 'DSP-1000',
            reason: 'Use two display protectors during manufacturing',
        });
        expect(preview.find((row) => row.id === 'warning:delta-quantity-display')).toBeUndefined();
    });
});
