import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, FileStack, Layers, PackageSearch } from 'lucide-react';
import type { MBOMDeltaType } from '../domain/mbomTypes';
import { useMBOMDeltaStore } from '../stores/useMBOMDeltaStore';
import { useProductConfigStore } from '../stores/useProductConfigStore';

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

export const MBOMDeltaConsole: React.FC = () => {
  const { projects, structures, variationAxes, skus, activeProjectId } = useProductConfigStore();
  const { getDeltaPacksBySKU, groupDeltaItemsByType } = useMBOMDeltaStore();
  const projectSKUs = useMemo(
    () => skus.filter((sku) => sku.projectId === activeProjectId),
    [activeProjectId, skus],
  );
  const defaultSKUId = projectSKUs.find((sku) => getDeltaPacksBySKU(sku.id).length > 0)?.id
    ?? projectSKUs[0]?.id
    ?? '';
  const [selectedSKUId, setSelectedSKUId] = useState(defaultSKUId);

  useEffect(() => {
    if (!projectSKUs.some((sku) => sku.id === selectedSKUId)) {
      setSelectedSKUId(projectSKUs[0]?.id ?? '');
    }
  }, [projectSKUs, selectedSKUId]);

  const selectedSKU = projectSKUs.find((sku) => sku.id === selectedSKUId);
  const selectedProject = projects.find((project) => project.id === selectedSKU?.projectId);
  const selectedStructure = structures.find((structure) => structure.id === selectedSKU?.structureId);
  const optionLookup = useMemo(
    () => new Map(variationAxes.flatMap((axis) => axis.options.map((option) => [option.id, option]))),
    [variationAxes],
  );
  const deltaPacks = selectedSKU ? getDeltaPacksBySKU(selectedSKU.id) : [];
  const groupedDeltaItems = selectedSKU ? groupDeltaItemsByType(selectedSKU.id) : {};

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
                  Review manufacturing delta packs and grouped delta items before full MBOM preview is implemented.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <label htmlFor="mbom-sku-select" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-300">
                  SKU
                </label>
                <select
                  id="mbom-sku-select"
                  value={selectedSKUId}
                  onChange={(event) => setSelectedSKUId(event.target.value)}
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
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1">
            <div className="mb-4 flex items-center gap-2">
              <FileStack className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-900">Delta Packs</h2>
            </div>
            <div className="space-y-3">
              {deltaPacks.length > 0 ? deltaPacks.map((pack) => (
                <div key={pack.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="font-semibold text-slate-900">{pack.name}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{pack.status}</span>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">
                      {pack.deltaItemIds.length} deltas
                    </span>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No delta packs are assigned to this SKU.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">Delta Items by Type</h2>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {(Object.entries(groupedDeltaItems) as Array<[MBOMDeltaType, NonNullable<typeof groupedDeltaItems[MBOMDeltaType]>]>).map(([type, items]) => (
                <div key={type} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-700">
                    {deltaTypeLabels[type]}
                  </div>
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item.id} className="rounded-lg bg-slate-50 p-3">
                        <div className="flex flex-wrap gap-2 text-xs font-semibold">
                          {item.targetPartNumber && <span className="text-slate-500">Target: {item.targetPartNumber}</span>}
                          {item.newPartNumber && <span className="text-slate-900">New: {item.newPartNumber}</span>}
                          {item.quantity !== undefined && <span className="text-slate-900">Qty: {item.quantity}</span>}
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-slate-500" />
            <h2 className="text-lg font-bold text-slate-900">Full MBOM Preview</h2>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Placeholder only: full resolved MBOM preview will compose the base manufacturing structure and selected delta packs in a later phase.
          </p>
        </section>
      </div>
    </div>
  );
};
