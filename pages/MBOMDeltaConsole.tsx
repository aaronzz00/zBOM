import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, FileStack, Layers, PackageSearch, Plus, Trash2, X, PlusCircle, AlertCircle, Info } from 'lucide-react';
import type { ComposedMBOMSource, MBOMDeltaType, MBOMDeltaPack, MBOMDeltaItem } from '../domain/mbomTypes';
import { useEBOMArchitectureStore } from '../stores/useEBOMArchitectureStore';
import { useMBOMDeltaStore } from '../stores/useMBOMDeltaStore';
import { useProductConfigStore } from '../stores/useProductConfigStore';
import { resolveEBOMBase } from '../utils/ebomInheritance';

const deltaTypeLabels: Record<MBOMDeltaType, string> = {
  add: 'add',
  remove: 'remove',
  replace: 'replace',
  'quantity-change': 'quantity change',
  'manufacturing-only-material': 'manufacturing only material',
  'packaging-label-regional': 'packaging label regional',
};

const statusStyles = {
  candidate: 'bg-amber-50 text-amber-700 border-amber-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  frozen: 'bg-sky-50 text-sky-700 border-sky-200',
  suppressed: 'bg-slate-100 text-slate-600 border-slate-200',
};

const previewSourceLabels: Record<ComposedMBOMSource, string> = {
  base: 'base',
  'delta-add': 'delta add',
  'delta-remove': 'delta remove',
  'delta-replace': 'delta replace',
  'quantity-change': 'quantity change',
  'manufacturing-only': 'manufacturing only',
  'packaging-label-regional': 'packaging/label/regional',
};

export const MBOMDeltaConsole: React.FC = () => {
  const {
    activeProjectId,
    getSelectedWorkflowSKUContext,
    selectWorkflowSKU,
    variationAxes,
    skus,
  } = useProductConfigStore();
  const { 
    getDeltaPacksBySKU, 
    getDeltaItemsBySKU,
    getComposedMBOMPreview,
    addDeltaPack,
    updateDeltaPack,
    deleteDeltaPack,
    addDeltaItem,
    deleteDeltaItem
  } = useMBOMDeltaStore();
  const {
    bases: ebomBases,
    items: ebomItems,
    status: ebomStatus,
    error: ebomError,
    load: loadEBOM,
  } = useEBOMArchitectureStore();
  
  const projectSKUs = useMemo(
    () => skus.filter((sku) => sku.projectId === activeProjectId),
    [activeProjectId, skus],
  );
  const selectedContext = getSelectedWorkflowSKUContext();

  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  
  // Modals/Forms State
  const [isPackModalOpen, setIsPackModalOpen] = useState(false);
  const [newPackName, setNewPackName] = useState('');
  
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [newItemType, setNewItemType] = useState<MBOMDeltaType>('add');
  const [newItemTargetPN, setNewItemTargetPN] = useState('');
  const [newItemNewPN, setNewItemNewPN] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [newItemReason, setNewItemReason] = useState('');

  useEffect(() => {
    if (ebomStatus === 'idle') {
      void loadEBOM();
    }
  }, [ebomStatus, loadEBOM]);

  const selectedSKU = selectedContext?.sku;
  const selectedProject = selectedContext?.project;
  const selectedStructure = selectedContext?.structure;
  
  const optionLookup = useMemo(
    () => new Map(variationAxes.flatMap((axis) => axis.options.map((option) => [option.id, option]))),
    [variationAxes],
  );

  const deltaPacks = selectedSKU ? getDeltaPacksBySKU(selectedSKU.id) : [];

  // Default select first pack if none selected
  useEffect(() => {
    if (deltaPacks.length > 0 && !selectedPackId) {
      setSelectedPackId(deltaPacks[0].id);
    }
  }, [deltaPacks, selectedPackId]);

  const activePack = useMemo(() => {
    return deltaPacks.find(p => p.id === selectedPackId) || deltaPacks[0] || null;
  }, [deltaPacks, selectedPackId]);

  // Group delta items for the active selected pack
  const activePackItems = useMemo(() => {
    if (!activePack) return [];
    const allItems = useMBOMDeltaStore.getState().deltaItems;
    return allItems.filter(item => item.packId === activePack.id);
  }, [activePack, useMBOMDeltaStore.getState().deltaItems]);

  const groupedDeltaItems = useMemo(() => {
    return activePackItems.reduce<Partial<Record<MBOMDeltaType, MBOMDeltaItem[]>>>(
      (groups, item) => ({
        ...groups,
        [item.type]: [...(groups[item.type] ?? []), item],
      }),
      {}
    );
  }, [activePackItems]);

  const previewResult = useMemo(() => {
    if (!selectedSKU || !selectedStructure || ebomStatus === 'idle' || ebomStatus === 'loading') {
      return { rows: [], error: undefined };
    }

    const structureBase = ebomBases.find((base) => (
      base.scope === 'structure' && base.structureId === selectedStructure.id
    ));

    if (!structureBase) {
      return {
        rows: [],
        error: `Unable to resolve EBOM base for ${selectedStructure.name}.`,
      };
    }

    try {
      const baseItems = resolveEBOMBase(structureBase.id, ebomBases, ebomItems);

      return {
        rows: getComposedMBOMPreview({ skuId: selectedSKU.id, baseItems }),
        error: undefined,
      };
    } catch (error) {
      return {
        rows: [],
        error: error instanceof Error ? error.message : 'Unable to resolve EBOM items.',
      };
    }
  }, [
    ebomBases,
    ebomItems,
    ebomStatus,
    getComposedMBOMPreview,
    selectedSKU,
    selectedStructure,
    // Triggers recalculation when packs/items state updates
    useMBOMDeltaStore.getState().deltaItems,
    useMBOMDeltaStore.getState().deltaPacks,
  ]);

  const previewError = ebomError ?? previewResult.error;

  const handleCreatePack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPackName.trim() || !selectedSKU) return;
    addDeltaPack({
      projectId: activeProjectId || '',
      skuId: selectedSKU.id,
      baseStructureId: selectedStructure?.id || '',
      name: newPackName.trim(),
      status: 'draft',
    });
    setNewPackName('');
    setIsPackModalOpen(false);
  };

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePack) return;
    addDeltaItem({
      packId: activePack.id,
      type: newItemType,
      targetPartNumber: newItemTargetPN.trim() || undefined,
      newPartNumber: newItemNewPN.trim() || undefined,
      quantity: newItemQty ? parseFloat(newItemQty) : undefined,
      reason: newItemReason.trim(),
    });
    setNewItemTargetPN('');
    setNewItemNewPN('');
    setNewItemQty('');
    setNewItemReason('');
    setIsItemModalOpen(false);
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 p-6 text-white">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-indigo-200">
                  <PackageSearch className="h-4 w-4" />
                  MBOM Delta Console
                </div>
                <h1 className="text-3xl font-bold tracking-tight">SKU-first Manufacturing Delta Review</h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-300">
                  Review and author manufacturing delta packs alongside the composed base-plus-delta MBOM preview.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <label htmlFor="mbom-sku-select" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-300">
                  SKU
                </label>
                <select
                  id="mbom-sku-select"
                  value={selectedSKU?.id ?? ''}
                  onChange={(event) => {
                    selectWorkflowSKU(event.target.value);
                    setSelectedPackId(null); // Reset active pack
                  }}
                  className="w-full rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-sm font-semibold text-white focus:border-indigo-300 focus:outline-none"
                >
                  {projectSKUs.map((sku) => (
                    <option key={sku.id} value={sku.id}>
                      {sku.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {selectedSKU && (
          <section className="grid gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Selected SKU</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{selectedSKU.code}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedSKU.optionIds.map((optionId) => (
                  <span key={optionId} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {optionLookup.get(optionId)?.code ?? optionId}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Context</div>
              <div className="mt-2 font-semibold text-slate-900">{selectedProject?.code ?? 'UNKNOWN'}</div>
              <div className="mt-1 text-sm text-slate-500">{selectedStructure?.name ?? 'Unknown structure'}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Status</div>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusStyles[selectedSKU.status]}`}>
                {selectedSKU.status}
              </span>
            </div>
          </section>
        )}

        <div className="grid gap-6 xl:grid-cols-3">
          {/* Delta Packs Section */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1 flex flex-col h-[500px]">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileStack className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-slate-900">Delta Packs</h2>
              </div>
              {selectedSKU && (
                <button
                  onClick={() => setIsPackModalOpen(true)}
                  className="p-1 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                  title="Add Delta Pack"
                >
                  <Plus className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {deltaPacks.length > 0 ? deltaPacks.map((pack) => (
                <div 
                  key={pack.id} 
                  onClick={() => setSelectedPackId(pack.id)}
                  className={`rounded-xl border p-4 cursor-pointer relative group transition-all ${
                    (activePack?.id === pack.id) 
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' 
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-semibold text-slate-900 pr-6">{pack.name}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className={`rounded-full px-2.5 py-0.5 border uppercase text-[9px] ${
                      pack.status === 'released' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {pack.status}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">
                      {pack.deltaItemIds.length} deltas
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete delta pack "${pack.name}"? This deletes all items inside.`)) {
                        deleteDeltaPack(pack.id);
                        if (selectedPackId === pack.id) setSelectedPackId(null);
                      }
                    }}
                    className="absolute right-3 top-3 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete Pack"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 text-center">
                  No delta packs are assigned to this SKU.
                </div>
              )}
            </div>
          </section>

          {/* Delta Items Section */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2 flex flex-col h-[500px]">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900">
                  {activePack ? `Delta Items in "${activePack.name}"` : 'Delta Items'}
                </h2>
              </div>
              {activePack && (
                <button
                  onClick={() => setIsItemModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Delta
                </button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto pr-1">
              {!activePack ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400 italic">
                  Select a delta pack to view and author items.
                </div>
              ) : activePackItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <PlusCircle className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">No delta items added to this pack yet.</p>
                  <button 
                    onClick={() => setIsItemModalOpen(true)}
                    className="mt-3 px-3 py-1.5 border border-blue-600 text-blue-600 rounded text-xs font-bold hover:bg-blue-50 transition-colors"
                  >
                    Add First Delta Item
                  </button>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {(Object.entries(groupedDeltaItems) as Array<[MBOMDeltaType, NonNullable<typeof groupedDeltaItems[MBOMDeltaType]>]>).map(([type, items]) => (
                    <div key={type} className="rounded-xl border border-slate-200 p-4 bg-slate-50/20">
                      <div className="mb-3 rounded-full bg-slate-100 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-slate-700 inline-block border border-slate-200">
                        {deltaTypeLabels[type]}
                      </div>
                      <div className="space-y-3">
                        {items.map((item) => (
                          <div key={item.id} className="rounded-lg bg-white border border-slate-200 p-3 shadow-xs relative group/item">
                            <div className="flex flex-wrap gap-2 text-xs font-semibold">
                              {item.targetPartNumber && <span className="text-slate-500">Target: <strong className="text-slate-700 font-mono bg-slate-50 px-1 rounded">{item.targetPartNumber}</strong></span>}
                              {item.newPartNumber && <span className="text-slate-900">New: <strong className="text-indigo-700 font-mono bg-indigo-50 px-1 rounded">{item.newPartNumber}</strong></span>}
                              {item.quantity !== undefined && <span className="text-slate-900 font-mono">Qty: {item.quantity}</span>}
                            </div>
                            <p className="mt-2 text-xs text-slate-600 leading-relaxed">{item.reason}</p>
                            <button
                              onClick={() => {
                                if (window.confirm("Remove this delta item?")) {
                                  deleteDeltaItem(item.id);
                                }
                              }}
                              className="absolute right-2 top-2 p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-600 opacity-0 group-hover/item:opacity-100 transition-opacity"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Composed Preview */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Boxes className="h-5 w-5 text-slate-500" />
            <h2 className="text-lg font-bold text-slate-900">Composed MBOM Preview</h2>
          </div>
          {previewError && (
            <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 text-amber-600" />
              <span>{previewError}</span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-3 py-3">Part Number</th>
                  <th scope="col" className="px-3 py-3">Name</th>
                  <th scope="col" className="px-3 py-3">Qty</th>
                  <th scope="col" className="px-3 py-3">Source</th>
                  <th scope="col" className="px-3 py-3">Target Part</th>
                  <th scope="col" className="px-3 py-3">Reason/warning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewResult.rows.length > 0 ? previewResult.rows.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-3 font-semibold text-slate-900 font-mono">{row.partNumber}</td>
                    <td className="px-3 py-3 text-slate-700">{row.name}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700 font-mono">
                      {row.quantity} {row.unit}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                        row.source === 'base' 
                          ? 'bg-slate-100 text-slate-700 border-slate-200'
                          : row.source === 'delta-add' || row.source === 'manufacturing-only'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : row.source === 'delta-remove'
                          ? 'bg-rose-50 text-rose-700 border-rose-200 line-through'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {previewSourceLabels[row.source]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600 font-mono">{row.targetPartNumber ?? '-'}</td>
                    <td className="max-w-md px-3 py-3 text-slate-600 leading-relaxed text-xs">{row.warning ?? row.reason ?? '-'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-sm text-slate-500 text-center italic">
                      {ebomStatus === 'idle' || ebomStatus === 'loading'
                        ? 'Loading EBOM base items...'
                        : 'No composed MBOM rows are available for this SKU.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Add Pack Modal */}
      {isPackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <form onSubmit={handleCreatePack} className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Create Delta Pack</h3>
              <button type="button" onClick={() => setIsPackModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label htmlFor="pack-name" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pack Name</label>
                <input
                  id="pack-name"
                  type="text"
                  required
                  value={newPackName}
                  onChange={(e) => setNewPackName(e.target.value)}
                  placeholder="e.g. US Retail packaging swap"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPackModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded text-sm hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 font-bold shadow-sm"
                >
                  Create Pack
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Add Delta Item Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <form onSubmit={handleCreateItem} className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Add Delta Item</h3>
              <button type="button" onClick={() => setIsItemModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="item-type" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Delta Type</label>
                  <select
                    id="item-type"
                    value={newItemType}
                    onChange={(e) => setNewItemType(e.target.value as MBOMDeltaType)}
                    className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-sm focus:border-blue-500 outline-none"
                  >
                    {Object.entries(deltaTypeLabels).map(([key, val]) => (
                      <option key={key} value={key}>{val}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="item-qty" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Quantity Offset</label>
                  <input
                    id="item-qty"
                    type="number"
                    step="any"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value)}
                    placeholder="e.g. 1, -2"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="item-target-pn" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target PN (Old)</label>
                  <input
                    id="item-target-pn"
                    type="text"
                    value={newItemTargetPN}
                    onChange={(e) => setNewItemTargetPN(e.target.value)}
                    placeholder="e.g. 500-10023-A"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="item-new-pn" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">New PN</label>
                  <input
                    id="item-new-pn"
                    type="text"
                    value={newItemNewPN}
                    onChange={(e) => setNewItemNewPN(e.target.value)}
                    placeholder="e.g. 500-10024-A"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="item-reason" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Reason for change</label>
                <textarea
                  id="item-reason"
                  required
                  rows={3}
                  value={newItemReason}
                  onChange={(e) => setNewItemReason(e.target.value)}
                  placeholder="Describe why this delta is needed for this SKU config..."
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:border-blue-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded text-sm hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 font-bold shadow-sm"
                >
                  Add Item
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
