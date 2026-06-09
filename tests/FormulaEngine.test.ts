import { describe, it, expect } from 'vitest';
import { FormulaEngine } from '../services/FormulaEngine';
import { BOMNode, ComponentType, LifecycleState } from '../types';

// Helper
const node = (id: string, type: ComponentType, cost: number, quantity: number = 1, children: BOMNode[] = []): BOMNode => ({
    id, partNumber: id, name: id, revision: 'A', state: LifecycleState.Draft,
    type, cost, quantity, unit: 'EA', currency: 'USD', children, weightG: 0
});

describe('FormulaEngine', () => {
    it('should calculate leaf node (Part) correctly', () => {
        const part = node('p1', ComponentType.Part, 10); // Cost 10
        const result = FormulaEngine.recalculate(part);

        expect(result.cost).toBe(10);
    });

    it('should rollup cost for Assembly', () => {
        // Assy -> p1(10) * 2 + p2(5) * 1
        const p1 = node('p1', ComponentType.Part, 10, 2);
        const p2 = node('p2', ComponentType.Part, 5, 1);
        const assy = node('assy', ComponentType.Assembly, 0, 1, [p1, p2]);

        const result = FormulaEngine.recalculate(assy);

        // (10*2) + (5*1) = 25
        expect(result.cost).toBe(25);
    });

    it('should rollup recursively (Deep Nested)', () => {
        const part1 = node('part1', ComponentType.Part, 10, 2);
        const subAssy = node('sub', ComponentType.Assembly, 0, 1, [part1]); // Should become 20
        const part2 = node('part2', ComponentType.Part, 5, 1);
        const root = node('root', ComponentType.Assembly, 0, 1, [subAssy, part2]);

        const result = FormulaEngine.recalculate(root);

        expect(result.children?.[0].cost).toBe(20);
        expect(result.cost).toBe(25);
    });

    it('should find where used (parents)', () => {
        // Mock data setup
        const p1 = node('p1', ComponentType.Part, 10);
        // We need to ensuring we use 'partNumber' matching. The helper sets partNumber=id.

        // Parent 1 uses p1
        const paren1 = node('parent1', ComponentType.Assembly, 0, 1, [p1]);

        // Parent 2 uses p1 (conceptually same part number)
        // Since my node() helper sets id=partNumber, let's create a "different instance" with same partNumber manually
        const p1_instance2 = { ...node('p1_instance_2', ComponentType.Part, 10), partNumber: 'p1' };
        const parent2 = node('parent2', ComponentType.Assembly, 0, 1, [p1_instance2]);

        const root = node('root', ComponentType.Assembly, 0, 1, [paren1, parent2]);

        const parents = FormulaEngine.findWhereUsed('p1', root);

        expect(parents.length).toBe(2);
        expect(parents.map(p => p.id)).toContain('parent1');
        expect(parents.map(p => p.id)).toContain('parent2');
    });
});
