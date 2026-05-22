import { beforeEach, describe, expect, it } from 'vitest';
import { useProductConfigStore } from '../stores/useProductConfigStore';

describe('useProductConfigStore', () => {
    beforeEach(() => {
        useProductConfigStore.getState().reset();
    });

    it('loads the active project and primary series', () => {
        const state = useProductConfigStore.getState();
        const project = state.projects.find((p) => p.id === state.activeProjectId);

        expect(project?.primarySeriesId).toBe('series-zp-a');
        expect(state.series.find((s) => s.id === project?.primarySeriesId)?.isPrimary).toBe(true);
    });

    it('filters SKUs by structure', () => {
        const skus = useProductConfigStore.getState().getSKUsByStructure('structure-zp-a-std');

        expect(skus.length).toBeGreaterThan(0);
        expect(skus.every((sku) => sku.structureId === 'structure-zp-a-std')).toBe(true);
    });

    it('activates a candidate SKU', () => {
        const store = useProductConfigStore.getState();

        store.activateSKU('sku-zp-a-pro-blk-us-rtl');

        expect(useProductConfigStore.getState().skus.find((sku) => sku.id === 'sku-zp-a-pro-blk-us-rtl')?.status).toBe('active');
    });

    it('freezes an active SKU', () => {
        const store = useProductConfigStore.getState();

        store.activateSKU('sku-zp-a-pro-blk-us-rtl');
        store.freezeSKU('sku-zp-a-pro-blk-us-rtl');

        const sku = useProductConfigStore.getState().skus.find((item) => item.id === 'sku-zp-a-pro-blk-us-rtl');
        expect(sku?.status).toBe('frozen');
        expect(sku?.frozenAt).toBeDefined();
    });

    it('excludes suppressed SKUs from active SKU list', () => {
        const activeSkus = useProductConfigStore.getState().getActiveSKUs('project-zphone-2026');

        expect(activeSkus.some((sku) => sku.status === 'suppressed')).toBe(false);
    });

    it('generates candidate SKUs without mutating state', () => {
        const store = useProductConfigStore.getState();
        const originalSkus = store.skus;

        const candidates = store.generateCandidateSKUs('project-zphone-2026');

        expect(candidates).toHaveLength(16);
        expect(candidates.every((sku) => sku.status === 'candidate')).toBe(true);
        expect(useProductConfigStore.getState().skus).toBe(originalSkus);
    });
});
