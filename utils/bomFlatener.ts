import { BOMNode } from '../types';

export interface FlatBOMItem {
  id: string; // usually first occurrence id or compound
  partNumber: string;
  name: string;
  description: string;
  manufacturer: string;
  mpn: string;
  totalQuantity: number;
  unitCost: number;
  totalCost: number;
  occurrences: number; // how many times it appears in the tree
  locations: string[]; // e.g. "Main Board > U12", "Power Board > U5"
  refDes: string[]; // aggregated ref designators
}

export const flattenBOMForProcurement = (rootNode: BOMNode): FlatBOMItem[] => {
  const map = new Map<string, FlatBOMItem>();

  const traverse = (node: BOMNode, parentMultiplier: number, pathName: string) => {
    // Current total qty for this specific node instance
    const effectiveQty = node.quantity * parentMultiplier;

    // We aggregate by Part Number
    const key = node.partNumber;

    if (!map.has(key)) {
      map.set(key, {
        id: node.id,
        partNumber: node.partNumber,
        name: node.name,
        description: node.description || '',
        manufacturer: node.manufacturer || '',
        mpn: node.mpn || '',
        totalQuantity: 0,
        unitCost: node.cost,
        totalCost: 0,
        occurrences: 0,
        locations: [],
        refDes: []
      });
    }

    const item = map.get(key)!;
    item.totalQuantity += effectiveQty;
    item.totalCost += (effectiveQty * node.cost);
    item.occurrences += 1;
    item.locations.push(pathName);
    
    if (node.refDes) {
        item.refDes.push(node.refDes);
    }

    if (node.children) {
      node.children.forEach(child => {
        traverse(child, effectiveQty, `${pathName} > ${child.name}`);
      });
    }
  };

  // Start traversal. Root usually implies 1 unit of product.
  // Note: We skip adding the Root Node itself to the purchase list usually, 
  // or we treat it as the product. Let's exclude root from the list of *components* to buy,
  // but traverse its children.
  if (rootNode.children) {
      rootNode.children.forEach(child => traverse(child, 1, rootNode.name));
  } else {
      // If single node BOM
      traverse(rootNode, 1, 'Root');
  }

  return Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost); // Sort by highest spend
};