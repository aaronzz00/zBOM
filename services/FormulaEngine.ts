import { BOMNode, ComponentType } from '../types';

export class FormulaEngine {

    /**
     * Recalculates cost and weight for the entire BOM tree (bottom-up).
     * Returns a NEW BOMNode tree effectively.
     */
    static recalculate(node: BOMNode): BOMNode {
        return this.processNode(node);
    }

    private static processNode(node: BOMNode): BOMNode {
        // 1. Process Children first (Bottom-up)
        let updatedChildren: BOMNode[] = [];
        let childrenCost = 0;
        let childrenWeight = 0;

        if (node.children && node.children.length > 0) {
            updatedChildren = node.children.map(child => this.processNode(child));

            // Sum up (Cost * Qty) for each child
            updatedChildren.forEach(child => {
                const qty = child.quantity || 1;
                childrenCost += (child.cost || 0) * qty;
                childrenWeight += (child.weightG || 0) * qty;
            });
        }

        // 2. Calculate Own Values
        let newCost = node.cost;
        let newWeight = node.weightG || 0;

        if (node.type === ComponentType.Assembly) {
            newCost = childrenCost;
            newWeight = childrenWeight;
        }

        // 3. Return updated node
        return {
            ...node,
            children: updatedChildren.length > 0 ? updatedChildren : node.children,
            cost: newCost,
            weightG: newWeight
        };
    }

    /**
     * Calculates the total project cost and weight from the root node.
     * Assumes root node is the project root (Assembly).
     */
    static calculateTotals(root: BOMNode): { totalCost: number, totalWeight: number } {
        return {
            totalCost: root.cost,
            totalWeight: root.weightG || 0
        };
    }

    /**
     * Finds all parent nodes that contain a child with the given Part Number.
     */
    static findWhereUsed(partNumber: string, root: BOMNode): BOMNode[] {
        const parents: BOMNode[] = [];
        const seenParents = new Set<string>();

        const traverse = (node: BOMNode) => {
            if (node.children) {
                const matches = node.children.some(c => c.partNumber === partNumber);
                if (matches && !seenParents.has(node.id)) {
                    parents.push(node);
                    seenParents.add(node.id);
                }
                node.children.forEach(traverse);
            }
        };

        traverse(root);
        return parents;
    }
}
