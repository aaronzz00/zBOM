import React, { useMemo } from 'react';
import { BOMNode } from '../types';
import { flattenBOMForProcurement } from '../utils/bomFlatener';
import { DollarSign, ShoppingCart, Layers, CircuitBoard, PackageCheck } from 'lucide-react';

interface BOMFlatViewProps {
  data: BOMNode;
}

// Logic to calculate tiered price
const getUnitPrice = (qty: number, node?: BOMNode) => {
    if (!node || !node.pricingTiers || node.pricingTiers.length === 0) return node ? node.cost : 0;
    
    // Sort tiers descending by qty
    const sortedTiers = [...node.pricingTiers].sort((a, b) => b.minQty - a.minQty);
    const matchedTier = sortedTiers.find(t => qty >= t.minQty);
    
    return matchedTier ? matchedTier.price : node.cost;
};

export const BOMFlatView: React.FC<BOMFlatViewProps> = ({ data }) => {
  // We need access to the raw node data for MOQ/SPQ logic, 
  // currently flattenBOMForProcurement aggregates data.
  // We will enhance the flattening logic or do a post-process lookup if we had a map.
  // For this demo, let's assume we map back to the BOMNode to find MOQ/SPQ using partNumber.
  
  // Flatten tree
  const flatItems = useMemo(() => flattenBOMForProcurement(data), [data]);
  
  // Create a map for quick lookup of MOQ/SPQ/Tiers from the original data tree
  // In a real app, the flattener should include these fields.
  const lookupMap = useMemo(() => {
      const map = new Map<string, BOMNode>();
      const traverse = (n: BOMNode) => {
          map.set(n.partNumber, n);
          if (n.children) n.children.forEach(traverse);
      }
      traverse(data);
      return map;
  }, [data]);

  const procurementData = flatItems.map(item => {
      const originalNode = lookupMap.get(item.partNumber);
      const moq = originalNode?.moq || 1;
      const spq = originalNode?.spq || 1;
      
      const requiredQty = item.totalQuantity;
      
      // Calculate Buy Qty
      // 1. Must satisfy MOQ
      let buyQty = Math.max(requiredQty, moq);
      
      // 2. Must be multiple of SPQ (if SPQ > 1)
      if (spq > 1) {
          buyQty = Math.ceil(buyQty / spq) * spq;
      }
      
      const unitPrice = getUnitPrice(buyQty, originalNode);
      const procurementCost = buyQty * unitPrice;
      const excessQty = buyQty - requiredQty;
      const excessCost = excessQty * unitPrice;

      return {
          ...item,
          moq,
          spq,
          buyQty,
          unitPrice, // Tier adjusted price
          procurementCost,
          excessCost
      };
  });

  const totalBOMCost = flatItems.reduce((acc, item) => acc + item.totalCost, 0);
  const totalProcurementSpend = procurementData.reduce((acc, item) => acc + item.procurementCost, 0);
  const totalExcess = procurementData.reduce((acc, item) => acc + item.excessCost, 0);

  return (
    <div className="flex-1 bg-white overflow-hidden flex flex-col h-full border rounded-lg border-slate-200 shadow-sm animate-in fade-in duration-300">
      {/* Procurement Stats Header */}
      <div className="bg-slate-50 border-b border-slate-200 p-4 flex gap-6 overflow-x-auto flex-shrink-0">
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded border border-slate-200 shadow-sm">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-full">
                  <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                  <p className="text-xs text-slate-500 uppercase font-bold">Standard Cost</p>
                  <p className="text-lg font-mono font-bold text-slate-800">${totalBOMCost.toFixed(2)}</p>
              </div>
          </div>
          
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded border border-slate-200 shadow-sm">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-full">
                  <DollarSign className="w-4 h-4" />
              </div>
              <div>
                  <p className="text-xs text-slate-500 uppercase font-bold">Procurement Spend (w/ MOQ)</p>
                  <p className="text-lg font-mono font-bold text-emerald-700">${totalProcurementSpend.toFixed(2)}</p>
              </div>
          </div>

          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded border border-slate-200 shadow-sm">
              <div className="p-2 bg-rose-100 text-rose-600 rounded-full">
                  <PackageCheck className="w-4 h-4" />
              </div>
              <div>
                  <p className="text-xs text-slate-500 uppercase font-bold">Excess Inventory</p>
                  <p className="text-lg font-mono font-bold text-rose-600">${totalExcess.toFixed(2)}</p>
              </div>
          </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 font-semibold shadow-sm">
            <tr>
              <th className="px-4 py-3 border-b border-slate-200 w-48">Part Number</th>
              <th className="px-4 py-3 border-b border-slate-200 w-20 text-center">MOQ/SPQ</th>
              <th className="px-4 py-3 border-b border-slate-200 text-right w-24">Required</th>
              <th className="px-4 py-3 border-b border-slate-200 text-right w-24 font-bold text-slate-700 bg-slate-50">Buy Qty</th>
              <th className="px-4 py-3 border-b border-slate-200 text-right w-24">Unit Price</th>
              <th className="px-4 py-3 border-b border-slate-200 text-right w-32 bg-slate-100/50">Spend</th>
              <th className="px-4 py-3 border-b border-slate-200 text-right w-24 text-rose-600">Excess $</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {procurementData.map((item) => (
              <tr key={item.partNumber} className="hover:bg-slate-50 group">
                <td className="px-4 py-3">
                    <div className="font-mono font-medium text-blue-600">{item.partNumber}</div>
                    <div className="text-xs text-slate-500 truncate w-40">{item.name}</div>
                </td>
                <td className="px-4 py-3 text-center text-xs font-mono text-slate-500">
                    {item.moq}/{item.spq}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-600">{item.totalQuantity}</td>
                <td className="px-4 py-3 text-right font-bold font-mono text-slate-800 bg-slate-50/30">{item.buyQty}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-600">${item.unitPrice.toFixed(3)}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 bg-slate-50/50">${item.procurementCost.toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-mono text-rose-500 font-medium">
                    {item.excessCost > 0 ? `$${item.excessCost.toFixed(2)}` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};