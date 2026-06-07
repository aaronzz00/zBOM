import { create } from 'zustand';
import { mockMBOMDeltaItems, mockMBOMDeltaPacks } from '../data/mockMBOMDeltas';
import type { EBOMItem } from '../domain/ebomArchitectureTypes';
import type { ComposedMBOMRow, MBOMDeltaItem, MBOMDeltaPack, MBOMDeltaType } from '../domain/mbomTypes';
import { composeMBOMPreview } from '../utils/mbomComposition';

export interface MBOMDeltaState {
    deltaPacks: MBOMDeltaPack[];
    deltaItems: MBOMDeltaItem[];
    reset: () => void;
    getDeltaPacksBySKU: (skuId: string) => MBOMDeltaPack[];
    getDeltaItemsBySKU: (skuId: string) => MBOMDeltaItem[];
    groupDeltaItemsByType: (skuId: string) => Partial<Record<MBOMDeltaType, MBOMDeltaItem[]>>;
    getComposedMBOMPreview: (input: { skuId: string; baseItems: EBOMItem[] }) => ComposedMBOMRow[];
    
    // Authoring actions
    addDeltaPack: (pack: Omit<MBOMDeltaPack, 'id' | 'deltaItemIds'>) => void;
    updateDeltaPack: (packId: string, updates: Partial<MBOMDeltaPack>) => void;
    deleteDeltaPack: (packId: string) => void;
    addDeltaItem: (item: Omit<MBOMDeltaItem, 'id'>) => void;
    updateDeltaItem: (itemId: string, updates: Partial<MBOMDeltaItem>) => void;
    deleteDeltaItem: (itemId: string) => void;
}

const PACKS_STORAGE_KEY = 'zbom.mbom_delta_packs.v1';
const ITEMS_STORAGE_KEY = 'zbom.mbom_delta_items.v1';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const loadSavedPacks = (): MBOMDeltaPack[] => {
    try {
        const saved = localStorage.getItem(PACKS_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch {}
    return clone(mockMBOMDeltaPacks);
};

const loadSavedItems = (): MBOMDeltaItem[] => {
    try {
        const saved = localStorage.getItem(ITEMS_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch {}
    return clone(mockMBOMDeltaItems);
};

export const useMBOMDeltaStore = create<MBOMDeltaState>((set, get) => ({
    deltaPacks: loadSavedPacks(),
    deltaItems: loadSavedItems(),

    reset: () => {
        localStorage.removeItem(PACKS_STORAGE_KEY);
        localStorage.removeItem(ITEMS_STORAGE_KEY);
        set({
            deltaPacks: clone(mockMBOMDeltaPacks),
            deltaItems: clone(mockMBOMDeltaItems),
        });
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

    getComposedMBOMPreview: ({ skuId, baseItems }) => composeMBOMPreview(
        baseItems,
        get().getDeltaItemsBySKU(skuId)
    ),

    addDeltaPack: (pack) => {
        const newPack: MBOMDeltaPack = {
            ...pack,
            id: `mbom-delta-pack-${Date.now()}`,
            deltaItemIds: []
        };
        const updated = [...get().deltaPacks, newPack];
        localStorage.setItem(PACKS_STORAGE_KEY, JSON.stringify(updated));
        set({ deltaPacks: updated });
    },

    updateDeltaPack: (packId, updates) => {
        const updated = get().deltaPacks.map(p => p.id === packId ? { ...p, ...updates } : p);
        localStorage.setItem(PACKS_STORAGE_KEY, JSON.stringify(updated));
        set({ deltaPacks: updated });
    },

    deleteDeltaPack: (packId) => {
        const updatedPacks = get().deltaPacks.filter(p => p.id !== packId);
        const updatedItems = get().deltaItems.filter(i => i.packId !== packId);
        localStorage.setItem(PACKS_STORAGE_KEY, JSON.stringify(updatedPacks));
        localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(updatedItems));
        set({ deltaPacks: updatedPacks, deltaItems: updatedItems });
    },

    addDeltaItem: (item) => {
        const newItem: MBOMDeltaItem = {
            ...item,
            id: `mbom-delta-item-${Date.now()}`
        };
        const updated = [...get().deltaItems, newItem];
        localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(updated));

        const packs = get().deltaPacks.map(p => {
            if (p.id === item.packId) {
                return {
                    ...p,
                    deltaItemIds: [...p.deltaItemIds, newItem.id]
                };
            }
            return p;
        });
        localStorage.setItem(PACKS_STORAGE_KEY, JSON.stringify(packs));

        set({ deltaItems: updated, deltaPacks: packs });
    },

    updateDeltaItem: (itemId, updates) => {
        const updated = get().deltaItems.map(i => i.id === itemId ? { ...i, ...updates } : i);
        localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(updated));
        set({ deltaItems: updated });
    },

    deleteDeltaItem: (itemId) => {
        const targetItem = get().deltaItems.find(i => i.id === itemId);
        const updatedItems = get().deltaItems.filter(i => i.id !== itemId);
        localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(updatedItems));

        let packs = get().deltaPacks;
        if (targetItem) {
            packs = get().deltaPacks.map(p => {
                if (p.id === targetItem.packId) {
                    return {
                        ...p,
                        deltaItemIds: p.deltaItemIds.filter(id => id !== itemId)
                    };
                }
                return p;
            });
            localStorage.setItem(PACKS_STORAGE_KEY, JSON.stringify(packs));
        }

        set({ deltaItems: updatedItems, deltaPacks: packs });
    }
}));
