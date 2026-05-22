import React, { useMemo, useRef, useState } from 'react';
import { BOMNode, LifecycleState, ComponentType, Permission } from '../types';
import { ChevronRight, ChevronDown, FileText, Component, Package, Database, AlertTriangle, Lock, Image } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppStore } from '../context/AppContext';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useViewStore } from '../stores/useViewStore';
import { WhereUsedModal } from './WhereUsedModal';

interface BOMTableProps {
    data: BOMNode;
    onSelect: (node: BOMNode) => void;
    selectedId: string | null;
    isMBOMView: boolean;
}

// Flatten helper
const flattenBOM = (node: BOMNode, depth = 0, expandedIds: Set<string>, isMBOMView: boolean): Array<BOMNode & { depth: number; hasChildren: boolean }> => {
    const result: Array<BOMNode & { depth: number; hasChildren: boolean }> = [];
    if (node.isAuxiliary && !isMBOMView) return result;

    const visibleChildren = node.children ? node.children.filter(c => isMBOMView || !c.isAuxiliary) : [];
    const hasVisibleChildren = visibleChildren.length > 0;

    result.push({ ...node, depth, hasChildren: hasVisibleChildren });

    if (expandedIds.has(node.id) && hasVisibleChildren) {
        visibleChildren.forEach(child => {
            result.push(...flattenBOM(child, depth + 1, expandedIds, isMBOMView));
        });
    }
    return result;
};

// RefDes Logic
const analyzeRefDesDuplicates = (rootNode: BOMNode) => {
    const refDesMap = new Map<string, string[]>();
    const duplicates = new Map<string, string[]>();
    const traverse = (node: BOMNode) => {
        if (node.refDes) {
            const desList = node.refDes.split(',').map(s => s.trim()).filter(s => s);
            desList.forEach(des => {
                if (!refDesMap.has(des)) refDesMap.set(des, []);
                refDesMap.get(des)?.push(node.id);
            });
        }
        if (node.children) node.children.forEach(traverse);
    };
    traverse(rootNode);
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

export const BOMTable: React.FC<BOMTableProps> = ({ data, onSelect, selectedId, isMBOMView }) => {
    const { hasPermission } = useAuth();
    const { attributeDefs } = useAppStore();
    const { isColumnVisible, toggleColumn } = useViewStore();
    const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set(['root', 'n1', 'n2', 'n2-3']));
    const parentRef = useRef<HTMLDivElement>(null);
    const [whereUsedPart, setWhereUsedPart] = useState<string | null>(null);

    const canViewCost = hasPermission(Permission.VIEW_COST);

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSet = new Set(expandedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedIds(newSet);
    };

    const rows = useMemo(() => flattenBOM(data, 0, expandedIds, isMBOMView), [data, expandedIds, isMBOMView]);
    const duplicateMap = useMemo(() => analyzeRefDesDuplicates(data), [data]);

    // Virtualizer
    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 40,
        overscan: 5,
    });

    // Grid Template Calculation
    const gridTemplateColumns = useMemo(() => {
        const cols = [
            { id: 'partNumber', width: '300px' },
            { id: 'imageUrl', width: '50px' },
            { id: 'name', width: 'minmax(200px, 1fr)' },
            { id: 'refDes', width: '100px' },
            { id: 'state', width: '100px' },
            { id: 'quantity', width: '80px' },
            { id: 'weightG', width: '80px' },
            ...attributeDefs.map(def => ({ id: def.key, width: '100px' })),
            { id: 'targetCost', width: '100px' },
            { id: 'cost', width: '100px' }
        ];

        return cols
            .filter(c => c.id === 'partNumber' || isColumnVisible(c.id))
            .map(c => {
                if (c.id === 'quantity') return '80px';
                return c.width;
            })
            .join(" ");
    }, [attributeDefs, isColumnVisible]);

    // Render Helpers
    const getTypeIcon = (type: ComponentType) => {
        switch (type) {
            case ComponentType.Assembly: return <Package className="w-3.5 h-3.5 text-blue-500" />;
            case ComponentType.Part: return <Component className="w-3.5 h-3.5 text-slate-500" />;
            case ComponentType.Material: return <Database className="w-3.5 h-3.5 text-amber-500" />;
            case ComponentType.Software: return <FileText className="w-3.5 h-3.5 text-purple-500" />;
            default: return <Component className="w-3.5 h-3.5" />;
        }
    };

    const getLifecycleColor = (state: LifecycleState) => {
        switch (state) {
            case LifecycleState.Released: return 'bg-green-100 text-green-700 border-green-200';
            case LifecycleState.Draft: return 'bg-slate-100 text-slate-600 border-slate-200';
            case LifecycleState.Obsolete: return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="flex-1 bg-white overflow-hidden flex flex-col h-full border rounded-lg border-slate-200 shadow-sm text-sm">
            {whereUsedPart && <WhereUsedModal partNumber={whereUsedPart} onClose={() => setWhereUsedPart(null)} />}

            {/* Toolbar */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-700">Virtual Tree View ({rows.length} items)</h3>
                    {isMBOMView && <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-200">MBOM</span>}
                </div>
                <div className="flex gap-2 text-xs">
                    <button onClick={() => setExpandedIds(new Set(['root']))} className="px-2 py-1 text-slate-600 hover:bg-slate-200 rounded">Collapse All</button>

                    <div className="relative group">
                        <button className="px-2 py-1 bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-50 flex items-center gap-1">
                            <span>Columns</span>
                        </button>
                        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 shadow-lg rounded-md p-2 w-48 z-50 hidden group-hover:block">
                            <div className="flex flex-col gap-1 max-h-60 overflow-auto">
                                {['imageUrl', 'name', 'refDes', 'state', 'quantity', 'weightG', ...attributeDefs.map(a => a.key), 'targetCost', 'cost'].map(key => (
                                    <label key={key} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-xs">
                                        <input
                                            type="checkbox"
                                            checked={isColumnVisible(key)}
                                            onChange={() => toggleColumn(key)}
                                            className="rounded border-slate-300"
                                        />
                                        <span className="truncate">{key}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Header */}
            <div className="bg-slate-100 border-b border-slate-200 font-semibold text-slate-500 overflow-hidden flex-shrink-0 pr-[calc(var(--scrollbar-width,0px))]" style={{ display: 'grid', gridTemplateColumns, paddingRight: '10px' }}>
                <div className="px-3 py-2 border-r border-slate-200">Part Number</div>
                {isColumnVisible('imageUrl') && <div className="px-3 py-2 border-r border-slate-200 text-center">Img</div>}
                {isColumnVisible('name') && <div className="px-3 py-2 border-r border-slate-200">Description</div>}
                {isColumnVisible('refDes') && <div className="px-3 py-2 border-r border-slate-200">RefDes</div>}
                {isColumnVisible('state') && <div className="px-3 py-2 border-r border-slate-200">State</div>}
                {isColumnVisible('quantity') && <div className="px-3 py-2 border-r border-slate-200 text-right">Qty</div>}
                {isColumnVisible('weightG') && <div className="px-3 py-2 border-r border-slate-200 text-right">Wgt(g)</div>}
                {attributeDefs.map(def => (
                    isColumnVisible(def.key) && <div key={def.id} className="px-3 py-2 border-r border-slate-200 truncate">{def.name}</div>
                ))}
                {isColumnVisible('targetCost') && <div className="px-3 py-2 border-r border-slate-200 text-right">Target</div>}
                {isColumnVisible('cost') && <div className="px-3 py-2 text-right">Actual</div>}
            </div>

            {/* Scrollable Body */}
            <div ref={parentRef} className="flex-1 overflow-auto">
                <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const row = rows[virtualRow.index];
                        const hasTarget = row.targetCost !== undefined;
                        const variance = hasTarget ? row.cost - (row.targetCost || 0) : 0;
                        const isOver = variance > 0;
                        const conflicts = duplicateMap.get(row.id);

                        return (
                            <div
                                key={row.id}
                                onClick={() => onSelect(row)}
                                className={`absolute top-0 left-0 w-full border-b border-slate-100 flex items-center hover:bg-slate-50 cursor-pointer transition-colors ${selectedId === row.id ? 'bg-blue-50' : ''}`}
                                style={{
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                    display: 'grid',
                                    gridTemplateColumns
                                }}
                            >
                                {/* Part Number Tree - Always Visible */}
                                <div className="px-2 border-r border-slate-100 h-full flex items-center group/cell" style={{ paddingLeft: `${row.depth * 20 + 8}px` }}>
                                    {row.hasChildren ? (
                                        <button onClick={(e) => toggleExpand(row.id, e)} className="p-0.5 hover:bg-slate-200 rounded mr-1">
                                            {expandedIds.has(row.id) ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                        </button>
                                    ) : <span className="w-5 mr-1" />}
                                    <span className="opacity-70 mr-2" title={row.type}>{getTypeIcon(row.type)}</span>
                                    <span className="font-medium truncate text-slate-700 mr-2">{row.partNumber}</span>

                                    <button
                                        onClick={(e) => { e.stopPropagation(); setWhereUsedPart(row.partNumber); }}
                                        className="opacity-0 group-hover/cell:opacity-100 p-1 hover:bg-slate-200 rounded text-slate-400 transition-opacity"
                                        title="Where Used"
                                    >
                                        <Database className="w-3 h-3" />
                                    </button>
                                </div>

                                {/* Image */}
                                {isColumnVisible('imageUrl') && (
                                    <div className="px-2 border-r border-slate-100 h-full flex items-center justify-center">
                                        {row.imageUrl ? <img src={row.imageUrl} className="w-6 h-6 rounded object-cover" /> : <Image className="w-4 h-4 text-slate-300" />}
                                    </div>
                                )}

                                {/* Description */}
                                {isColumnVisible('name') && (
                                    <div className="px-3 border-r border-slate-100 h-full flex items-center truncate text-slate-600" title={row.name}>{row.name}</div>
                                )}

                                {/* RefDes */}
                                {isColumnVisible('refDes') && (
                                    <div className="px-3 border-r border-slate-100 h-full flex items-center truncate font-mono text-xs text-slate-500">
                                        {row.refDes} {conflicts && <AlertTriangle className="w-3 h-3 text-red-500 ml-1" />}
                                    </div>
                                )}

                                {/* State */}
                                {isColumnVisible('state') && (
                                    <div className="px-3 border-r border-slate-100 h-full flex items-center">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getLifecycleColor(row.state)}`}>{row.state}</span>
                                    </div>
                                )}

                                {/* Qty */}
                                {isColumnVisible('quantity') && (
                                    <div className="px-3 border-r border-slate-100 h-full flex items-center justify-end font-mono text-slate-700">{row.quantity}</div>
                                )}

                                {/* Weight */}
                                {isColumnVisible('weightG') && (
                                    <div className="px-3 border-r border-slate-100 h-full flex items-center justify-end font-mono text-slate-600 text-xs">
                                        {row.weightG ? (row.weightG * row.quantity).toFixed(0) : '-'}
                                    </div>
                                )}

                                {/* Dynamic Attrs */}
                                {attributeDefs.map(def => (
                                    isColumnVisible(def.key) && (
                                        <div key={def.id} className="px-3 border-r border-slate-100 h-full flex items-center truncate text-slate-600 text-xs">
                                            {row.customAttributes?.[def.key] || '-'}
                                        </div>
                                    )
                                ))}

                                {/* Target Cost */}
                                {isColumnVisible('targetCost') && (
                                    <div className="px-3 border-r border-slate-100 h-full flex items-center justify-end font-mono text-slate-500 text-xs">
                                        {canViewCost ? (row.targetCost ? `$${row.targetCost.toFixed(2)}` : '-') : <Lock className="w-3 h-3 opacity-20" />}
                                    </div>
                                )}

                                {/* Actual Cost */}
                                {isColumnVisible('cost') && (
                                    <div className="px-3 h-full flex items-center justify-end font-mono text-slate-700 text-sm">
                                        {canViewCost ? (
                                            <div className="flex flex-col items-end leading-none">
                                                <span>${row.cost.toFixed(2)}</span>
                                                {hasTarget && Math.abs(variance) > 0.01 && (
                                                    <span className={`text-[9px] ${isOver ? 'text-red-500' : 'text-green-600'}`}>
                                                        {isOver ? '+' : ''}{variance.toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                        ) : <Lock className="w-3 h-3 opacity-20" />}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};