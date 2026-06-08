import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Gauge, Hammer, Link2, Package2, Plus, Save, X } from 'lucide-react';
import type { ToolingMilestoneKey, ToolingMilestone, Tooling } from '../domain/toolingTypes';
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

const statusStyles: Record<ToolingMilestone['status'], string> = {
  'not-started': 'border-slate-200 bg-slate-50 text-slate-600',
  'in-progress': 'border-blue-200 bg-blue-50 text-blue-700',
  done: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  blocked: 'border-red-200 bg-red-50 text-red-700',
};

const getOverallStatus = (tooling: Tooling) => {
  if (tooling.milestones.some((milestone) => milestone.status === 'blocked')) return 'blocked';
  if (tooling.milestones.every((milestone) => milestone.status === 'done')) return 'done';
  if (tooling.milestones.some((milestone) => milestone.status === 'in-progress')) return 'in-progress';
  return 'not-started';
};

const getNextMilestone = (tooling: Tooling) => (
  tooling.milestones.find((milestone) => milestone.status !== 'done') ?? tooling.milestones[tooling.milestones.length - 1]
);

export const ToolingHub: React.FC = () => {
  const {
    designMasterParts,
    tooling,
    getLeadTimeDays,
    createDesignMasterPart,
    createTooling,
    updateTooling,
    updateMilestone,
  } = useToolingStore();
  const { libraryParts, bomData } = useAppStore();
  const { hasPermission } = useAuth();
  const [selectedToolingId, setSelectedToolingId] = useState('');
  const [panelTab, setPanelTab] = useState<'overview' | 'links' | 'milestones'>('overview');
  const [isDesignMasterFormOpen, setIsDesignMasterFormOpen] = useState(false);
  const [isToolingFormOpen, setIsToolingFormOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [designMasterForm, setDesignMasterForm] = useState({
    code: '',
    name: '',
    concretePartNumber: libraryParts[0]?.partNumber ?? '',
  });
  const [toolingForm, setToolingForm] = useState({
    designMasterPartId: designMasterParts[0]?.id ?? '',
    name: '',
    supplier: '',
    cavityCount: '1',
    owner: '',
  });
  const canManageTooling = hasPermission(Permission.MANAGE_TOOLING);

  const designMasterById = useMemo(() => (
    new Map(designMasterParts.map((part) => [part.id, part]))
  ), [designMasterParts]);

  const selectedTooling = tooling.find((record) => record.id === selectedToolingId) ?? null;
  const selectedDesignMaster = selectedTooling ? designMasterById.get(selectedTooling.designMasterPartId) : null;

  useEffect(() => {
    const pendingToolingId = window.sessionStorage.getItem('zbom.toolingHub.toolingId');
    if (!pendingToolingId) return;

    const pendingTab = window.sessionStorage.getItem('zbom.toolingHub.tab');
    const nextTab = pendingTab === 'links' || pendingTab === 'milestones' ? pendingTab : 'overview';

    if (tooling.some((record) => record.id === pendingToolingId)) {
      setSelectedToolingId(pendingToolingId);
      setPanelTab(nextTab);
    }

    window.sessionStorage.removeItem('zbom.toolingHub.toolingId');
    window.sessionStorage.removeItem('zbom.toolingHub.tab');
  }, [tooling]);

  const openPartLibraryForPart = (partNumber: string) => {
    window.sessionStorage.setItem('zbom.partLibrary.search', partNumber);
    window.dispatchEvent(new CustomEvent('zbom:navigate', { detail: { page: 'parts' } }));
  };

  const concreteUsage = useMemo(() => {
    const results = new Map<string, Array<{ parent: string; qty: number; path: string[] }>>();
    const concreteNumbers = new Set(selectedDesignMaster?.concretePartNumbers ?? []);
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
  }, [bomData, selectedDesignMaster]);

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
    setDesignMasterForm({ code: '', name: '', concretePartNumber: libraryParts[0]?.partNumber ?? '' });
    setToolingForm((value) => ({ ...value, designMasterPartId: created.id }));
    setIsDesignMasterFormOpen(false);
    setSaveStatus(`Created design master ${code}.`);
  };

  const handleCreateTooling = () => {
    const designMasterPartId = toolingForm.designMasterPartId || designMasterParts[0]?.id;
    if (!designMasterPartId || !toolingForm.name.trim()) return;
    const designMaster = designMasterById.get(designMasterPartId);
    const cavityCount = Number(toolingForm.cavityCount);
    const record = {
      id: `tooling-${toolingForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
      projectId: designMaster?.projectId ?? 'project-zphone-2026',
      designMasterPartId,
      name: toolingForm.name.trim(),
      supplier: toolingForm.supplier.trim() || undefined,
      cavityCount: Number.isFinite(cavityCount) && cavityCount > 0 ? cavityCount : undefined,
      owner: toolingForm.owner.trim() || undefined,
      milestones: [
        { key: 'drawingRelease' as const, status: 'not-started' as const },
        { key: 'dfm' as const, status: 'not-started' as const },
        { key: 'quotation' as const, status: 'not-started' as const },
        { key: 'kickoff' as const, status: 'not-started' as const },
        { key: 't1' as const, status: 'not-started' as const },
      ],
    };
    createTooling(record);
    setSelectedToolingId(record.id);
    setPanelTab('overview');
    setToolingForm({ designMasterPartId, name: '', supplier: '', cavityCount: '1', owner: '' });
    setIsToolingFormOpen(false);
    setSaveStatus('Created tooling record.');
  };

  const openDetails = (toolingId: string, tab: typeof panelTab = 'overview') => {
    setSelectedToolingId(toolingId);
    setPanelTab(tab);
  };

  return (
    <div className="relative flex-1 overflow-auto bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-700">
                <Hammer className="h-4 w-4" />
                Tooling Hub
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Tooling Records</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Track design-master tooling status, linked concrete parts, ownership, and milestone progress.
              </p>
              {saveStatus && <p className="mt-2 text-sm font-semibold text-emerald-700">{saveStatus}</p>}
            </div>
            {canManageTooling && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsDesignMasterFormOpen((value) => !value)}
                  className="inline-flex items-center gap-2 rounded border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
                >
                  <Plus className="h-4 w-4" />
                  Design Master
                </button>
                <button
                  type="button"
                  onClick={() => setIsToolingFormOpen((value) => !value)}
                  className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Tooling
                </button>
              </div>
            )}
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

        {isToolingFormOpen && canManageTooling && (
          <section className="rounded-lg border border-blue-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-blue-700">Create Tooling Record</h2>
            <div className="grid gap-3 md:grid-cols-6">
              <select aria-label="Tooling design master" value={toolingForm.designMasterPartId || designMasterParts[0]?.id || ''} onChange={(event) => setToolingForm((value) => ({ ...value, designMasterPartId: event.target.value }))} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
                {designMasterParts.map((part) => <option key={part.id} value={part.id}>{part.code}</option>)}
              </select>
              <input aria-label="Tooling name" value={toolingForm.name} onChange={(event) => setToolingForm((value) => ({ ...value, name: event.target.value }))} placeholder="Tooling name" className="rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
              <input aria-label="Toolmaker" value={toolingForm.supplier} onChange={(event) => setToolingForm((value) => ({ ...value, supplier: event.target.value }))} placeholder="Toolmaker" className="rounded border border-slate-300 px-3 py-2 text-sm" />
              <input aria-label="Cavity count" type="number" value={toolingForm.cavityCount} onChange={(event) => setToolingForm((value) => ({ ...value, cavityCount: event.target.value }))} className="rounded border border-slate-300 px-3 py-2 text-sm" />
              <button type="button" onClick={handleCreateTooling} className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700">
                <Save className="h-4 w-4" />
                Save
              </button>
            </div>
          </section>
        )}

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Tooling</th>
                  <th className="px-4 py-3">Design Master</th>
                  <th className="px-4 py-3">Linked Parts</th>
                  <th className="px-4 py-3">Toolmaker</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Kickoff to T1</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tooling.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                      No tooling records for this design master yet.
                    </td>
                  </tr>
                ) : tooling.map((record) => {
                  const designMaster = designMasterById.get(record.designMasterPartId);
                  const nextMilestone = getNextMilestone(record);
                  const status = getOverallStatus(record);
                  const leadTimeDays = getLeadTimeDays(record.id);

                  return (
                    <tr key={record.id} className={selectedToolingId === record.id ? 'bg-blue-50/60' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{record.name}</div>
                        <div className="text-xs text-slate-500">{record.cavityCount ? `${record.cavityCount} cavities` : 'Cavity TBD'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-bold text-slate-700">{designMaster?.code ?? 'Unmapped'}</div>
                        <div className="text-xs text-slate-500">{designMaster?.name ?? 'Design master missing'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                          {designMaster?.concretePartNumbers.length ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{record.supplier ?? 'Supplier TBD'}</td>
                      <td className="px-4 py-3 text-slate-600">{record.owner ?? 'Unassigned'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyles[status]}`}>
                          {status}
                        </span>
                        <div className="mt-1 text-xs text-slate-500">Next: {milestoneLabels[nextMilestone.key]}</div>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-700">
                        {leadTimeDays === null ? 'TBD' : `${leadTimeDays} days`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openDetails(record.id)}
                          className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selectedTooling && selectedDesignMaster && (
        <div className="absolute right-0 top-0 z-20 flex h-full w-full max-w-[440px] flex-col border-l border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 p-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{selectedTooling.name}</h2>
              <p className="mt-1 text-xs font-mono text-slate-500">{selectedDesignMaster.code}</p>
            </div>
            <button
              type="button"
              aria-label="Close tooling details"
              onClick={() => setSelectedToolingId('')}
              className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex border-b border-slate-200">
            {(['overview', 'links', 'milestones'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setPanelTab(tab)}
                className={`flex-1 px-3 py-3 text-sm font-bold capitalize ${
                  panelTab === tab ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {panelTab === 'overview' && (
              <div className="space-y-4">
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <Package2 className="h-3.5 w-3.5" />
                    Design Master
                  </div>
                  <div className="font-bold text-slate-900">{selectedDesignMaster.name}</div>
                  <div className="font-mono text-xs text-slate-500">{selectedDesignMaster.code}</div>
                </div>
                {canManageTooling && (
                  <div className="grid gap-3">
                    <label className="text-xs font-semibold text-slate-600" htmlFor={`${selectedTooling.id}-supplier`}>
                      Toolmaker
                      <input
                        id={`${selectedTooling.id}-supplier`}
                        aria-label={`${selectedTooling.name} toolmaker`}
                        value={selectedTooling.supplier ?? ''}
                        onChange={(event) => {
                          updateTooling(selectedTooling.id, { supplier: event.target.value || undefined });
                          setSaveStatus(`Updated ${selectedTooling.name} toolmaker.`);
                        }}
                        className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600" htmlFor={`${selectedTooling.id}-cavities`}>
                      Cavities
                      <input
                        id={`${selectedTooling.id}-cavities`}
                        aria-label={`${selectedTooling.name} cavity count`}
                        type="number"
                        value={selectedTooling.cavityCount ?? ''}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          updateTooling(selectedTooling.id, { cavityCount: Number.isFinite(next) && next > 0 ? next : undefined });
                          setSaveStatus(`Updated ${selectedTooling.name} cavity count.`);
                        }}
                        className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600" htmlFor={`${selectedTooling.id}-owner`}>
                      Owner
                      <input
                        id={`${selectedTooling.id}-owner`}
                        aria-label={`${selectedTooling.name} owner`}
                        value={selectedTooling.owner ?? ''}
                        onChange={(event) => {
                          updateTooling(selectedTooling.id, { owner: event.target.value || undefined });
                          setSaveStatus(`Updated ${selectedTooling.name} owner.`);
                        }}
                        className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}

            {panelTab === 'links' && (
              <div className="space-y-3">
                {selectedDesignMaster.concretePartNumbers.map((partNumber) => (
                  <div key={partNumber} className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                    <div className="flex items-center gap-2 font-bold">
                      <Link2 className="h-4 w-4" />
                      {partNumber}
                    </div>
                    <div className="mt-1 text-xs text-emerald-700">
                      BOM usage: {(concreteUsage.get(partNumber) ?? []).length || 'none'}
                    </div>
                    <button
                      type="button"
                      onClick={() => openPartLibraryForPart(partNumber)}
                      className="mt-2 rounded border border-emerald-300 bg-white px-2 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                    >
                      Open in Part Library
                    </button>
                  </div>
                ))}
              </div>
            )}

            {panelTab === 'milestones' && (
              <div className="space-y-3">
                {selectedTooling.milestones.map((milestone) => (
                  <div key={`${selectedTooling.id}-${milestone.key}`} className="rounded border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {milestoneLabels[milestone.key]}
                      </div>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyles[milestone.status]}`}>
                        {milestone.status}
                      </span>
                    </div>
                    {canManageTooling && (
                      <div className="space-y-2">
                        <select
                          aria-label={`${milestoneLabels[milestone.key]} status`}
                          value={milestone.status}
                          onChange={(event) => {
                            updateMilestone(selectedTooling.id, milestone.key, { status: event.target.value as ToolingMilestone['status'] });
                            setSaveStatus(`Updated ${milestoneLabels[milestone.key]} status.`);
                          }}
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                        >
                          <option value="not-started">not-started</option>
                          <option value="in-progress">in-progress</option>
                          <option value="done">done</option>
                          <option value="blocked">blocked</option>
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            aria-label={`${milestoneLabels[milestone.key]} planned date`}
                            type="date"
                            value={milestone.plannedDate ?? ''}
                            onChange={(event) => {
                              updateMilestone(selectedTooling.id, milestone.key, { plannedDate: event.target.value || undefined });
                              setSaveStatus(`Updated ${milestoneLabels[milestone.key]} planned date.`);
                            }}
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                          <input
                            aria-label={`${milestoneLabels[milestone.key]} actual date`}
                            type="date"
                            value={milestone.actualDate ?? ''}
                            onChange={(event) => {
                              updateMilestone(selectedTooling.id, milestone.key, { actualDate: event.target.value || undefined });
                              setSaveStatus(`Updated ${milestoneLabels[milestone.key]} actual date.`);
                            }}
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                        </div>
                        <input
                          aria-label={`${milestoneLabels[milestone.key]} owner`}
                          value={milestone.owner ?? ''}
                          onChange={(event) => {
                            updateMilestone(selectedTooling.id, milestone.key, { owner: event.target.value || undefined });
                            setSaveStatus(`Updated ${milestoneLabels[milestone.key]} owner.`);
                          }}
                          placeholder="Owner"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                        {milestone.status === 'blocked' && (
                          <textarea
                            aria-label={`${milestoneLabels[milestone.key]} blocker reason`}
                            value={milestone.blockerReason ?? ''}
                            onChange={(event) => {
                              updateMilestone(selectedTooling.id, milestone.key, { blockerReason: event.target.value || undefined });
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
            )}
          </div>
        </div>
      )}
    </div>
  );
};
