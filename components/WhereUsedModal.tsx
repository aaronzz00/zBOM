import React, { useMemo } from 'react';
import { X, ArrowRight, Package } from 'lucide-react';
import { useAppStore } from '../context/AppContext';
import { FormulaEngine } from '../services/FormulaEngine';
import { BOMNode } from '../types';

interface WhereUsedModalProps {
    partNumber: string | null;
    onClose: () => void;
}

export const WhereUsedModal: React.FC<WhereUsedModalProps> = ({ partNumber, onClose }) => {
    const { bomData } = useAppStore();

    const parents = useMemo(() => {
        if (!partNumber || !bomData) return [];
        return FormulaEngine.findWhereUsed(partNumber, bomData);
    }, [partNumber, bomData]);

    if (!partNumber) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <span>Where Used:</span>
                        <span className="font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-sm">{partNumber}</span>
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto flex-1">
                    {parents.length === 0 ? (
                        <p className="text-slate-500 text-center py-8">This part is not used in any assemblies (it might be a top-level item or orphan).</p>
                    ) : (
                        <div className="space-y-2">
                            <div className="text-xs text-slate-500 mb-2 uppercase font-bold tracking-wider">Used in {parents.length} Parent Assemblies</div>
                            {parents.map(parent => (
                                <div key={parent.id} className="border border-slate-200 rounded p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                                    <div className="p-2 bg-blue-50 rounded text-blue-600">
                                        <Package className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-slate-800">{parent.partNumber}</div>
                                        <div className="text-xs text-slate-500">{parent.name}</div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-400" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-lg flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-50 text-sm font-medium">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
