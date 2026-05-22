import { describe, it, expect, beforeEach } from 'vitest';
import { useBOMStore } from '../stores/useBOMStore';
import { ComponentType, LifecycleState, BOMNode } from '../types';

// Helper to create simple node
const createNode = (id: string, cost: number, quantity: number, type: ComponentType = ComponentType.Part): BOMNode => ({
    id,
    partNumber: `PN-${id}`,
    name: 'Test Part',
    revision: 'A',
    state: LifecycleState.Draft,
    type,
    quantity,
    unit: 'EA',
    cost: cost,
    currency: 'USD',
    children: []
});

describe('useBOMStore', () => {
    beforeEach(() => {
        // Reset store
        useBOMStore.setState({
            project: { ...useBOMStore.getState().project, totalCost: 0, totalWeight: 0 },
            bomData: { ...createNode('root', 0, 1, ComponentType.Assembly) }
        });
    });

    it('should initialize with project defaults', () => {
        const { project } = useBOMStore.getState();
        expect(project.totalCost).toBeDefined();
    });

    it('should update BOM node and recalculate totals', () => {
        const root = createNode('root', 0, 1, ComponentType.Assembly);
        const child = createNode('c1', 10, 5, ComponentType.Part); // Total 50

        useBOMStore.setState({ bomData: { ...root, children: [child] } });

        // Trigger generic update to force recalc if needed, or check if setState handled it?
        // Our store logic recalculates on setBOMData.

        // Let's test updateBOMNode
        const { updateBOMNode } = useBOMStore.getState();

        // Change child cost to 20. Total should go to 100.
        updateBOMNode('c1', { cost: 20 });

        const state = useBOMStore.getState();
        expect(state.bomData.children?.[0].cost).toBe(20);
        expect(state.project.totalCost).toBe(100); // 20 * 5
    });

    it('should add BOM node correctly', () => {
        // Initial: Root
        // Add child: Cost 10, Qty 1
        const { addBOMNode } = useBOMStore.getState();
        const newNode = createNode('new1', 10, 1);

        addBOMNode('root', newNode);

        const state = useBOMStore.getState();
        expect(state.bomData.children).toHaveLength(1);
        expect(state.bomData.children?.[0].id).toBe('new1');
        expect(state.project.totalCost).toBe(10);
    });
});
