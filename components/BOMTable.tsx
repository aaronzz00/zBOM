import React, { useMemo } from 'react';
import { BOMNode, LifecycleState, ComponentType, Permission } from '../types';
import { ChevronRight, ChevronDown, FileText, Component, Package, Cpu, Database, AlertTriangle, TrendingDown, Target, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface BOMTableProps {
  data: BOMNode;
  onSelect: (node: BOMNode) => void;
  selectedId: string | null;
}

// Flatten the recursive structure for the table view, tracking depth
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

// P0 Feature: Analyze RefDes Uniqueness
// Returns a Set of RefDes strings that are duplicates, and a Map of NodeID -> DuplicatedRefDesString[]
const analyzeRefDesDuplicates = (rootNode: BOMNode) => {
    const refDesMap = new Map<string, string[]>(); // RefDes -> [NodeIDs]
    const duplicates = new Map<string, string[]>(); // NodeID -> [ConflictingRefDes]

    const traverse = (node: BOMNode) => {
        if (node.refDes) {
            const desList = node.refDes.split(',').map(s => s.trim()).filter(s => s);
            desList.forEach(des => {
                if (!refDesMap.has(des)) {
                    refDesMap.set(des, []);
                }
                refDesMap.get(des)?.push(node.id);
            });
        }
        if (node.children) {
            node.children.forEach(traverse);
        }
    };

    traverse(rootNode);

    // Identify duplicates
    refDesMap.forEach((nodeIds, des) => {
        if (nodeIds.length > 1) {
            nodeIds.forEach(id => {
                if (!duplicates.has(id)) duplicates.set(id, []);
                duplicates.get(id)?.push(des);
            });
        }
    });

    return duplicates;
};

export const BOMTable: React.FC<BOMTableProps> = ({ data, onSelect, selectedId }) => {
  const { hasPermission } = useAuth();
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set(['root', 'n2', 'n2-3']));

  const canViewCost = hasPermission(Permission.VIEW_COST);

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

  const rows = useMemo(() => flattenBOM(data, 0, expandedIds), [data, expandedIds]);
  
  // Calculate duplicates map
  const duplicateMap = useMemo(() => analyzeRefDesDuplicates(data), [data]);

  const getLifecycleColor = (state: LifecycleState) => {
    switch (state) {
      case LifecycleState.Released: return 'bg-green-100 text-green-700 border-green-200';
      case LifecycleState.Draft: return 'bg-slate-100 text-slate-600 border-slate-200';
      case LifecycleState.InReview: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case LifecycleState.Obsolete: return 'bg-red-100 text-red-700 border-red-200';
      case LifecycleState.Prototype: return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeIcon = (type: ComponentType) => {
    switch(type) {
      case ComponentType.Assembly: return <Package className="w-3.5 h-3.5 text-blue-500" />;
      case ComponentType.Part: return <Component className="w-3.5 h-3.5 text-slate-500" />;
      case ComponentType.Material: return <Database className="w-3.5 h-3.5 text-amber-500" />;
      case ComponentType.Software: return <FileText className="w-3.5 h-3.5 text-purple-500" />;
      default: return <Component className="w-3.5 h-3.5" />;
    }
  };

  const getVariantBadge = (variants?: string[]) => {
      if (!variants || variants.length === 0 || (variants.length === 1 && variants[0] === 'Common')) {
          return null; 
      }
      return (
          <div className="flex gap-1 flex-wrap">
              {variants.map(v => (
                  <span key={v} className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium">
                      {v}
                  </span>
              ))}
          </div>
      );
  };

  // Helper component for Masked Cost
  const CostCell = ({ value, prefix = '$', showTrend = false, variance = 0, isOver = false }: any) => {
      if (!canViewCost) {
          return (
            <div className="flex items-center justify-end gap-1 opacity-20 select-none" title="Hidden due to permission settings">
                 <Lock className="w-3 h-3" />
                 <span>***</span>
            </div>
          );
      }
      return (
          <div className="flex flex-col items-end">
            <span className="font-mono text-slate-700">{prefix}{value?.toFixed(2)}</span>
            {showTrend && Math.abs(variance) > 0.01 && (
                <span className={`text-[9px] font-bold flex items-center ${isOver ? 'text-red-500' : 'text-green-600'}`}>
                    {isOver ? '+' : ''}{variance.toFixed(2)}
                </span>
            )}
            </div>
      );
  };

  return (
    <div className="flex-1 bg-white overflow-hidden flex flex-col h-full border rounded-lg border-slate-200 shadow-sm">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between flex-shrink-0">
            <h3 className="text-sm font-semibold text-slate-700">Indent Level View</h3>
            <div className="flex gap-2 text-xs">
                 <button onClick={() => setExpandedIds(new Set(['root']))} className="px-2 py-1 text-slate-600 hover:bg-slate-200 rounded">Collapse All</button>
                 <button onClick={() => setExpandedIds(new Set(['root', 'n1', 'n2', 'n2-3']))} className="px-2 py-1 text-slate-600 hover:bg-slate-200 rounded">Expand Level 2</button>
            </div>
        </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 font-semibold shadow-sm">
            <tr>
              <th className="px-4 py-3 w-[260px] border-b border-r border-slate-200">Part Number</th>
              <th className="px-4 py-3 border-b border-r border-slate-200">Description</th>
              {/* P0 Feature Header */}
              <th className="px-4 py-3 w-[120px] border-b border-r border-slate-200 bg-indigo-50/30">RefDes</th>
              <th className="px-4 py-3 w-16 border-b border-r border-slate-200">Rev</th>
              <th className="px-4 py-3 w-24 border-b border-r border-slate-200">State</th>
              <th className="px-4 py-3 w-16 text-right border-b border-r border-slate-200">Qty</th>
              {/* P1 Feature Header: Target Cost */}
              <th className="px-4 py-3 w-28 text-right border-b border-r border-slate-200 bg-slate-100/30">Target</th>
              <th className="px-4 py-3 w-28 text-right border-b border-r border-slate-200 bg-slate-100/30">Actual</th>
              <th className="px-4 py-3 w-24 border-b border-slate-200">Variants</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
                const conflicts = duplicateMap.get(row.id);
                const hasTarget = row.targetCost !== undefined;
                const variance = hasTarget ? row.cost - (row.targetCost || 0) : 0;
                const isOverBudget = variance > 0;

                return (
                <tr 
                    key={row.id} 
                    onClick={() => onSelect(row)}
                    className={`group cursor-pointer transition-colors ${selectedId === row.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                >
                    <td className="px-2 py-2 border-r border-slate-100 font-mono text-slate-700 flex items-center gap-2">
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
                        <span className="font-medium truncate">{row.partNumber}</span>
                    </div>
                    </td>
                    <td className="px-4 py-2 border-r border-slate-100 text-slate-800">
                        <div className="truncate" title={row.name}>{row.name}</div>
                    </td>
                    
                    {/* RefDes with Duplicate Warning */}
                    <td className={`px-4 py-2 border-r border-slate-100 font-mono text-xs ${conflicts ? 'bg-red-50' : 'bg-indigo-50/10'}`}>
                        <div className="flex items-center justify-between">
                            <div className={`truncate max-w-[80px] ${conflicts ? 'text-red-600 font-bold' : 'text-slate-600'}`} title={row.refDes || ''}>
                                {row.refDes || '-'}
                            </div>
                            {conflicts && (
                                <div className="group/warn relative">
                                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                                    <div className="absolute left-full top-0 ml-2 w-48 p-2 bg-red-800 text-white text-[10px] rounded shadow-lg z-50 hidden group-hover/warn:block">
                                        Duplicate Designator found: <span className="font-mono font-bold">{conflicts.join(', ')}</span>.
                                        This will cause SMT failure.
                                    </div>
                                </div>
                            )}
                        </div>
                    </td>

                    <td className="px-4 py-2 border-r border-slate-100 text-slate-600">{row.revision}</td>
                    <td className="px-4 py-2 border-r border-slate-100">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getLifecycleColor(row.state)}`}>
                        {row.state}
                    </span>
                    </td>
                    <td className="px-4 py-2 text-right border-r border-slate-100 font-mono text-slate-700">{row.quantity}</td>
                    
                    {/* Target Costing Feature with FLS */}
                    <td className="px-4 py-2 text-right border-r border-slate-100 font-mono text-slate-500 bg-slate-50/30">
                        <CostCell value={row.targetCost} />
                    </td>
                    <td className="px-4 py-2 text-right border-r border-slate-100 bg-slate-50/30">
                        <CostCell value={row.cost} showTrend={hasTarget} variance={variance} isOver={isOverBudget} />
                    </td>

                    <td className="px-4 py-2 border-r border-slate-100">
                        {getVariantBadge(row.variants)}
                    </td>
                </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
};