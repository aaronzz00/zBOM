import { create } from 'zustand';
import { mockMBOMDeltaItems, mockMBOMDeltaPacks } from '../data/mockMBOMDeltas';
import { MBOMDeltaItem, MBOMDeltaPack, MBOMDeltaType } from '../domain/mbomTypes';

export interface MBOMDeltaState {
    deltaPacks: MBOMDeltaPack[];
    deltaItems: MBOMDeltaItem[];
    reset: () => void;
    getDeltaPacksBySKU: (skuId: string) => MBOMDeltaPack[];
    getDeltaItemsBySKU: (skuId: string) => MBOMDeltaItem[];
    groupDeltaItemsByType: (skuId: string) => Partial<Record<MBOMDeltaType, MBOMDeltaItem[]>>;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const createInitialState = () => ({
    deltaPacks: clone(mockMBOMDeltaPacks),
    deltaItems: clone(mockMBOMDeltaItems),
});

export const useMBOMDeltaStore = create<MBOMDeltaState>((set, get) => ({
    ...createInitialState(),

    reset: () => {
        set(createInitialState());
    },

    getDeltaPacksBySKU: (skuId: string) => (
        get().deltaPacks.filter((pack) => pack.skuId === skuId)
    ),

    getDeltaItemsBySKU: (skuId: string) => {
        const { deltaItems } = get();
        const itemsById = new Map(deltaItems.map((item) => [item.id, item]));

        return get().getDeltaPacksBySKU(skuId).flatMap((pack) => (
            pack.deltaItemIds
                .map((itemId) => itemsById.get(itemId))
                .filter((item): item is MBOMDeltaItem => Boolean(item))
        ));
    },

    groupDeltaItemsByType: (skuId: string) => (
        get().getDeltaItemsBySKU(skuId).reduce<Partial<Record<MBOMDeltaType, MBOMDeltaItem[]>>>(
            (groups, item) => ({
                ...groups,
                [item.type]: [...(groups[item.type] ?? []), item],
            }),
            {}
        )
    ),
}));
