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

    it('updates the active project ID', () => {
        useProductConfigStore.getState().setActiveProject('project-next-platform');

        expect(useProductConfigStore.getState().activeProjectId).toBe('project-next-platform');
    });

    it('tracks the selected workflow SKU and resolves its context', () => {
        const store = useProductConfigStore.getState();

        store.selectWorkflowSKU('sku-zp-a-pro-blk-us-rtl');

        expect(useProductConfigStore.getState().selectedWorkflowSKUId).toBe('sku-zp-a-pro-blk-us-rtl');
        expect(useProductConfigStore.getState().getSelectedWorkflowSKUContext()).toMatchObject({
            sku: { id: 'sku-zp-a-pro-blk-us-rtl' },
            structure: { id: 'structure-zp-a-pro' },
            series: { id: 'series-zp-a' },
            project: { id: 'project-zphone-2026' },
        });
    });

    it('falls back to the first SKU in the active project when the selected workflow SKU is out of scope', () => {
        const store = useProductConfigStore.getState();

        useProductConfigStore.setState((state) => ({
            projects: [
                ...state.projects,
                {
                    id: 'project-next-platform',
                    code: 'NP27',
                    name: 'Next Platform',
                    phase: 'EVT',
                    primarySeriesId: 'series-next-a',
                    status: 'active',
                },
            ],
            series: [
                ...state.series,
                {
                    id: 'series-next-a',
                    projectId: 'project-next-platform',
                    code: 'NP-A',
                    name: 'Next A Series',
                    isPrimary: true,
                },
            ],
            structures: [
                ...state.structures,
                {
                    id: 'structure-next-a-std',
                    projectId: 'project-next-platform',
                    seriesId: 'series-next-a',
                    code: 'STD',
                    name: 'Next Standard Structure',
                },
            ],
            skus: [
                ...state.skus,
                {
                    id: 'sku-next-a-std-blk-us-rtl',
                    projectId: 'project-next-platform',
                    seriesId: 'series-next-a',
                    structureId: 'structure-next-a-std',
                    code: 'NP-A-STD-BLK-US-RTL',
                    status: 'active',
                    optionIds: [],
                    generatedByRule: true,
                },
            ],
        }));

        store.selectWorkflowSKU('sku-zp-a-pro-blk-us-rtl');
        store.setActiveProject('project-next-platform');

        expect(useProductConfigStore.getState().getSelectedWorkflowSKUContext()).toMatchObject({
            sku: { id: 'sku-next-a-std-blk-us-rtl' },
            structure: { id: 'structure-next-a-std' },
            series: { id: 'series-next-a' },
            project: { id: 'project-next-platform' },
        });
    });

    it('resets mutated state to the initial mock configuration', () => {
        const store = useProductConfigStore.getState();

        store.setActiveProject('project-next-platform');
        store.activateSKU('sku-zp-a-pro-blk-us-rtl');
        store.freezeSKU('sku-zp-a-pro-blk-us-rtl');
        store.reset();

        const resetState = useProductConfigStore.getState();
        expect(resetState.activeProjectId).toBe('project-zphone-2026');
        expect(resetState.skus.find((sku) => sku.id === 'sku-zp-a-pro-blk-us-rtl')?.status).toBe('candidate');
        expect(resetState.skus.find((sku) => sku.id === 'sku-zp-a-pro-blk-us-rtl')?.frozenAt).toBeUndefined();
    });

    it('filters SKUs by structure', () => {
        const skus = useProductConfigStore.getState().getSKUsByStructure('structure-zp-a-std');

        expect(skus.length).toBeGreaterThan(0);
        expect(skus.every((sku) => sku.structureId === 'structure-zp-a-std')).toBe(true);
    });

    it('seeds realistic trial SKUs across structures and lifecycle statuses', () => {
        const skus = useProductConfigStore.getState().skus;
        const statuses = new Set(skus.map((sku) => sku.status));
        const structuresByStatus = skus.reduce<Record<string, Set<string>>>((groups, sku) => ({
            ...groups,
            [sku.status]: new Set([...(groups[sku.status] ?? []), sku.structureId]),
        }), {});

        expect(statuses).toEqual(new Set(['active', 'candidate', 'suppressed', 'frozen']));
        expect(new Set(skus.map((sku) => sku.structureId))).toEqual(new Set([
            'structure-zp-a-std',
            'structure-zp-a-pro',
        ]));
        expect(structuresByStatus.active).toEqual(new Set([
            'structure-zp-a-std',
            'structure-zp-a-pro',
        ]));
        expect(skus).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'sku-zp-a-pro-blk-us-rtl-active',
                structureId: 'structure-zp-a-pro',
                status: 'active',
            }),
        ]));
    });

    it('activates a candidate SKU', () => {
        const store = useProductConfigStore.getState();

        store.activateSKU('sku-zp-a-pro-blk-us-rtl');

        expect(useProductConfigStore.getState().skus.find((sku) => sku.id === 'sku-zp-a-pro-blk-us-rtl')?.status).toBe('active');
    });

    it('does not activate non-candidate SKUs', () => {
        const store = useProductConfigStore.getState();

        store.activateSKU('sku-zp-a-std-blk-us-rtl');
        store.activateSKU('sku-zp-a-std-slv-eu-rtl');

        const skus = useProductConfigStore.getState().skus;
        expect(skus.find((sku) => sku.id === 'sku-zp-a-std-blk-us-rtl')?.status).toBe('active');
        expect(skus.find((sku) => sku.id === 'sku-zp-a-std-slv-eu-rtl')?.status).toBe('frozen');
    });

    it('freezes an active SKU', () => {
        const store = useProductConfigStore.getState();

        store.activateSKU('sku-zp-a-pro-blk-us-rtl');
        store.freezeSKU('sku-zp-a-pro-blk-us-rtl');

        const sku = useProductConfigStore.getState().skus.find((item) => item.id === 'sku-zp-a-pro-blk-us-rtl');
        expect(sku?.status).toBe('frozen');
        expect(sku?.frozenAt).toBeDefined();
    });

    it('does not freeze suppressed SKUs', () => {
        useProductConfigStore.getState().freezeSKU('sku-zp-a-pro-slv-eu-bulk');

        const sku = useProductConfigStore.getState().skus.find((item) => item.id === 'sku-zp-a-pro-slv-eu-bulk');
        expect(sku?.status).toBe('suppressed');
        expect(sku?.frozenAt).toBeUndefined();
    });

    it('suppresses non-frozen SKUs', () => {
        useProductConfigStore.getState().suppressSKU('sku-zp-a-pro-blk-us-rtl');

        expect(useProductConfigStore.getState().skus.find((sku) => sku.id === 'sku-zp-a-pro-blk-us-rtl')?.status).toBe('suppressed');
    });

    it('does not suppress frozen SKUs', () => {
        useProductConfigStore.getState().suppressSKU('sku-zp-a-std-slv-eu-rtl');

        const sku = useProductConfigStore.getState().skus.find((item) => item.id === 'sku-zp-a-std-slv-eu-rtl');
        expect(sku?.status).toBe('frozen');
        expect(sku?.frozenAt).toBe('2026-05-22T00:00:00.000Z');
    });

    it('returns active and frozen SKUs only for the requested project', () => {
        const otherProjectSKU = {
            id: 'sku-other-active',
            projectId: 'project-other',
            seriesId: 'series-other',
            structureId: 'structure-other',
            code: 'OTHER-ACTIVE',
            status: 'active' as const,
            optionIds: [],
            generatedByRule: true,
        };

        useProductConfigStore.setState((state) => ({
            skus: [...state.skus, otherProjectSKU],
        }));

        const activeSkus = useProductConfigStore.getState().getActiveSKUs('project-zphone-2026');

        expect(activeSkus).toHaveLength(3);
        expect(activeSkus.map((sku) => sku.status).sort()).toEqual(['active', 'active', 'frozen']);
        expect(activeSkus.every((sku) => sku.projectId === 'project-zphone-2026')).toBe(true);
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
