import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  Download,
  Hammer,
  Link2,
  Package2,
  Plus,
  Save,
  Search,
  X,
} from 'lucide-react';
import {
  DEFAULT_TOOLING_MILESTONES,
  TOOLING_CATEGORIES,
  TOOLING_CATEGORY_LABELS,
  TOOLING_STATUS_LABELS,
  TOOLING_STATUSES,
  type Tooling,
  type ToolingCategory,
  type ToolingMilestone,
  type ToolingMilestoneKey,
  type ToolingStatus,
} from '../domain/toolingTypes';
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

const lifecycleStyles: Record<ToolingStatus, string> = {
  pending: 'border-slate-200 bg-slate-50 text-slate-600',
  'in-progress': 'border-blue-200 bg-blue-50 text-blue-700',
  't1-complete': 'border-cyan-200 bg-cyan-50 text-cyan-700',
  'in-modify': 'border-amber-200 bg-amber-50 text-amber-700',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'approved-next-build': 'border-lime-200 bg-lime-50 text-lime-700',
  'on-hold': 'border-orange-200 bg-orange-50 text-orange-700',
  scrapped: 'border-stone-300 bg-stone-100 text-stone-700',
};

const typeStyles: Record<ToolingCategory, { border: string; dot: string; badge: string; short: string }> = {
  'injection-mold': { border: 'border-l-blue-500', dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700', short: 'INJ' },
  'stamping-die': { border: 'border-l-rose-500', dot: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700', short: 'STP' },
  'die-cast-mold': { border: 'border-l-zinc-500', dot: 'bg-zinc-500', badge: 'bg-zinc-100 text-zinc-700', short: 'DCM' },
  'mim-mold': { border: 'border-l-violet-500', dot: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700', short: 'MIM' },
  'press-mold': { border: 'border-l-teal-500', dot: 'bg-teal-500', badge: 'bg-teal-50 text-teal-700', short: 'PRS' },
  gauge: { border: 'border-l-amber-500', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700', short: 'GAU' },
  fixture: { border: 'border-l-emerald-500', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700', short: 'FIX' },
  jig: { border: 'border-l-indigo-500', dot: 'bg-indigo-500', badge: 'bg-indigo-50 text-indigo-700', short: 'JIG' },
  other: { border: 'border-l-slate-400', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-700', short: 'OTH' },
};

const milestoneDotStyles: Record<ToolingMilestone['status'], string> = {
  'not-started': 'bg-slate-300',
  'in-progress': 'animate-pulse bg-blue-500 ring-4 ring-blue-100',
  done: 'bg-emerald-500',
  blocked: 'bg-red-500',
};

const addDaysIso = (date: string | undefined, days: number | undefined) => {
  if (!date || !Number.isFinite(days) || !days) return null;
  const value = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(value.getTime())) return null;
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const getNextMilestone = (tooling: Tooling) => (
  tooling.milestones.find((milestone) => milestone.status !== 'done') ?? tooling.milestones[tooling.milestones.length - 1]
);

export const ToolingHub: React.FC = () => {
  const {
    designMasterParts,
    tooling,
    getLeadTimeDays,
    getT1PlannedDate,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ToolingCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ToolingStatus>('all');
  const [groupBy, setGroupBy] = useState<'none' | 'type' | 'design-master'>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showBlockers, setShowBlockers] = useState(true);
  const [designMasterForm, setDesignMasterForm] = useState({
    code: '',
    name: '',
    concretePartNumber: libraryParts[0]?.partNumber ?? '',
  });
  const [toolingForm, setToolingForm] = useState({
    designMasterPartId: designMasterParts[0]?.id ?? '',
    name: '',
    type: 'injection-mold' as ToolingCategory,
    leadTimeDays: '21',
    supplier: '',
    cavityCount: '1',
    owner: '',
  });
  const [overviewDraft, setOverviewDraft] = useState({
    supplier: '',
    owner: '',
    leadTimeDays: '',
    cavityCount: '',
  });
  const canManageTooling = hasPermission(Permission.MANAGE_TOOLING);

  const designMasterById = useMemo(() => (
    new Map(designMasterParts.map((part) => [part.id, part]))
  ), [designMasterParts]);

  const selectedTooling = tooling.find((record) => record.id === selectedToolingId) ?? null;
  const selectedDesignMaster = selectedTooling ? designMasterById.get(selectedTooling.designMasterPartId) : null;

  useEffect(() => {
    if (!selectedTooling) {
      setOverviewDraft({ supplier: '', owner: '', leadTimeDays: '', cavityCount: '' });
      return;
    }

    setOverviewDraft({
      supplier: selectedTooling.supplier ?? '',
      owner: selectedTooling.owner ?? '',
      leadTimeDays: selectedTooling.leadTimeDays === undefined ? '' : String(selectedTooling.leadTimeDays),
      cavityCount: selectedTooling.cavityCount === undefined ? '' : String(selectedTooling.cavityCount),
    });
  }, [
    selectedTooling?.id,
    selectedTooling?.supplier,
    selectedTooling?.owner,
    selectedTooling?.leadTimeDays,
    selectedTooling?.cavityCount,
  ]);

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

  const blockers = useMemo(() => (
    tooling.flatMap((record) => (
      record.milestones
        .filter((milestone) => milestone.status === 'blocked')
        .map((milestone) => ({ record, milestone }))
    ))
  ), [tooling]);

  const delayedCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return tooling.filter((record) => {
      if (record.status === 'approved' || record.status === 'approved-next-build') return false;
      const t1Planned = addDaysIso(record.milestones.find((milestone) => milestone.key === 'kickoff')?.plannedDate, record.leadTimeDays);
      return Boolean(t1Planned && t1Planned < today);
    }).length;
  }, [tooling]);

  const kpis = useMemo(() => {
    const completed = tooling.filter((record) => record.status === 'approved' || record.status === 'approved-next-build').length;
    const inProgress = tooling.filter((record) => record.status === 'in-progress').length;
    const leadTimes = tooling.map((record) => record.leadTimeDays).filter((days): days is number => Number.isFinite(days));
    const avgLeadTime = leadTimes.length ? Math.round(leadTimes.reduce((sum, days) => sum + days, 0) / leadTimes.length) : null;
    return { total: tooling.length, completed, inProgress, blocked: blockers.length, avgLeadTime };
  }, [blockers.length, tooling]);

  const filteredTooling = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tooling.filter((record) => {
      const designMaster = designMasterById.get(record.designMasterPartId);
      const matchesQuery = !query || [
        record.toolingNumber,
        record.name,
        record.supplier,
        record.owner,
        designMaster?.code,
        designMaster?.name,
      ].some((value) => value?.toLowerCase().includes(query));
      const matchesCategory = categoryFilter === 'all' || record.type === categoryFilter;
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, designMasterById, searchQuery, statusFilter, tooling]);

  const groupedTooling = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: 'All Tooling', records: filteredTooling }];
    const groups = new Map<string, { label: string; records: Tooling[] }>();
    for (const record of filteredTooling) {
      const designMaster = designMasterById.get(record.designMasterPartId);
      const key = groupBy === 'type' ? record.type : record.designMasterPartId;
      const label = groupBy === 'type'
        ? TOOLING_CATEGORY_LABELS[record.type]
        : `${designMaster?.code ?? 'Unmapped'} - ${designMaster?.name ?? 'Design master missing'}`;
      const group = groups.get(key) ?? { label, records: [] };
      group.records.push(record);
      groups.set(key, group);
    }
    return Array.from(groups.entries()).map(([key, group]) => ({ key, ...group }));
  }, [designMasterById, filteredTooling, groupBy]);

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
        usages.push({ parent: path[path.length - 1] ?? 'Root', qty: node.quantity, path });
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

  const handleCreateTooling = async () => {
    const designMasterPartId = toolingForm.designMasterPartId || designMasterParts[0]?.id;
    const leadTimeDays = Number(toolingForm.leadTimeDays);
    if (!designMasterPartId || !toolingForm.name.trim() || !Number.isFinite(leadTimeDays) || leadTimeDays <= 0) return;
    const designMaster = designMasterById.get(designMasterPartId);
    const cavityCount = toolingForm.cavityCount.trim();
    const created = await createTooling({
      id: `tooling-draft-${Date.now()}`,
      projectId: designMaster?.projectId ?? 'project-zphone-2026',
      designMasterPartId,
      toolingNumber: '',
      name: toolingForm.name.trim(),
      type: toolingForm.type,
      status: 'pending',
      supplier: toolingForm.supplier.trim() || undefined,
      cavityCount: cavityCount || undefined,
      owner: toolingForm.owner.trim() || undefined,
      leadTimeDays,
      milestones: DEFAULT_TOOLING_MILESTONES.map((milestone) => ({ ...milestone })),
    });
    setSelectedToolingId(created.id);
    setPanelTab('overview');
    setToolingForm({ designMasterPartId, name: '', type: 'injection-mold', leadTimeDays: '21', supplier: '', cavityCount: '1', owner: '' });
    setIsToolingFormOpen(false);
    setSaveStatus(`Created ${created.toolingNumber}.`);
  };

  const openDetails = (toolingId: string, tab: typeof panelTab = 'overview') => {
    setSelectedToolingId(toolingId);
    setPanelTab(tab);
  };

  const commitOverviewDraft = (field: 'supplier' | 'owner' | 'leadTimeDays' | 'cavityCount') => {
    if (!selectedTooling) return;

    if (field === 'supplier' && overviewDraft.supplier !== (selectedTooling.supplier ?? '')) {
      updateTooling(selectedTooling.id, { supplier: overviewDraft.supplier.trim() || undefined });
    }
    if (field === 'owner' && overviewDraft.owner !== (selectedTooling.owner ?? '')) {
      updateTooling(selectedTooling.id, { owner: overviewDraft.owner.trim() || undefined });
    }
    if (field === 'leadTimeDays') {
      const value = overviewDraft.leadTimeDays.trim();
      const next = value ? Number(value) : undefined;
      if ((next ?? undefined) !== selectedTooling.leadTimeDays) {
        updateTooling(selectedTooling.id, { leadTimeDays: Number.isFinite(next) && next! > 0 ? next : undefined });
      }
    }
    if (field === 'cavityCount') {
      const next = overviewDraft.cavityCount.trim();
      if ((next || undefined) !== selectedTooling.cavityCount) {
        updateTooling(selectedTooling.id, { cavityCount: next || undefined });
      }
    }
  };

  const handleUpdateMilestone = (toolingId: string, milestoneKey: ToolingMilestoneKey, updates: Partial<ToolingMilestone>) => {
    updateMilestone(toolingId, milestoneKey, updates);
    const milestoneName = milestoneLabels[milestoneKey];
    if (updates.status !== undefined) {
      setSaveStatus(`Updated ${milestoneName} status.`);
    } else if (updates.plannedDate !== undefined) {
      setSaveStatus(`Updated ${milestoneName} planned date.`);
    } else if (updates.actualDate !== undefined) {
      setSaveStatus(`Updated ${milestoneName} actual date.`);
    } else if (updates.blockerReason !== undefined) {
      setSaveStatus(`Updated ${milestoneName} blocker reason.`);
    } else if (updates.owner !== undefined) {
      setSaveStatus(`Updated ${milestoneName} owner.`);
    }
  };

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((value) => {
      const next = new Set(value);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const exportCsv = () => {
    const rows = filteredTooling.map((record) => {
      const designMaster = designMasterById.get(record.designMasterPartId);
      const milestones = new Map(record.milestones.map((milestone) => [milestone.key, milestone]));
      return [
        record.toolingNumber,
        record.name,
        TOOLING_CATEGORY_LABELS[record.type],
        designMaster ? `${designMaster.code} ${designMaster.name}` : 'Unmapped',
        record.supplier,
        record.owner,
        record.cavityCount,
        record.leadTimeDays,
        TOOLING_STATUS_LABELS[record.status],
        milestones.get('drawingRelease')?.status,
        milestones.get('dfm')?.status,
        milestones.get('quotation')?.status,
        milestones.get('kickoff')?.status,
        milestones.get('t1')?.status,
        milestones.get('kickoff')?.plannedDate,
        milestones.get('kickoff')?.actualDate,
        getT1PlannedDate(record.id),
        milestones.get('t1')?.actualDate,
      ];
    });
    const header = [
      'Tooling Number', 'Name', 'Type', 'Design Master', 'Supplier', 'Owner', 'Cavities', 'Lead Time', 'Status',
      'Drawing Release Status', 'DFM Status', 'Quotation Status', 'Kickoff Status', 'T1 Status',
      'Kickoff Planned', 'Kickoff Actual', 'T1 Planned', 'T1 Actual',
    ];
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tooling-hub.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderRows = (records: Tooling[]) => records.map((record) => {
    const designMaster = designMasterById.get(record.designMasterPartId);
    const nextMilestone = getNextMilestone(record);
    const measuredLeadTimeDays = getLeadTimeDays(record.id);
    const leadTimeDays = record.leadTimeDays ?? measuredLeadTimeDays;
    const t1PlannedDate = getT1PlannedDate(record.id);
    const typeStyle = typeStyles[record.type];

    return (
      <tr key={record.id} className={`border-l-4 ${typeStyle.border} ${selectedToolingId === record.id ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}>
        <td className="px-4 py-3">
          <div className="font-mono text-sm font-bold text-slate-900">{record.toolingNumber || 'UNNUMBERED'}</div>
          <div className="text-xs text-slate-500">{record.name}</div>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${typeStyle.badge}`}>
            <span className={`h-2 w-2 rounded-full ${typeStyle.dot}`} />
            {typeStyle.short}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="font-mono text-xs font-bold text-slate-700">{designMaster?.code ?? 'Unmapped'}</div>
          <div className="text-xs text-slate-500">{designMaster?.name ?? 'Design master missing'}</div>
        </td>
        <td className="px-4 py-3 text-slate-600">
          <div>{record.supplier ?? 'Supplier TBD'}</div>
          <div title={t1PlannedDate ? `Planned T1: ${t1PlannedDate}` : 'Planned T1 requires kickoff date and lead time'} className="text-xs font-bold text-slate-500">
            {leadTimeDays === null ? 'TBD' : `${leadTimeDays} days`}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {record.milestones.map((milestone) => (
              <button
                key={milestone.key}
                type="button"
                title={`${milestoneLabels[milestone.key]}: ${milestone.status}${milestone.blockerReason ? ` - ${milestone.blockerReason}` : ''}`}
                onClick={() => openDetails(record.id, 'milestones')}
                className={`h-3 w-3 rounded-full ${milestoneDotStyles[milestone.status]}`}
              >
                <span className="sr-only">{milestone.status}</span>
              </button>
            ))}
          </div>
          <div className="mt-1 text-xs text-slate-500">Next: {milestoneLabels[nextMilestone.key]}</div>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${lifecycleStyles[record.status]}`}>
            {TOOLING_STATUS_LABELS[record.status]}
          </span>
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
  });

  const selectedKickoff = selectedTooling?.milestones.find((milestone) => milestone.key === 'kickoff');
  const selectedT1 = selectedTooling?.milestones.find((milestone) => milestone.key === 't1');
  const selectedT1Planned = selectedTooling ? getT1PlannedDate(selectedTooling.id) : null;
  const selectedIsDelayed = Boolean(
    selectedTooling &&
    selectedT1Planned &&
    selectedT1Planned < new Date().toISOString().slice(0, 10) &&
    selectedTooling.status !== 'approved' &&
    selectedTooling.status !== 'approved-next-build',
  );

  return (
    <div className="relative flex-1 overflow-auto bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <section className="bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase text-emerald-700">
                <Hammer className="h-4 w-4" />
                Tooling Hub
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Tooling Records</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Track tooling categories, owners, lifecycle status, and kickoff-to-T1 execution.
              </p>
              {saveStatus && <p className="mt-2 text-sm font-semibold text-emerald-700">{saveStatus}</p>}
            </div>
            {canManageTooling && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setIsDesignMasterFormOpen((value) => !value)} className="inline-flex items-center gap-2 rounded border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
                  <Plus className="h-4 w-4" />
                  Design Master
                </button>
                <button type="button" onClick={() => setIsToolingFormOpen((value) => !value)} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700">
                  <Plus className="h-4 w-4" />
                  Tooling
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-5">
          {[
            ['Total Tooling', kpis.total],
            ['Completed', kpis.completed],
            ['In Progress', kpis.inProgress],
            ['Blocked', kpis.blocked],
            ['Avg L/T', kpis.avgLeadTime === null ? 'TBD' : `${kpis.avgLeadTime}d`],
          ].map(([label, value]) => (
            <div key={label} className="rounded border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
            </div>
          ))}
        </section>

        {blockers.length > 0 && (
          <section className="rounded border border-red-200 bg-white shadow-sm">
            <button type="button" onClick={() => setShowBlockers((value) => !value)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold text-red-700">
              <span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Active Blockers</span>
              <ChevronDown className={`h-4 w-4 transition ${showBlockers ? 'rotate-180' : ''}`} />
            </button>
            {showBlockers && (
              <div className="divide-y divide-red-100 border-t border-red-100">
                {blockers.map(({ record, milestone }) => (
                  <button key={`${record.id}-${milestone.key}`} type="button" onClick={() => openDetails(record.id, 'milestones')} className="block w-full px-4 py-3 text-left text-sm hover:bg-red-50">
                    <span className="font-mono font-bold text-red-800">{record.toolingNumber}</span>
                    <span className="ml-2 font-semibold text-slate-800">{milestoneLabels[milestone.key]}</span>
                    <span className="ml-2 text-slate-500">{milestone.blockerReason ?? 'No blocker reason captured.'}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {isDesignMasterFormOpen && canManageTooling && (
          <section className="rounded border border-emerald-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold uppercase text-emerald-700">Create Design Master Part</h2>
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
          <section className="rounded border border-blue-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold uppercase text-blue-700">Create Tooling Record</h2>
            <div className="grid gap-3 md:grid-cols-7">
              <select aria-label="Tooling design master" value={toolingForm.designMasterPartId || designMasterParts[0]?.id || ''} onChange={(event) => setToolingForm((value) => ({ ...value, designMasterPartId: event.target.value }))} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
                {designMasterParts.map((part) => <option key={part.id} value={part.id}>{part.code}</option>)}
              </select>
              <input aria-label="Tooling name" value={toolingForm.name} onChange={(event) => setToolingForm((value) => ({ ...value, name: event.target.value }))} placeholder="Tooling name" className="rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
              <select aria-label="Tooling type" value={toolingForm.type} onChange={(event) => setToolingForm((value) => ({ ...value, type: event.target.value as ToolingCategory }))} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
                {TOOLING_CATEGORIES.map((category) => <option key={category} value={category}>{TOOLING_CATEGORY_LABELS[category]}</option>)}
              </select>
              <input aria-label="Lead time days" type="number" min={1} value={toolingForm.leadTimeDays} onChange={(event) => setToolingForm((value) => ({ ...value, leadTimeDays: event.target.value }))} placeholder="L/T days" className="rounded border border-slate-300 px-3 py-2 text-sm" />
              <input aria-label="Toolmaker" value={toolingForm.supplier} onChange={(event) => setToolingForm((value) => ({ ...value, supplier: event.target.value }))} placeholder="Toolmaker" className="rounded border border-slate-300 px-3 py-2 text-sm" />
              <button type="button" onClick={handleCreateTooling} className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700">
                <Save className="h-4 w-4" />
                Save
              </button>
            </div>
          </section>
        )}

        <section className="rounded border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search number, name, supplier, owner, or DMP" className="w-full rounded border border-slate-300 py-2 pl-9 pr-3 text-sm" />
            </label>
            <select aria-label="Filter by tooling type" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as typeof categoryFilter)} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="all">All Types</option>
              {TOOLING_CATEGORIES.map((category) => <option key={category} value={category}>{TOOLING_CATEGORY_LABELS[category]}</option>)}
            </select>
            <select aria-label="Filter by tooling status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="all">All Statuses</option>
              {TOOLING_STATUSES.map((status) => <option key={status} value={status}>{TOOLING_STATUS_LABELS[status]}</option>)}
            </select>
            <select aria-label="Group tooling records" value={groupBy} onChange={(event) => setGroupBy(event.target.value as typeof groupBy)} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="none">Group: None</option>
              <option value="type">Group: Type</option>
              <option value="design-master">Group: Design Master</option>
            </select>
            <button type="button" onClick={exportCsv} className="inline-flex items-center justify-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </section>

        <section className="rounded border border-slate-200 bg-white shadow-sm">
          {groupedTooling.map((group) => (
            <div key={group.key} className="border-b border-slate-100 last:border-b-0">
              {groupBy !== 'none' && (
                <button type="button" onClick={() => toggleGroup(group.key)} className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">
                  <span>{group.label} ({group.records.length})</span>
                  <ChevronDown className={`h-4 w-4 transition ${collapsedGroups.has(group.key) ? '' : 'rotate-180'}`} />
                </button>
              )}
              {!collapsedGroups.has(group.key) && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Tooling</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Design Master</th>
                        <th className="px-4 py-3">Supplier / L/T</th>
                        <th className="px-4 py-3">Milestones</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.records.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No tooling records match this view.</td></tr>
                      ) : renderRows(group.records)}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </section>
      </div>

      {selectedTooling && selectedDesignMaster && (
        <div className="absolute right-0 top-0 z-20 flex h-full w-full max-w-[460px] flex-col border-l border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 p-5">
            <div>
              <div className="font-mono text-xl font-bold text-slate-900">{selectedTooling.toolingNumber || 'UNNUMBERED'}</div>
              <p className="mt-1 text-sm font-semibold text-slate-700">{selectedTooling.name}</p>
              <p className="mt-1 text-xs font-mono text-slate-500">{selectedDesignMaster.code}</p>
            </div>
            <button type="button" aria-label="Close tooling details" onClick={() => setSelectedToolingId('')} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex border-b border-slate-200">
            {(['overview', 'links', 'milestones'] as const).map((tab) => (
              <button key={tab} type="button" onClick={() => setPanelTab(tab)} className={`flex-1 px-3 py-3 text-sm font-bold capitalize ${panelTab === tab ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {panelTab === 'overview' && (
              <div className="space-y-4">
                {canManageTooling && (
                  <label className="text-xs font-semibold text-slate-600" htmlFor={`${selectedTooling.id}-status`}>
                    Lifecycle Status
                    <select id={`${selectedTooling.id}-status`} value={selectedTooling.status} onChange={(event) => updateTooling(selectedTooling.id, { status: event.target.value as ToolingStatus })} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm">
                      {TOOLING_STATUSES.map((status) => <option key={status} value={status}>{TOOLING_STATUS_LABELS[status]}</option>)}
                    </select>
                  </label>
                )}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-bold uppercase text-slate-500">Supplier</div><div className="mt-1 font-semibold text-slate-900">{selectedTooling.supplier ?? 'TBD'}</div></div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-bold uppercase text-slate-500">Cavities</div><div className="mt-1 font-semibold text-slate-900">{selectedTooling.cavityCount ?? 'TBD'}</div></div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-bold uppercase text-slate-500">Lead Time</div><div className="mt-1 font-semibold text-slate-900">{selectedTooling.leadTimeDays ? `${selectedTooling.leadTimeDays} days` : 'TBD'}</div></div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-bold uppercase text-slate-500">T1 Planned</div><div className={`mt-1 font-semibold ${selectedIsDelayed ? 'text-red-700' : 'text-slate-900'}`}>{selectedT1Planned ?? 'Needs kickoff'}</div></div>
                </div>
                {selectedIsDelayed && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">T1 is delayed and this Tooling is not approved.</div>}
                {canManageTooling && (
                  <div className="grid gap-3">
                    <label className="text-xs font-semibold text-slate-600" htmlFor={`${selectedTooling.id}-type`}>
                      Type
                      <select id={`${selectedTooling.id}-type`} value={selectedTooling.type} onChange={(event) => updateTooling(selectedTooling.id, { type: event.target.value as ToolingCategory })} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm">
                        {TOOLING_CATEGORIES.map((category) => <option key={category} value={category}>{TOOLING_CATEGORY_LABELS[category]}</option>)}
                      </select>
                    </label>
                    <input aria-label={`${selectedTooling.name} toolmaker`} value={overviewDraft.supplier} onChange={(event) => setOverviewDraft((value) => ({ ...value, supplier: event.target.value }))} onBlur={() => commitOverviewDraft('supplier')} placeholder="Supplier" className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm" />
                    <input aria-label={`${selectedTooling.name} lead time`} type="number" min={1} value={overviewDraft.leadTimeDays} onChange={(event) => setOverviewDraft((value) => ({ ...value, leadTimeDays: event.target.value }))} onBlur={() => commitOverviewDraft('leadTimeDays')} placeholder="Lead time days" className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm" />
                    <input aria-label={`${selectedTooling.name} cavity count`} type="text" value={overviewDraft.cavityCount} onChange={(event) => setOverviewDraft((value) => ({ ...value, cavityCount: event.target.value }))} onBlur={() => commitOverviewDraft('cavityCount')} placeholder="Cavities" className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm" />
                    <input aria-label={`${selectedTooling.name} owner`} value={overviewDraft.owner} onChange={(event) => setOverviewDraft((value) => ({ ...value, owner: event.target.value }))} onBlur={() => commitOverviewDraft('owner')} placeholder="Owner" className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm" />
                  </div>
                )}
              </div>
            )}

            {panelTab === 'links' && (
              <div className="space-y-3">
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase text-slate-500"><Package2 className="h-3.5 w-3.5" /> Design Master</div>
                  <div className="font-bold text-slate-900">{selectedDesignMaster.name}</div>
                  <div className="font-mono text-xs text-slate-500">{selectedDesignMaster.code}</div>
                </div>
                {selectedDesignMaster.concretePartNumbers.map((partNumber) => (
                  <div key={partNumber} className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                    <div className="flex items-center gap-2 font-bold"><Link2 className="h-4 w-4" />{partNumber}</div>
                    <div className="mt-1 text-xs text-emerald-700">BOM usage: {(concreteUsage.get(partNumber) ?? []).length || 'none'}</div>
                    <button type="button" onClick={() => openPartLibraryForPart(partNumber)} className="mt-2 rounded border border-emerald-300 bg-white px-2 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100">Open in Part Library</button>
                  </div>
                ))}
              </div>
            )}

            {panelTab === 'milestones' && (
              <div className="space-y-3">
                {selectedTooling.milestones.map((milestone) => {
                  const isKickoff = milestone.key === 'kickoff';
                  const isT1 = milestone.key === 't1';
                  return (
                    <div key={`${selectedTooling.id}-${milestone.key}`} className="rounded border border-slate-200 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-500"><CalendarDays className="h-3.5 w-3.5" />{milestoneLabels[milestone.key]}</div>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyles[milestone.status]}`}>{milestone.status}</span>
                      </div>
                      {canManageTooling && (
                        <div className="space-y-2">
                          <select aria-label={`${milestoneLabels[milestone.key]} status`} value={milestone.status} onChange={(event) => handleUpdateMilestone(selectedTooling.id, milestone.key, { status: event.target.value as ToolingMilestone['status'] })} className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs">
                            <option value="not-started">not-started</option>
                            <option value="in-progress">in-progress</option>
                            <option value="done">done</option>
                            <option value="blocked">blocked</option>
                          </select>
                          {(isKickoff || isT1) && (
                            <div className="grid grid-cols-2 gap-2">
                              {isKickoff ? (
                                <input aria-label={`${milestoneLabels[milestone.key]} planned date`} type="date" value={milestone.plannedDate ?? ''} onChange={(event) => handleUpdateMilestone(selectedTooling.id, milestone.key, { plannedDate: event.target.value || undefined })} className="w-full rounded border border-slate-300 px-2 py-1 text-xs" />
                              ) : (
                                <input aria-label="T1 planned date" type="date" value={selectedT1Planned ?? ''} readOnly className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500" />
                              )}
                              <input aria-label={`${milestoneLabels[milestone.key]} actual date`} type="date" value={milestone.actualDate ?? ''} onChange={(event) => handleUpdateMilestone(selectedTooling.id, milestone.key, { actualDate: event.target.value || undefined })} className="w-full rounded border border-slate-300 px-2 py-1 text-xs" />
                            </div>
                          )}
                          {milestone.status === 'blocked' && (
                            <textarea aria-label={`${milestoneLabels[milestone.key]} blocker reason`} value={milestone.blockerReason ?? ''} onChange={(event) => handleUpdateMilestone(selectedTooling.id, milestone.key, { blockerReason: event.target.value || undefined })} placeholder="Blocker reason" rows={2} className="w-full rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
