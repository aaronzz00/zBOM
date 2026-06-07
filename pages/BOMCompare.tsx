import React, { useMemo, useState } from 'react';
import { useAppStore } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { compareBOMs, DiffStatus } from '../utils/bomCompare';
import { ArrowRight, GitCompare, Download, PlusCircle, MinusCircle, AlertCircle, TrendingUp, TrendingDown, ChevronDown, Package } from 'lucide-react';
import { BOMNode, Permission } from '../types';
import { FeatureDialog } from '../components/FeatureDialog';

export const BOMCompare: React.FC = () => {
  const { bomData, snapshots: currentSnapshots, projects, getBOMAndSnapshotsForProject, project: currentProject } = useAppStore();
  const { hasPermission } = useAuth();
  const canViewCommercial = hasPermission(Permission.VIEW_COMMERCIAL_FIELDS) || hasPermission(Permission.VIEW_COST);
  
  // State for project selections
  const [leftProjectId, setLeftProjectId] = useState<string>(currentProject.id);
  const [rightProjectId, setRightProjectId] = useState<string>(currentProject.id);

  // State for selectors
  // Default: Left = Latest Snapshot of active project (if exists, else 'current'), Right = Current Working Copy
  const [leftId, setLeftId] = useState<string>(currentSnapshots.length > 0 ? currentSnapshots[0].id : 'current');
  const [rightId, setRightId] = useState<string>('current');
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [showExportSummary, setShowExportSummary] = useState(false);

  // Dynamically resolve BOM data and snapshots list for left project
  const leftProjectData = useMemo(() => {
    if (leftProjectId === currentProject.id) {
      return { bomData, snapshots: currentSnapshots };
    }
    return getBOMAndSnapshotsForProject(leftProjectId) || { bomData, snapshots: [] };
  }, [leftProjectId, currentProject.id, bomData, currentSnapshots, getBOMAndSnapshotsForProject]);

  // Dynamically resolve BOM data and snapshots list for right project
  const rightProjectData = useMemo(() => {
    if (rightProjectId === currentProject.id) {
      return { bomData, snapshots: currentSnapshots };
    }
    return getBOMAndSnapshotsForProject(rightProjectId) || { bomData, snapshots: [] };
  }, [rightProjectId, currentProject.id, bomData, currentSnapshots, getBOMAndSnapshotsForProject]);

  // Helper to get BOM Object from ID and project data context
  const getBOMById = (id: string, projectData: { bomData: BOMNode, snapshots: Array<{ id: string, name: string, data: BOMNode }> }): BOMNode | null => {
    if (id === 'current') return projectData.bomData;
    const snap = projectData.snapshots.find(s => s.id === id);
    return snap ? snap.data : projectData.bomData; // Fallback if snapshot is out of sync
  };

  const leftBOM = getBOMById(leftId, leftProjectData);
  const rightBOM = getBOMById(rightId, rightProjectData);

  // Calculate Diff
  const diffItems = useMemo(() => {
    if (!leftBOM || !rightBOM) return [];
    const allDiffs = compareBOMs(leftBOM, rightBOM);
    return showUnchanged ? allDiffs : allDiffs.filter(d => d.status !== DiffStatus.Unchanged);
  }, [leftBOM, rightBOM, showUnchanged]);

  // Statistics
  const stats = useMemo(() => {
    return {
      added: diffItems.filter(d => d.status === DiffStatus.Added).length,
      removed: diffItems.filter(d => d.status === DiffStatus.Removed).length,
      modified: diffItems.filter(d => d.status === DiffStatus.Modified).length,
      total: diffItems.length
    };
  }, [diffItems]);

  const getStatusBadge = (status: DiffStatus) => {
    switch (status) {
      case DiffStatus.Added:
        return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200"><PlusCircle className="w-3 h-3" /> Added</span>;
      case DiffStatus.Removed:
        return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200"><MinusCircle className="w-3 h-3" /> Removed</span>;
      case DiffStatus.Modified:
        return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200"><AlertCircle className="w-3 h-3" /> Changed</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-medium border border-slate-200">Unchanged</span>;
    }
  };

  const getRowClass = (status: DiffStatus) => {
    switch (status) {
      case DiffStatus.Added: return 'bg-emerald-50/40 hover:bg-emerald-50/60';
      case DiffStatus.Removed: return 'bg-rose-50/40 hover:bg-rose-50/60';
      case DiffStatus.Modified: return 'bg-amber-50/30 hover:bg-amber-50/50';
      default: return 'hover:bg-slate-50';
    }
  };

  const renderDiffCell = (oldVal: any, newVal: any, type: 'text' | 'number' | 'currency' | 'partnumber') => {
    if (type === 'currency' && !canViewCommercial) {
      return <span className="font-semibold text-slate-400">Restricted</span>;
    }

    if (oldVal === undefined && newVal !== undefined) {
        // Added
        const format = (v: any) => type === 'currency' ? `$${v.toFixed(2)}` : v;
        return <span className="font-bold text-emerald-700">{format(newVal)}</span>;
    }
    if (oldVal !== undefined && newVal === undefined) {
        // Removed
        const format = (v: any) => type === 'currency' ? `$${v.toFixed(2)}` : v;
        return <span className="line-through text-rose-400 opacity-70">{format(oldVal)}</span>;
    }
    
    if (oldVal === newVal) {
      if (type === 'currency') return newVal ? `$${newVal.toFixed(2)}` : '-';
      return newVal || oldVal || '-';
    }

    const format = (v: any) => type === 'currency' ? (v !== undefined ? `$${v.toFixed(2)}` : '-') : (v !== undefined ? v : '-');
    
    let delta = null;
    let Icon = null;
    let badgeClass = "bg-slate-100 text-slate-700 border-slate-200"; 

    if (type === 'currency' && typeof oldVal === 'number' && typeof newVal === 'number') {
        const diff = newVal - oldVal;
        const absDiff = Math.abs(diff);
        delta = diff > 0 ? `+$${absDiff.toFixed(2)}` : `-$${absDiff.toFixed(2)}`;
        
        if (diff < 0) { 
            badgeClass = "bg-emerald-100 text-emerald-700 border-emerald-200"; 
            Icon = TrendingDown;
        } else { 
            badgeClass = "bg-rose-100 text-rose-700 border-rose-200"; 
            Icon = TrendingUp;
        }
    } else if (type === 'number' && typeof oldVal === 'number' && typeof newVal === 'number') {
        const diff = newVal - oldVal;
        delta = diff > 0 ? `+${diff}` : `${diff}`;
        
        if (diff > 0) {
            badgeClass = "bg-emerald-100 text-emerald-700 border-emerald-200"; 
            Icon = TrendingUp;
        } else {
            badgeClass = "bg-rose-100 text-rose-700 border-rose-200"; 
            Icon = TrendingDown;
        }
    } else if (type === 'partnumber') {
         return (
             <div className="flex flex-col items-start gap-0.5">
                 <span className="text-xs text-rose-500 line-through opacity-70 font-mono">{oldVal}</span>
                 <span className="text-sm text-emerald-700 font-bold font-mono bg-emerald-50 px-1 rounded">{newVal}</span>
             </div>
         );
    } else {
        badgeClass = "bg-amber-100 text-amber-800 border-amber-200";
    }

    return (
      <div className="flex items-center justify-end gap-1.5 font-mono text-xs">
        {oldVal !== undefined && (
          <span className="text-slate-400 line-through decoration-slate-300 opacity-60 mr-1">{format(oldVal)}</span>
        )}
        
        {newVal !== undefined && (
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${badgeClass}`}>
            <span className="font-bold">{format(newVal)}</span>
            {delta && (
                <span className="flex items-center text-[10px] opacity-90 border-l border-current pl-1 ml-0.5">
                    {Icon && <Icon className="w-3 h-3 mr-0.5" />}
                    {delta}
                </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header / Controls */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm flex-shrink-0 z-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <GitCompare className="w-6 h-6 text-blue-600" />
              Compare Revisions
            </h1>
          </div>
          <div className="flex items-center gap-3">
             <button
                type="button"
                onClick={() => setShowExportSummary(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-colors"
             >
                <Download className="w-4 h-4" />
                Export Report
             </button>
          </div>
        </div>
        
        {/* Model Selection Bar */}
        <div className="flex gap-6 bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4 items-stretch">
            {/* Baseline (Left) */}
            <div className="flex-1 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs flex-shrink-0">A</div>
                <div className="flex-1 min-w-0">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Baseline (Old)</label>
                    <div className="flex gap-2">
                        {/* Project selector */}
                        <div className="w-1/2 relative">
                            <select 
                                value={leftProjectId}
                                onChange={(e) => {
                                    const pid = e.target.value;
                                    setLeftProjectId(pid);
                                    const pData = pid === currentProject.id ? { bomData, snapshots: currentSnapshots } : getBOMAndSnapshotsForProject(pid);
                                    if (pData && pData.snapshots.length > 0) {
                                        setLeftId(pData.snapshots[0].id);
                                    } else {
                                        setLeftId('current');
                                    }
                                }}
                                className="w-full appearance-none bg-white border border-slate-300 hover:border-blue-400 px-3 py-2 pr-8 rounded text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors"
                            >
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                        {/* Snapshot selector */}
                        <div className="w-1/2 relative">
                            <select 
                                value={leftId}
                                onChange={(e) => setLeftId(e.target.value)}
                                className="w-full appearance-none bg-white border border-slate-300 hover:border-blue-400 px-3 py-2 pr-8 rounded text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors"
                            >
                                <option value="current">Current Copy ({leftProjectData.bomData.revision})</option>
                                {leftProjectData.snapshots.map(snap => (
                                    <option key={snap.id} value={snap.id}>{snap.name} ({new Date(snap.timestamp).toLocaleDateString()})</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                    <ArrowRight className="w-4 h-4" />
                </div>
            </div>

            {/* Target (Right) */}
            <div className="flex-1 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">B</div>
                <div className="flex-1 min-w-0">
                    <label className="text-xs font-semibold text-blue-700 uppercase tracking-wider block mb-1">Target (New)</label>
                    <div className="flex gap-2">
                        {/* Project selector */}
                        <div className="w-1/2 relative">
                            <select 
                                value={rightProjectId}
                                onChange={(e) => {
                                    const pid = e.target.value;
                                    setRightProjectId(pid);
                                    const pData = pid === currentProject.id ? { bomData, snapshots: currentSnapshots } : getBOMAndSnapshotsForProject(pid);
                                    if (pData && pData.snapshots.length > 0) {
                                        setRightId(pData.snapshots[0].id);
                                    } else {
                                        setRightId('current');
                                    }
                                }}
                                className="w-full appearance-none bg-white border border-slate-300 hover:border-blue-400 px-3 py-2 pr-8 rounded text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors shadow-sm"
                            >
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                        {/* Snapshot selector */}
                        <div className="w-1/2 relative">
                            <select 
                                value={rightId}
                                onChange={(e) => setRightId(e.target.value)}
                                className="w-full appearance-none bg-white border border-blue-300 px-3 py-2 pr-8 rounded text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors shadow-sm"
                            >
                                 <option value="current">Current Copy ({rightProjectData.bomData.revision})</option>
                                 {rightProjectData.snapshots.map(snap => (
                                    <option key={snap.id} value={snap.id}>{snap.name} ({new Date(snap.timestamp).toLocaleDateString()})</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between">
             <div className="flex items-center gap-2">
                 <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                    <input 
                    type="checkbox" 
                    checked={showUnchanged} 
                    onChange={(e) => setShowUnchanged(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Show Unchanged Parts
                 </label>
             </div>
             
             <div className="flex gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> {stats.added} Added</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500"></div> {stats.removed} Removed</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> {stats.modified} Modified</span>
             </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-32">Status</th>
                <th className="px-4 py-3 w-48">Part Number</th>
                <th className="px-4 py-3">Name / Description</th>
                <th className="px-4 py-3 w-28 text-center">Rev</th>
                <th className="px-4 py-3 w-32 text-right">Quantity</th>
                <th className="px-4 py-3 w-32 text-right">Unit Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(!leftBOM || !rightBOM) ? (
                 <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                        <p>Please select two valid snapshots or versions to compare.</p>
                    </td>
                 </tr>
              ) : diffItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <Package className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                    <p>Models are identical.</p>
                  </td>
                </tr>
              ) : (
                diffItems.map((item, idx) => (
                  <tr key={`${item.partNumber}-${idx}`} className={getRowClass(item.status)}>
                    <td className="px-4 py-3">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="px-4 py-3">
                      {item.oldPartNumber && item.status === DiffStatus.Modified 
                        ? renderDiffCell(item.oldPartNumber, item.partNumber, 'partnumber')
                        : <span className="font-medium text-slate-700 font-mono">{item.partNumber}</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.name}
                      {item.oldPartNumber && <div className="text-[10px] text-amber-600 font-medium mt-0.5">Part Replacement Detected</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        {renderDiffCell(item.oldRev, item.newRev, 'text')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                       {renderDiffCell(item.oldQty, item.newQty, 'number')}
                    </td>
                    <td className="px-4 py-3 text-right">
                       {renderDiffCell(item.oldCost, item.newCost, 'currency')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {showExportSummary && (
        <FeatureDialog title="Export Report Ready" closeLabel="Close preview" onClose={() => setShowExportSummary(false)}>
          <p className="font-semibold text-slate-900">Comparison report preview is ready for review.</p>
          <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex justify-between"><span>Added rows</span><span className="font-bold text-emerald-700">{stats.added}</span></div>
            <div className="flex justify-between"><span>Removed rows</span><span className="font-bold text-rose-700">{stats.removed}</span></div>
            <div className="flex justify-between"><span>Changed rows</span><span className="font-bold text-amber-700">{stats.modified}</span></div>
          </div>
          {!canViewCommercial && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
              Commercial values are restricted for this role and will be omitted from the export preview.
            </p>
          )}
        </FeatureDialog>
      )}
    </div>
  );
};
