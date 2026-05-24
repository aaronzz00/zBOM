import { beforeEach, describe, expect, it } from 'vitest';
import { mockEBOMBases, mockEBOMItems } from '../data/mockEBOMArchitecture';
import { mockMBOMDeltaItems, mockMBOMDeltaPacks } from '../data/mockMBOMDeltas';
import { useMBOMDeltaStore } from '../stores/useMBOMDeltaStore';
import { resolveEBOMBase } from '../utils/ebomInheritance';

const selectedSKUId = 'sku-zp-a-std-blk-us-rtl';
const unknownSKUId = 'sku-unknown';

describe('useMBOMDeltaStore', () => {
    beforeEach(() => {
        useMBOMDeltaStore.getState().reset();
    });

    it('loads the initial mock delta state', () => {
        const state = useMBOMDeltaStore.getState();

        expect(state.deltaPacks).toEqual(mockMBOMDeltaPacks);
        expect(state.deltaItems).toEqual(mockMBOMDeltaItems);
        expect(new Set(state.deltaItems.map((item) => item.type))).toEqual(new Set([
            'add',
            'remove',
            'replace',
            'quantity-change',
            'manufacturing-only-material',
            'packaging-label-regional',
        ]));
    });

    it('returns delta packs for the selected SKU', () => {
        const packs = useMBOMDeltaStore.getState().getDeltaPacksBySKU(selectedSKUId);

        expect(packs).toHaveLength(1);
        expect(packs[0]).toMatchObject({
            skuId: selectedSKUId,
            projectId: 'project-zphone-2026',
            baseStructureId: 'structure-zp-a-std',
        });
    });

    it('returns all delta items for the selected SKU in pack item order', () => {
        const items = useMBOMDeltaStore.getState().getDeltaItemsBySKU(selectedSKUId);
        const pack = mockMBOMDeltaPacks.find((item) => item.skuId === selectedSKUId);

        expect(items.map((item) => item.id)).toEqual(pack?.deltaItemIds);
    });

    it('groups delta items by exact delta type and includes required types', () => {
        const grouped = useMBOMDeltaStore.getState().groupDeltaItemsByType(selectedSKUId);

        expect(grouped['manufacturing-only-material']?.map((item) => item.id)).toEqual([
            'mbom-delta-item-adhesive-fixture',
        ]);
        expect(grouped['packaging-label-regional']?.map((item) => item.id)).toEqual([
            'mbom-delta-item-us-retail-label',
        ]);
        expect(grouped['quantity-change']?.map((item) => item.id)).toEqual([
            'mbom-delta-item-screw-quantity',
        ]);
        expect(grouped.add).toBeUndefined();
    });

    it('returns empty selections for an unknown SKU', () => {
        const store = useMBOMDeltaStore.getState();

        expect(store.getDeltaPacksBySKU(unknownSKUId)).toEqual([]);
        expect(store.getDeltaItemsBySKU(unknownSKUId)).toEqual([]);
        expect(store.groupDeltaItemsByType(unknownSKUId)).toEqual({});
    });

    it('restores mutated state on reset', () => {
        useMBOMDeltaStore.setState({
            deltaPacks: [],
            deltaItems: [
                {
                    id: 'mutated-item',
                    packId: 'mutated-pack',
                    type: 'add',
                    reason: 'Temporary mutation',
                },
            ],
        });

        useMBOMDeltaStore.getState().reset();

        const state = useMBOMDeltaStore.getState();
        expect(state.deltaPacks).toEqual(mockMBOMDeltaPacks);
        expect(state.deltaItems).toEqual(mockMBOMDeltaItems);
    });

    it('keeps manufacturing-only materials as MBOM delta data rather than EBOM parts', () => {
        const manufacturingOnlyItem = mockMBOMDeltaItems.find((item) => (
            item.type === 'manufacturing-only-material'
        ));

        expect(manufacturingOnlyItem).toMatchObject({
            id: 'mbom-delta-item-adhesive-fixture',
            packId: 'mbom-delta-pack-zp-a-std-blk-us-rtl-rev-a',
            newPartNumber: 'MFG-ADH-FIX-003',
        });
        expect(manufacturingOnlyItem?.targetPartNumber).toBeUndefined();
    });

    it('returns a composed MBOM preview for resolved EBOM base items and SKU deltas', () => {
        const resolvedEBOMItems = resolveEBOMBase(
            'ebom-structure-zp-a-std',
            mockEBOMBases,
            mockEBOMItems
        );

        const rows = useMBOMDeltaStore.getState().getComposedMBOMPreview({
            skuId: 'sku-zp-a-std-blk-us-rtl',
            baseItems: resolvedEBOMItems,
        });

        expect(rows.some((row) => row.source === 'quantity-change')).toBe(true);
        expect(rows.some((row) => row.source === 'manufacturing-only')).toBe(true);
    });
});
