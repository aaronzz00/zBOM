import React, { useMemo, useState } from 'react';
import { CalendarDays, Gauge, Hammer, Link2, Package2, Plus, Save } from 'lucide-react';
import type { ToolingMilestoneKey, ToolingMilestone } from '../domain/toolingTypes';
import { useToolingStore } from '../stores/useToolingStore';
import { useAppStore } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Permission, type BOMNode } from '../types';

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
  const { designMasterParts, getToolingByDesignMasterPart, getLeadTimeDays, createDesignMasterPart, createTooling, updateTooling, updateMilestone } = useToolingStore();
  const { libraryParts, bomData } = useAppStore();
  const { hasPermission } = useAuth();
  const [selectedPartId, setSelectedPartId] = useState(designMasterParts[0]?.id ?? '');
  const [isDesignMasterFormOpen, setIsDesignMasterFormOpen] = useState(false);
  const [isToolingFormOpen, setIsToolingFormOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [designMasterForm, setDesignMasterForm] = useState({
    code: '',
    name: '',
    concretePartNumber: libraryParts[0]?.partNumber ?? '',
  });
  const [toolingForm, setToolingForm] = useState({
    name: '',
    supplier: '',
    cavityCount: '1',
    owner: '',
  });
  const selectedPart = designMasterParts.find((part) => part.id === selectedPartId);
  const toolingRecords = selectedPart ? getToolingByDesignMasterPart(selectedPart.id) : [];
  const canManageTooling = hasPermission(Permission.MANAGE_TOOLING);

  const openPartLibraryForPart = (partNumber: string) => {
    window.sessionStorage.setItem('zbom.partLibrary.search', partNumber);
    window.dispatchEvent(new CustomEvent('zbom:navigate', { detail: { page: 'parts' } }));
  };

  const concreteUsage = useMemo(() => {
    const results = new Map<string, Array<{ parent: string; qty: number; path: string[] }>>();
    if (!selectedPart) return results;
    const concreteNumbers = new Set(selectedPart.concretePartNumbers);
    const search = (node: BOMNode, path: string[]) => {
      if (concreteNumbers.has(node.partNumber)) {
        const usages = results.get(node.partNumber) ?? [];
        usages.push({
          parent: path[path.length - 1] ?? 'Root',
          qty: node.quantity,
          path,
        });
        results.set(node.partNumber, usages);
      }
      node.children?.forEach((child) => search(child, [...path, node.partNumber]));
    };
    search(bomData, []);
    return results;
  }, [bomData, selectedPart]);

  const handleCreateDesignMaster = () => {
    const code = designMasterForm.code.trim();
    const name = designMasterForm.name.trim();
    if (!code || !name) return;
    const created = {
      id: `dmp-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      projectId: 'project-zphone-2026',
      structureId: 'structure-production-core',
      code,
      name,
      concretePartNumbers: designMasterForm.concretePartNumber ? [designMasterForm.concretePartNumber] : [],
    };
    createDesignMasterPart(created);
    setSelectedPartId(created.id);
    setDesignMasterForm({ code: '', name: '', concretePartNumber: libraryParts[0]?.partNumber ?? '' });
    setIsDesignMasterFormOpen(false);
    setSaveStatus(`Created design master ${code}.`);
  };

  const handleCreateTooling = () => {
    if (!selectedPart || !toolingForm.name.trim()) return;
    const cavityCount = Number(toolingForm.cavityCount);
    createTooling({
      id: `tooling-${toolingForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
      projectId: selectedPart.projectId,
      designMasterPartId: selectedPart.id,
      name: toolingForm.name.trim(),
      supplier: toolingForm.supplier.trim() || undefined,
      cavityCount: Number.isFinite(cavityCount) && cavityCount > 0 ? cavityCount : undefined,
      owner: toolingForm.owner.trim() || undefined,
      milestones: [
        { key: 'drawingRelease', status: 'not-started' },
        { key: 'dfm', status: 'not-started' },
        { key: 'quotation', status: 'not-started' },
        { key: 'kickoff', status: 'not-started' },
        { key: 't1', status: 'not-started' },
      ],
    });
    setToolingForm({ name: '', supplier: '', cavityCount: '1', owner: '' });
    setIsToolingFormOpen(false);
    setSaveStatus('Created tooling record.');
  };

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
	                {saveStatus && <p className="mt-2 text-sm font-semibold text-emerald-200">{saveStatus}</p>}
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
	                {canManageTooling && (
	                  <div className="mt-3 flex gap-2">
	                    <button
	                      type="button"
	                      onClick={() => setIsDesignMasterFormOpen((value) => !value)}
	                      className="inline-flex items-center gap-1 rounded bg-emerald-500 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-400"
	                    >
	                      <Plus className="h-3.5 w-3.5" />
	                      Design Master
	                    </button>
	                    <button
	                      type="button"
	                      onClick={() => setIsToolingFormOpen((value) => !value)}
	                      className="inline-flex items-center gap-1 rounded bg-blue-500 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-blue-400"
	                    >
	                      <Plus className="h-3.5 w-3.5" />
	                      Tooling
	                    </button>
	                  </div>
	                )}
	              </div>
	            </div>
	          </div>
	        </section>

	        {isDesignMasterFormOpen && canManageTooling && (
	          <section className="rounded-lg border border-emerald-200 bg-white p-4 shadow-sm">
	            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-emerald-700">Create Design Master Part</h2>
	            <div className="grid gap-3 md:grid-cols-4">
	              <input aria-label="Design master code" value={designMasterForm.code} onChange={(event) => setDesignMasterForm((value) => ({ ...value, code: event.target.value }))} placeholder="DMP-CODE" className="rounded border border-slate-300 px-3 py-2 text-sm" />
	              <input aria-label="Design master name" value={designMasterForm.name} onChange={(event) => setDesignMasterForm((value) => ({ ...value, name: event.target.value }))} placeholder="Name" className="rounded border border-slate-300 px-3 py-2 text-sm" />
	              <select aria-label="Concrete library part" value={designMasterForm.concretePartNumber} onChange={(event) => setDesignMasterForm((value) => ({ ...value, concretePartNumber: event.target.value }))} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
	                {libraryParts.map((part) => <option key={part.id} value={part.partNumber}>{part.partNumber}</option>)}
	              </select>
	              <button type="button" onClick={handleCreateDesignMaster} className="inline-flex items-center justify-center gap-2 rounded bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700">
	                <Save className="h-4 w-4" />
	                Save
	              </button>
	            </div>
	          </section>
	        )}

	        {isToolingFormOpen && selectedPart && canManageTooling && (
	          <section className="rounded-lg border border-blue-200 bg-white p-4 shadow-sm">
	            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-blue-700">Create Tooling Record</h2>
	            <div className="grid gap-3 md:grid-cols-5">
	              <input aria-label="Tooling name" value={toolingForm.name} onChange={(event) => setToolingForm((value) => ({ ...value, name: event.target.value }))} placeholder="Tooling name" className="rounded border border-slate-300 px-3 py-2 text-sm" />
	              <input aria-label="Toolmaker" value={toolingForm.supplier} onChange={(event) => setToolingForm((value) => ({ ...value, supplier: event.target.value }))} placeholder="Toolmaker" className="rounded border border-slate-300 px-3 py-2 text-sm" />
	              <input aria-label="Cavity count" type="number" value={toolingForm.cavityCount} onChange={(event) => setToolingForm((value) => ({ ...value, cavityCount: event.target.value }))} className="rounded border border-slate-300 px-3 py-2 text-sm" />
	              <input aria-label="Tooling owner" value={toolingForm.owner} onChange={(event) => setToolingForm((value) => ({ ...value, owner: event.target.value }))} placeholder="Owner" className="rounded border border-slate-300 px-3 py-2 text-sm" />
	              <button type="button" onClick={handleCreateTooling} className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700">
	                <Save className="h-4 w-4" />
	                Save
	              </button>
	            </div>
	          </section>
	        )}

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
              <div className="grid gap-2 md:grid-cols-2">
                {selectedPart.concretePartNumbers.map((partNumber) => (
                  <div
                    key={partNumber}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
                  >
                    <div className="flex items-center gap-1 font-bold">
                      <Link2 className="h-3.5 w-3.5" />
                      {partNumber}
                    </div>
                    <div className="mt-1 text-[11px] text-emerald-700">
                      BOM usage: {(concreteUsage.get(partNumber) ?? []).length || 'none'}
                    </div>
	                    <button
	                      type="button"
	                      onClick={() => openPartLibraryForPart(partNumber)}
	                      className="mt-2 rounded border border-emerald-300 bg-white px-2 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
	                    >
	                      Open in Part Library
	                    </button>
                  </div>
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
	              Milestones are read-only here for viewers; authorized tooling owners can update status and dates.
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
	                        {tooling.owner ? ` · Owner: ${tooling.owner}` : ''}
                      </div>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      Kickoff to T1: {leadTimeDays === null ? 'TBD' : `${leadTimeDays} days`}
                    </div>
                  </div>
	                  {canManageTooling && (
	                    <div className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-3">
	                      <label className="text-xs font-semibold text-slate-600" htmlFor={`${tooling.id}-supplier`}>
	                        Toolmaker
	                        <input
	                          id={`${tooling.id}-supplier`}
	                          aria-label={`${tooling.name} toolmaker`}
	                          value={tooling.supplier ?? ''}
	                          onChange={(event) => {
	                            updateTooling(tooling.id, { supplier: event.target.value || undefined });
	                            setSaveStatus(`Updated ${tooling.name} toolmaker.`);
	                          }}
	                          className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
	                        />
	                      </label>
	                      <label className="text-xs font-semibold text-slate-600" htmlFor={`${tooling.id}-cavities`}>
	                        Cavities
	                        <input
	                          id={`${tooling.id}-cavities`}
	                          aria-label={`${tooling.name} cavity count`}
	                          type="number"
	                          value={tooling.cavityCount ?? ''}
	                          onChange={(event) => {
	                            const next = Number(event.target.value);
	                            updateTooling(tooling.id, { cavityCount: Number.isFinite(next) && next > 0 ? next : undefined });
	                            setSaveStatus(`Updated ${tooling.name} cavity count.`);
	                          }}
	                          className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
	                        />
	                      </label>
	                      <label className="text-xs font-semibold text-slate-600" htmlFor={`${tooling.id}-owner`}>
	                        Owner
	                        <input
	                          id={`${tooling.id}-owner`}
	                          aria-label={`${tooling.name} owner`}
	                          value={tooling.owner ?? ''}
	                          onChange={(event) => {
	                            updateTooling(tooling.id, { owner: event.target.value || undefined });
	                            setSaveStatus(`Updated ${tooling.name} owner.`);
	                          }}
	                          className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
	                        />
	                      </label>
	                    </div>
	                  )}
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
	                        {canManageTooling && (
	                          <div className="mt-3 space-y-2">
	                            <select
	                              aria-label={`${milestoneLabels[milestone.key]} status`}
	                              value={milestone.status}
	                              onChange={(event) => {
	                                updateMilestone(tooling.id, milestone.key, { status: event.target.value as ToolingMilestone['status'] });
	                                setSaveStatus(`Updated ${milestoneLabels[milestone.key]} status.`);
	                              }}
	                              className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
	                            >
	                              <option value="not-started">not-started</option>
	                              <option value="in-progress">in-progress</option>
	                              <option value="done">done</option>
	                              <option value="blocked">blocked</option>
	                            </select>
	                            <input
	                              aria-label={`${milestoneLabels[milestone.key]} planned date`}
	                              type="date"
	                              value={milestone.plannedDate ?? ''}
	                              onChange={(event) => {
	                                updateMilestone(tooling.id, milestone.key, { plannedDate: event.target.value || undefined });
	                                setSaveStatus(`Updated ${milestoneLabels[milestone.key]} planned date.`);
	                              }}
	                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
	                            />
	                            <input
	                              aria-label={`${milestoneLabels[milestone.key]} actual date`}
	                              type="date"
	                              value={milestone.actualDate ?? ''}
	                              onChange={(event) => {
	                                updateMilestone(tooling.id, milestone.key, { actualDate: event.target.value || undefined });
	                                setSaveStatus(`Updated ${milestoneLabels[milestone.key]} actual date.`);
	                              }}
	                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
	                            />
	                            <input
	                              aria-label={`${milestoneLabels[milestone.key]} owner`}
	                              value={milestone.owner ?? ''}
	                              onChange={(event) => {
	                                updateMilestone(tooling.id, milestone.key, { owner: event.target.value || undefined });
	                                setSaveStatus(`Updated ${milestoneLabels[milestone.key]} owner.`);
	                              }}
	                              placeholder="Owner"
	                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
	                            />
	                            <textarea
	                              aria-label={`${milestoneLabels[milestone.key]} notes`}
	                              value={milestone.notes ?? ''}
	                              onChange={(event) => {
	                                updateMilestone(tooling.id, milestone.key, { notes: event.target.value || undefined });
	                                setSaveStatus(`Updated ${milestoneLabels[milestone.key]} notes.`);
	                              }}
	                              placeholder="Notes"
	                              rows={2}
	                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
	                            />
	                            {milestone.status === 'blocked' && (
	                              <textarea
	                                aria-label={`${milestoneLabels[milestone.key]} blocker reason`}
	                                value={milestone.blockerReason ?? ''}
	                                onChange={(event) => {
	                                  updateMilestone(tooling.id, milestone.key, { blockerReason: event.target.value || undefined });
	                                  setSaveStatus(`Updated ${milestoneLabels[milestone.key]} blocker reason.`);
	                                }}
	                                placeholder="Blocker reason"
	                                rows={2}
	                                className="w-full rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800"
	                              />
	                            )}
	                          </div>
	                        )}
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
