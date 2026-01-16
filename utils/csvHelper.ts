import { BOMNode, ComponentType, LifecycleState } from '../types';

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

  // Basic CSV parser (ignoring complex quoted commas for this prototype, assume standard format)
  // For production, use a library like PapaParse
  const parseLine = (line: string) => {
      // Simple split by comma, handling basic quotes
      const res = [];
      let inQuote = false;
      let current = '';
      for(let i=0; i<line.length; i++) {
          const char = line[i];
          if(char === '"') { inQuote = !inQuote; continue; }
          if(char === ',' && !inQuote) { res.push(current); current = ''; continue; }
          current += char;
      }
      res.push(current);
      return res;
  };

  // Skip header
  const dataRows = lines.slice(1).map(parseLine);
  
  // Logic to reconstruct tree based on 'Level' column (index 0)
  const rootStack: BOMNode[] = [];
  let rootNode: BOMNode | null = null;

  dataRows.forEach((row, index) => {
    const level = parseInt(row[0]);
    if (isNaN(level)) return;

    const node: BOMNode = {
      id: `imp-${Date.now()}-${index}`,
      partNumber: row[1] || 'UNKNOWN',
      name: row[2] || 'Imported Item',
      description: row[3] || '',
      revision: row[4] || 'A',
      state: (row[5] as LifecycleState) || LifecycleState.Draft,
      type: (row[6] as ComponentType) || ComponentType.Part,
      quantity: parseFloat(row[7]) || 1,
      unit: 'EA', // Default
      cost: parseFloat(row[8]) || 0,
      currency: 'USD',
      manufacturer: row[9] || '',
      mpn: row[10] || '',
      children: []
    };

    if (level === 0) {
      rootNode = node;
      rootStack[0] = node;
    } else {
      // Find parent at level - 1
      const parent = rootStack[level - 1];
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(node);
        // Set self as potential parent for next level
        rootStack[level] = node;
      } else {
        console.warn(`Orphan node detected at row ${index + 2}, level ${level}`);
      }
    }
  });

  return rootNode;
};