import React, { useState } from 'react';
import { CalendarDays, Gauge, Hammer, Package2 } from 'lucide-react';
import type { ToolingMilestoneKey, ToolingMilestone } from '../domain/toolingTypes';
import { useToolingStore } from '../stores/useToolingStore';

const milestoneLabels: Record<ToolingMilestoneKey, string> = {
  drawingRelease: 'Drawing Release',
  dfm: 'DFM',
  quotation: 'Quotation',
  kickoff: 'Kickoff',
  t1: 'T1',
};

const milestoneStyles: Record<ToolingMilestone['status'], string> = {
  'not-started': 'border-slate-200 bg-slate-50 text-slate-600',
  'in-progress': 'border-blue-200 bg-blue-50 text-blue-700',
  done: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  blocked: 'border-red-200 bg-red-50 text-red-700',
};

export const ToolingHub: React.FC = () => {
  const { designMasterParts, getToolingByDesignMasterPart, getLeadTimeDays } = useToolingStore();
  const [selectedPartId, setSelectedPartId] = useState(designMasterParts[0]?.id ?? '');
  const selectedPart = designMasterParts.find((part) => part.id === selectedPartId);
  const toolingRecords = selectedPart ? getToolingByDesignMasterPart(selectedPart.id) : [];

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-950 via-emerald-950 to-stone-900 p-6 text-white">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-200">
                  <Hammer className="h-4 w-4" />
                  Tooling Hub
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Design Master Part Tooling View</h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-300">
                  Track concrete part coverage, tooling records, milestone status, and derived kickoff-to-T1 lead time.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <label htmlFor="design-master-part-select" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Design Master Part
                </label>
                <select
                  id="design-master-part-select"
                  value={selectedPartId}
                  onChange={(event) => setSelectedPartId(event.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-sm font-semibold text-white focus:border-emerald-300 focus:outline-none"
                >
                  {designMasterParts.map((part) => (
                    <option key={part.id} value={part.id}>
                      {part.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {selectedPart && (
          <section className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Package2 className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-slate-900">Design Master Part</h2>
              </div>
              <div className="font-semibold text-slate-900">{selectedPart.code}</div>
              <div className="mt-1 text-sm text-slate-500">{selectedPart.name}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <div className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                Concrete Part Numbers
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedPart.concretePartNumbers.map((partNumber) => (
                  <span
                    key={partNumber}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
                  >
                    {partNumber}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">Tooling Records</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Milestones are read-only here; lead time is derived from kickoff to T1.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {toolingRecords.map((tooling) => {
              const leadTimeDays = getLeadTimeDays(tooling.id);

              return (
                <div key={tooling.id} className="p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{tooling.name}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {tooling.supplier ?? 'Supplier TBD'} · {tooling.cavityCount ? `${tooling.cavityCount} cavities` : 'Cavity count TBD'}
                      </div>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      Kickoff to T1: {leadTimeDays === null ? 'TBD' : `${leadTimeDays} days`}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-5">
                    {tooling.milestones.map((milestone) => (
                      <div key={`${tooling.id}-${milestone.key}`} className="rounded-xl border border-slate-200 p-3">
                        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {milestoneLabels[milestone.key]}
                        </div>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${milestoneStyles[milestone.status]}`}>
                          {milestone.status}
                        </span>
                        <div className="mt-2 text-xs text-slate-500">
                          Actual: {milestone.actualDate ?? 'TBD'}
                        </div>
                        <div className="text-xs text-slate-500">
                          Planned: {milestone.plannedDate ?? 'TBD'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
