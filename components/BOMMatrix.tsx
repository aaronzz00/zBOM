import React, { useMemo } from 'react';
import { BOMNode, ComponentType } from '../types';
import { ChevronRight, ChevronDown, Check, Package, Component, Database, FileText } from 'lucide-react';

interface BOMMatrixProps {
  data: BOMNode;
  onSelect: (node: BOMNode) => void;
  selectedId: string | null;
}

// Helper to get all unique variant tags from the BOM tree
const getAllVariants = (node: BOMNode): Set<string> => {
  let variants = new Set<string>();
  if (node.variants) {
    node.variants.forEach(v => variants.add(v));
  }
  if (node.children) {
    node.children.forEach(child => {
      const childVariants = getAllVariants(child);
      childVariants.forEach(v => variants.add(v));
    });
  }
  return variants;
};

// Flatten tree for rendering
const flattenBOM = (node: BOMNode, depth = 0, expandedIds: Set<string>): Array<BOMNode & { depth: number; hasChildren: boolean }> => {
  const result: Array<BOMNode & { depth: number; hasChildren: boolean }> = [];
  result.push({ ...node, depth, hasChildren: !!(node.children && node.children.length > 0) });
  
  if (expandedIds.has(node.id) && node.children) {
    node.children.forEach(child => {
      result.push(...flattenBOM(child, depth + 1, expandedIds));
    });
  }
  return result;
};

export const BOMMatrix: React.FC<BOMMatrixProps> = ({ data, onSelect, selectedId }) => {
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set(['root', 'n2', 'n2-3']));

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedIds(newSet);
  };

  const uniqueVariants = useMemo(() => Array.from(getAllVariants(data)).sort(), [data]);
  // Move 'Common' to the front if it exists
  const sortedVariants = useMemo(() => {
      const vs = [...uniqueVariants];
      const commonIdx = vs.indexOf('Common');
      if (commonIdx > -1) {
          vs.splice(commonIdx, 1);
          vs.unshift('Common');
      }
      return vs;
  }, [uniqueVariants]);

  const rows = useMemo(() => flattenBOM(data, 0, expandedIds), [data, expandedIds]);

  const getTypeIcon = (type: ComponentType) => {
    switch(type) {
      case ComponentType.Assembly: return <Package className="w-3.5 h-3.5 text-blue-500" />;
      case ComponentType.Part: return <Component className="w-3.5 h-3.5 text-slate-500" />;
      case ComponentType.Material: return <Database className="w-3.5 h-3.5 text-amber-500" />;
      case ComponentType.Software: return <FileText className="w-3.5 h-3.5 text-purple-500" />;
      default: return <Component className="w-3.5 h-3.5" />;
    }
  };

  const renderCell = (node: BOMNode, variant: string) => {
      const nodeVariants = node.variants || [];
      const isApplicable = nodeVariants.includes('Common') || nodeVariants.includes(variant);
      
      if (!isApplicable) return <span className="text-slate-200">-</span>;

      // Special case: If the variant is specifically excluded (future feature), we could handle here.
      // For now, if "Common" is present, it shows checkmark. If "US-Only" is present, it shows checkmark in US column.
      
      // If node has 'Common', it appears in all variants.
      // If node has 'US-Only', it appears in 'US-Only' column.
      // BUT, in a Matrix, usually columns represent Final SKUs.
      // Current implementation: Columns represent the TAGS themselves for transparency.
      
      return nodeVariants.includes(variant) ? (
          <div className="flex justify-center">
             <div className="w-5 h-5 bg-blue-50 text-blue-600 rounded flex items-center justify-center">
                 <Check className="w-3.5 h-3.5" />
             </div>
          </div>
      ) : <span className="text-slate-200">-</span>;
  };

  return (
    <div className="flex-1 bg-white overflow-hidden flex flex-col h-full border rounded-lg border-slate-200 shadow-sm">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between flex-shrink-0">
          <h3 className="text-sm font-semibold text-slate-700">Variant Matrix</h3>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 font-semibold shadow-sm">
            <tr>
              <th className="px-4 py-3 w-[350px] border-b border-r border-slate-200 bg-slate-50 z-20 sticky left-0">Item Structure</th>
              {sortedVariants.map(v => (
                  <th key={v} className="px-2 py-3 w-24 text-center border-b border-r border-slate-200 min-w-[80px]">
                      <span className={`px-2 py-1 rounded text-xs ${v === 'Common' ? 'bg-slate-200 text-slate-700' : 'bg-indigo-50 text-indigo-700'}`}>
                          {v}
                      </span>
                  </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr 
                key={row.id} 
                onClick={() => onSelect(row)}
                className={`group cursor-pointer transition-colors ${selectedId === row.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
              >
                <td className="px-2 py-2 border-r border-slate-200 font-mono text-slate-700 sticky left-0 bg-inherit shadow-[1px_0_0_0_rgba(226,232,240,1)]">
                  <div style={{ paddingLeft: `${row.depth * 20}px` }} className="flex items-center min-w-0">
                    {row.hasChildren ? (
                      <button 
                        onClick={(e) => toggleExpand(row.id, e)}
                        className="p-0.5 hover:bg-slate-200 rounded mr-1 flex-shrink-0"
                      >
                        {expandedIds.has(row.id) ? 
                          <ChevronDown className="w-4 h-4 text-slate-400" /> : 
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        }
                      </button>
                    ) : (
                      <span className="w-5 mr-1 inline-block flex-shrink-0"></span>
                    )}
                    <span className="opacity-70 mr-2 flex-shrink-0" title={row.type}>{getTypeIcon(row.type)}</span>
                    <div className="flex flex-col truncate">
                        <span className="font-medium truncate">{row.partNumber}</span>
                        <span className="text-[10px] text-slate-400 truncate">{row.name}</span>
                    </div>
                  </div>
                </td>
                
                {sortedVariants.map(v => (
                    <td key={v} className="px-2 py-2 text-center border-r border-slate-100">
                        {renderCell(row, v)}
                    </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};