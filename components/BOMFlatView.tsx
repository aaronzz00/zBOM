import React, { useMemo } from 'react';
import { BOMNode } from '../types';
import { flattenBOMForProcurement } from '../utils/bomFlatener';
import { DollarSign, ShoppingCart, Layers, CircuitBoard } from 'lucide-react';

interface BOMFlatViewProps {
  data: BOMNode;
}

export const BOMFlatView: React.FC<BOMFlatViewProps> = ({ data }) => {
  const flatItems = useMemo(() => flattenBOMForProcurement(data), [data]);

  const totalParts = flatItems.reduce((acc, item) => acc + item.totalQuantity, 0);
  const totalUnique = flatItems.length;
  const totalCost = flatItems.reduce((acc, item) => acc + item.totalCost, 0);

  return (
    <div className="flex-1 bg-white overflow-hidden flex flex-col h-full border rounded-lg border-slate-200 shadow-sm animate-in fade-in duration-300">
      {/* Procurement Stats Header */}
      <div className="bg-slate-50 border-b border-slate-200 p-4 flex gap-6 overflow-x-auto flex-shrink-0">
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded border border-slate-200 shadow-sm">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-full">
                  <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                  <p className="text-xs text-slate-500 uppercase font-bold">Total Spend</p>
                  <p className="text-lg font-mono font-bold text-slate-800">${totalCost.toFixed(2)}</p>
              </div>
          </div>
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded border border-slate-200 shadow-sm">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-full">
                  <Layers className="w-4 h-4" />
              </div>
              <div>
                  <p className="text-xs text-slate-500 uppercase font-bold">Unique Parts</p>
                  <p className="text-lg font-mono font-bold text-slate-800">{totalUnique}</p>
              </div>
          </div>
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded border border-slate-200 shadow-sm">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-full">
                  <CircuitBoard className="w-4 h-4" />
              </div>
              <div>
                  <p className="text-xs text-slate-500 uppercase font-bold">Total Component Count</p>
                  <p className="text-lg font-mono font-bold text-slate-800">{totalParts}</p>
              </div>
          </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 font-semibold shadow-sm">
            <tr>
              <th className="px-4 py-3 border-b border-slate-200 w-48">Part Number</th>
              <th className="px-4 py-3 border-b border-slate-200">Description</th>
              <th className="px-4 py-3 border-b border-slate-200 w-40">Manufacturer</th>
              <th className="px-4 py-3 border-b border-slate-200 w-40">MPN</th>
              <th className="px-4 py-3 border-b border-slate-200 text-right w-32">Total Qty</th>
              <th className="px-4 py-3 border-b border-slate-200 text-right w-32">Unit Cost</th>
              <th className="px-4 py-3 border-b border-slate-200 text-right w-32 bg-slate-100/50">Total Cost</th>
              <th className="px-4 py-3 border-b border-slate-200 w-24 text-center">Refs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {flatItems.map((item) => (
              <tr key={item.partNumber} className="hover:bg-slate-50 group">
                <td className="px-4 py-3 font-mono font-medium text-blue-600">{item.partNumber}</td>
                <td className="px-4 py-3 text-slate-700">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-slate-500 truncate max-w-[300px]">{item.description}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{item.manufacturer}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.mpn}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-800">{item.totalQuantity}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-600">${item.unitCost.toFixed(3)}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 bg-slate-50/50">${item.totalCost.toFixed(2)}</td>
                <td className="px-4 py-3 text-center">
                    <div className="relative group/tooltip">
                        <span className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-bold cursor-help">
                            {item.occurrences}
                        </span>
                        {/* Simple CSS Tooltip for RefDes */}
                        <div className="absolute right-full top-0 mr-2 w-64 p-2 bg-slate-800 text-white text-xs rounded opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 shadow-lg pointer-events-none">
                            <div className="font-bold mb-1 border-b border-slate-600 pb-1">Usage Locations:</div>
                            <ul className="list-disc pl-3 space-y-0.5 text-[10px] text-slate-300 max-h-32 overflow-y-auto">
                                {item.locations.map((loc, i) => <li key={i} className="truncate">{loc}</li>)}
                            </ul>
                            {item.refDes.length > 0 && (
                                <div className="mt-2 pt-1 border-t border-slate-600">
                                    <span className="font-bold text-[10px]">RefDes: </span>
                                    <span className="font-mono text-[9px] text-slate-300 break-words">
                                        {item.refDes.join(', ')}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};