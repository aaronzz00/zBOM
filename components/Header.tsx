import React, { useState, useEffect } from 'react';
import { Search, Bell, ChevronDown, Scale, GitMerge, Check, AlertCircle, X } from 'lucide-react';
import { Project, Permission } from '../types';
import { useAuth } from '../context/AuthContext';
import { useBOMStore } from '../stores/useBOMStore';

interface HeaderProps {
  project: Project;
  projects: Project[];
  onProjectChange: (projectId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ project, projects, onProjectChange }) => {
  const { currentUser, hasPermission } = useAuth();
  const { projectFlows, projectFlowAssociations, updateProjectPhase } = useBOMStore();

  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [targetPhase, setTargetPhase] = useState<'EVT' | 'DVT' | 'PVT' | 'MP' | ''>('');
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const roleTitles = {
    ADMIN: 'System Administrator',
    ENG_LEAD: 'Engineering Lead',
    SOURCING: 'Procurement Lead',
    VIEWER: 'Read-only Reviewer',
  } as const;

  const canTransition = hasPermission(Permission.TRANSITION_PROJECT_PHASE);
  
  // Resolve current project's flow rule
  const assignedFlowId = projectFlowAssociations[project.id] ?? 'flow-standard';
  const flowRule = projectFlows.find((f) => f.id === assignedFlowId) ?? projectFlows[0];
  const transitionConfig = flowRule?.transitions[project.phase];
  const allowedTargets = transitionConfig?.targetStages ?? [];
  const checklistItems = transitionConfig?.checklist ?? [];

  // Reset target selection when project or modal changes
  useEffect(() => {
    if (allowedTargets.length > 0) {
      setTargetPhase(allowedTargets[0] as 'EVT' | 'DVT' | 'PVT' | 'MP');
    } else {
      setTargetPhase('');
    }
    setCheckedItems({});
  }, [project.id, project.phase, showTransitionModal]);

  const allChecked = checklistItems.every((item) => checkedItems[item]);

  const handleConfirmTransition = () => {
    if (!targetPhase) return;
    const signatures = checklistItems.map((item) => ({
      item,
      actor: currentUser.name,
      role: currentUser.role,
      timestamp: new Date().toISOString(),
    }));
    updateProjectPhase(project.id, targetPhase as 'EVT' | 'DVT' | 'PVT' | 'MP', signatures);
    setShowTransitionModal(false);
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-4 lg:px-6 flex-shrink-0 z-10">
      {/* Left: Breadcrumbs / Project Selector */}
      <div className="flex min-w-0 items-center gap-3 lg:gap-4">
        <div className="min-w-0 flex flex-col">
          <label htmlFor="active-project-select" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Project</label>
          <div className="flex items-center gap-2">
            <select
              id="active-project-select"
              aria-label="Active Project"
              value={project.id}
              onChange={(event) => onProjectChange(event.target.value)}
              className="max-w-[210px] truncate rounded-md border border-transparent bg-transparent py-0.5 pr-7 text-base font-bold text-slate-800 transition-colors hover:border-slate-200 hover:bg-slate-50 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 lg:max-w-[360px] lg:text-lg"
            >
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code}: {item.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
          </div>
        </div>
        
        <div className="hidden h-8 w-px bg-slate-200 mx-2 md:block"></div>

        <div className="hidden items-center gap-2 md:flex">
            {canTransition && allowedTargets.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowTransitionModal(true)}
                className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-0.5 rounded text-xs font-bold border border-blue-200 transition-colors flex items-center gap-1"
                title="Click to transition project phase"
              >
                {project.phase}
                <GitMerge className="w-3 h-3 text-blue-500" />
              </button>
            ) : (
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold border border-slate-200">
                {project.phase}
              </span>
            )}
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-medium border border-slate-200">
                {project.sku}
            </span>
        </div>
        
        {/* Weight Rollup Display */}
        <div className="hidden md:flex items-center gap-2 ml-4 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full">
             <Scale className="w-4 h-4 text-slate-400" />
             <span className="text-xs font-semibold text-slate-600">
                {project.totalWeight ? `${project.totalWeight.toFixed(1)} g` : '--'}
             </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <div className="relative hidden xl:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search parts, mpn..." 
            className="pl-10 pr-4 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
        
        <button
          type="button"
          aria-label="Notifications"
          title="Notifications"
          className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </button>
        
        <div className="flex items-center gap-3 border-l border-slate-200 pl-3 sm:pl-4">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-slate-900">{currentUser.name}</div>
            <div className="text-xs text-slate-500">{roleTitles[currentUser.role]}</div>
          </div>
          <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold border border-slate-300">
            {currentUser.avatarInitials}
          </div>
        </div>
      </div>

      {/* Advance Project Phase Modal */}
      {showTransitionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="w-full max-w-md bg-white border border-slate-950 p-6 shadow-md rounded-none">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 id="modal-title" className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <GitMerge className="h-5 w-5 text-blue-600 shrink-0" />
                Advance Project Phase
              </h2>
              <button 
                onClick={() => setShowTransitionModal(false)}
                title="Close dialog"
                className="text-slate-400 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {allowedTargets.length === 0 ? (
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-100 p-3 text-xs font-bold">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>Project has reached the final production phase: <strong>{project.phase}</strong>.</span>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setShowTransitionModal(false)}
                    className="border border-slate-950 hover:bg-slate-50 px-4 py-2 text-xs font-bold"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase">Current Phase</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">{project.phase}</div>
                </div>

                <div>
                  <label htmlFor="target-phase-select" className="text-xs font-bold text-slate-400 uppercase">Target Phase</label>
                  <select
                    id="target-phase-select"
                    value={targetPhase}
                    onChange={(e) => setTargetPhase(e.target.value as any)}
                    className="mt-1 w-full bg-white border border-slate-950 px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600"
                  >
                    {allowedTargets.map((target) => (
                      <option key={target} value={target}>{target}</option>
                    ))}
                  </select>
                </div>

                {/* Checklist Section */}
                {checklistItems.length > 0 && (
                  <div className="border border-slate-200 p-3.5 bg-slate-50/50">
                    <div className="text-xs font-black text-slate-800 uppercase mb-2">Required checklist for {project.phase} → {targetPhase}</div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {checklistItems.map((item) => {
                        const isChecked = !!checkedItems[item];
                        return (
                          <label 
                            key={item}
                            className={`flex items-start gap-2.5 p-2 bg-white border transition-colors cursor-pointer select-none ${
                              isChecked ? 'border-blue-200 bg-blue-50/10' : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => setCheckedItems({ ...checkedItems, [item]: e.target.checked })}
                              className="mt-0.5 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-xs font-medium text-slate-700 leading-normal">{item}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setShowTransitionModal(false)}
                    className="border border-slate-200 hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmTransition}
                    disabled={!allChecked}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-200 text-white border border-blue-600 px-4 py-2 text-xs font-bold disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Confirm Transition
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
