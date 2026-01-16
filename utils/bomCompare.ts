import { BOMNode } from '../types';

export enum DiffStatus {
  Unchanged = 'unchanged',
  Added = 'added',
  Removed = 'removed',
  Modified = 'modified'
}

export interface BOMDiffItem {
  partNumber: string; // The primary identifier (New PN if replacement)
  oldPartNumber?: string; // If part number changed (replacement)
  name: string;
  status: DiffStatus;
  
  // Comparisons
  oldRev?: string;
  newRev?: string;
  oldQty?: number;
  newQty?: number;
  oldCost?: number;
  newCost?: number;
  
  // Context
  type: string;
  depth: number;
}

// Flatten BOM to Map<PartNumber, Node>
const flattenBOMMap = (node: BOMNode): Map<string, BOMNode> => {
  const map = new Map<string, BOMNode>();
  
  const traverse = (n: BOMNode) => {
    map.set(n.partNumber, n); 
    if (n.children) {
      n.children.forEach(traverse);
    }
  };
  
  traverse(node);
  return map;
};

// Heuristic to detect if Added Item B is a replacement for Removed Item A
// Logic: Checks if they share a common base part number (e.g. 123-456-A vs 123-456-B)
const isReplacement = (removedPN: string, addedPN: string): boolean => {
  // Simple check: do they share the first 80% of characters?
  // Or distinct check: Split by '-', check if base matches
  const baseRemoved = removedPN.split('-').slice(0, -1).join('-');
  const baseAdded = addedPN.split('-').slice(0, -1).join('-');
  
  return baseRemoved.length > 0 && baseRemoved === baseAdded;
};

const detectReplacements = (diffs: BOMDiffItem[]): BOMDiffItem[] => {
  const processedDiffs: BOMDiffItem[] = [];
  const removedMap = new Map<string, BOMDiffItem>();
  const addedList: BOMDiffItem[] = [];

  // Separate Added/Removed from others
  diffs.forEach(d => {
    if (d.status === DiffStatus.Removed) removedMap.set(d.partNumber, d);
    else if (d.status === DiffStatus.Added) addedList.push(d);
    else processedDiffs.push(d);
  });

  const matchedRemoved = new Set<string>();

  // Try to match Added items to Removed items
  addedList.forEach(added => {
    let matchFound = false;
    for (const [remPN, removed] of removedMap.entries()) {
      if (!matchedRemoved.has(remPN) && isReplacement(remPN, added.partNumber)) {
        // Found a replacement match!
        processedDiffs.push({
          ...added,
          status: DiffStatus.Modified,
          oldPartNumber: removed.partNumber,
          oldRev: removed.oldRev || removed.newRev, // removed item has its rev in one of these usually based on logic below
          // oldRev in Removed item is usually put in oldRev or newRev? In compareBOMs below:
          // Removed item: oldRev = oldNode.revision.
          oldQty: removed.oldQty,
          oldCost: removed.oldCost,
          // name might differ, keep new name
        });
        matchedRemoved.add(remPN);
        matchFound = true;
        break;
      }
    }
    if (!matchFound) {
      processedDiffs.push(added);
    }
  });

  // Add remaining removed items
  removedMap.forEach((val, key) => {
    if (!matchedRemoved.has(key)) {
      processedDiffs.push(val);
    }
  });

  return processedDiffs;
};

export const compareBOMs = (oldBOM: BOMNode, newBOM: BOMNode): BOMDiffItem[] => {
  const oldMap = flattenBOMMap(oldBOM);
  const newMap = flattenBOMMap(newBOM);
  
  const allPartNumbers = new Set([...oldMap.keys(), ...newMap.keys()]);
  const initialDiffs: BOMDiffItem[] = [];

  allPartNumbers.forEach(pn => {
    const oldNode = oldMap.get(pn);
    const newNode = newMap.get(pn);

    if (!oldNode && newNode) {
      // Added
      initialDiffs.push({
        partNumber: pn,
        name: newNode.name,
        status: DiffStatus.Added,
        newRev: newNode.revision,
        newQty: newNode.quantity,
        newCost: newNode.cost,
        type: newNode.type,
        depth: 0
      });
    } else if (oldNode && !newNode) {
      // Removed
      initialDiffs.push({
        partNumber: pn,
        name: oldNode.name,
        status: DiffStatus.Removed,
        oldRev: oldNode.revision,
        oldQty: oldNode.quantity,
        oldCost: oldNode.cost,
        type: oldNode.type,
        depth: 0
      });
    } else if (oldNode && newNode) {
      // Both exist, check for changes
      const isQtyChanged = oldNode.quantity !== newNode.quantity;
      const isRevChanged = oldNode.revision !== newNode.revision;
      const isCostChanged = oldNode.cost !== newNode.cost;

      if (isQtyChanged || isRevChanged || isCostChanged) {
        initialDiffs.push({
          partNumber: pn,
          name: newNode.name,
          status: DiffStatus.Modified,
          oldRev: oldNode.revision,
          newRev: newNode.revision,
          oldQty: oldNode.quantity,
          newQty: newNode.quantity,
          oldCost: oldNode.cost,
          newCost: newNode.cost,
          type: newNode.type,
          depth: 0
        });
      } else {
        initialDiffs.push({
          partNumber: pn,
          name: newNode.name,
          status: DiffStatus.Unchanged,
          oldRev: oldNode.revision, // Populate both for consistent display
          newRev: newNode.revision,
          oldQty: oldNode.quantity,
          newQty: newNode.quantity,
          oldCost: oldNode.cost,
          newCost: newNode.cost,
          type: newNode.type,
          depth: 0
        });
      }
    }
  });

  // Post-process to merge replacements (Part Number Changes)
  const finalDiffs = detectReplacements(initialDiffs);

  // Sort by Status then Part Number
  return finalDiffs.sort((a, b) => {
    const score = (status: DiffStatus) => {
      switch (status) {
        case DiffStatus.Modified: return 0;
        case DiffStatus.Added: return 1;
        case DiffStatus.Removed: return 2;
        case DiffStatus.Unchanged: return 3;
      }
    };
    if (score(a.status) !== score(b.status)) {
      return score(a.status) - score(b.status);
    }
    return a.partNumber.localeCompare(b.partNumber);
  });
};