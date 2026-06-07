import { BOMNode, ComponentType, LifecycleState } from '../types';
import { BOMNodeSchema } from '../schemas';

// Helper to sanitize string for CSV (handle commas, quotes)
const escapeCSV = (str: string | undefined) => {
  if (!str) return '';
  const stringified = String(str);
  if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
    return `"${stringified.replace(/"/g, '""')}"`;
  }
  return stringified;
};

export const exportBOMToCSV = (rootNode: BOMNode): string => {
  const headers = ['Level', 'Part Number', 'Name', 'Description', 'Revision', 'State', 'Type', 'Quantity', 'Unit Cost', 'Manufacturer', 'MPN'];
  const rows: string[] = [headers.join(',')];

  const traverse = (node: BOMNode, level: number) => {
    const row = [
      level,
      escapeCSV(node.partNumber),
      escapeCSV(node.name),
      escapeCSV(node.description),
      escapeCSV(node.revision),
      escapeCSV(node.state),
      escapeCSV(node.type),
      node.quantity,
      node.cost,
      escapeCSV(node.manufacturer),
      escapeCSV(node.mpn)
    ];
    rows.push(row.join(','));

    if (node.children) {
      node.children.forEach(child => traverse(child, level + 1));
    }
  };

  traverse(rootNode, 0);
  return rows.join('\n');
};

export const parseCSVToBOM = (csvText: string): BOMNode | null => {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return null; // Header + 1 row minimum

  const parseLine = (line: string) => {
    const res = [];
    let inQuote = false;
    let current = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') { inQuote = !inQuote; continue; }
      if (char === ',' && !inQuote) { res.push(current); current = ''; continue; }
      current += char;
    }
    res.push(current);
    return res;
  };

  const headers = parseLine(lines[0]).map(h => h.trim().toLowerCase());
  
  // Find column indices
  const levelIdx = headers.findIndex(h => h === 'level' || h === 'bom level' || h === 'indent');
  const pnIdx = headers.findIndex(h => h === 'part number' || h === 'partnumber' || h === 'pn' || h.includes('part number'));
  const nameIdx = headers.findIndex(h => h === 'name' || h === 'item name' || h === 'description' || h.includes('name'));
  const descIdx = headers.findIndex(h => h === 'description' || h.includes('desc'));
  const revIdx = headers.findIndex(h => h === 'revision' || h === 'rev');
  const stateIdx = headers.findIndex(h => h === 'state' || h === 'lifecycle state');
  const typeIdx = headers.findIndex(h => h === 'type' || h === 'component type');
  const qtyIdx = headers.findIndex(h => h === 'quantity' || h === 'qty');
  const costIdx = headers.findIndex(h => h === 'unit cost' || h === 'cost' || h === 'price');
  const mfrIdx = headers.findIndex(h => h === 'manufacturer' || h === 'mfr');
  const mpnIdx = headers.findIndex(h => h === 'mpn' || h === 'mfg part number');

  // Skip header
  const dataRows = lines.slice(1).map(parseLine);

  const rootStack: BOMNode[] = [];
  let rootNode: BOMNode | null = null;

  // Let's determine indentation pattern if level column is absent
  let useIndentation = levelIdx === -1;

  dataRows.forEach((row, index) => {
    let rawPn = pnIdx !== -1 ? row[pnIdx] || '' : row[1] || '';
    let level = 0;

    if (useIndentation) {
      // Calculate level based on leading spaces or dots in Part Number
      const match = rawPn.match(/^([.\s]+)/);
      if (match) {
        const prefix = match[1];
        if (prefix.includes('.')) {
          level = prefix.split('.').length - 1;
        } else {
          // Spaces - assume 2 or 4 spaces per level
          level = Math.floor(prefix.length / 2);
        }
      }
    } else {
      const rawLevel = levelIdx !== -1 ? row[levelIdx] || '' : '0';
      if (rawLevel.includes('.')) {
        // Dot separated like 1.1.1
        level = rawLevel.split('.').length - 1;
      } else {
        level = parseInt(rawLevel, 10);
      }
    }

    if (isNaN(level)) level = 0;

    // Clean Part Number (strip leading dots/spaces)
    const partNumber = rawPn.replace(/^[.\s]+/, '').trim();
    const name = (nameIdx !== -1 ? row[nameIdx] : row[2]) || 'Imported Item';
    const description = (descIdx !== -1 ? row[descIdx] : row[3]) || '';
    const revision = (revIdx !== -1 ? row[revIdx] : row[4]) || 'A';
    const state = (stateIdx !== -1 ? row[stateIdx] as LifecycleState : undefined) || LifecycleState.Draft;
    const type = (typeIdx !== -1 ? row[typeIdx] as ComponentType : undefined) || ComponentType.Part;
    const quantity = parseFloat(qtyIdx !== -1 ? row[qtyIdx] : row[7]) || 1;
    const cost = parseFloat(costIdx !== -1 ? row[costIdx] : row[8]) || 0;
    const manufacturer = (mfrIdx !== -1 ? row[mfrIdx] : row[9]) || '';
    const mpn = (mpnIdx !== -1 ? row[mpnIdx] : row[10]) || '';

    const node: BOMNode = {
      id: `imp-${Date.now()}-${index}`,
      partNumber,
      name,
      description,
      revision,
      state,
      type,
      quantity,
      unit: 'EA',
      cost,
      currency: 'USD',
      manufacturer,
      mpn,
      children: []
    };

    if (level === 0 || !rootNode) {
      if (!rootNode) {
        rootNode = node;
        rootStack[0] = node;
      } else {
        if (!rootNode.children) rootNode.children = [];
        rootNode.children.push(node);
        rootStack[1] = node;
      }
    } else {
      const parent = rootStack[level - 1];
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(node);
        rootStack[level] = node;
      } else {
        let foundParent = null;
        for (let i = level - 1; i >= 0; i--) {
          if (rootStack[i]) {
            foundParent = rootStack[i];
            break;
          }
        }
        const parentToUse = foundParent || rootNode;
        if (parentToUse) {
          if (!parentToUse.children) parentToUse.children = [];
          parentToUse.children.push(node);
          rootStack[level] = node;
        }
      }
    }
  });

  // Validate with Zod
  if (rootNode) {
    try {
      BOMNodeSchema.parse(rootNode);
    } catch (e) {
      console.error("Validation Failed", e);
      return null;
    }
  }

  return rootNode;
};
