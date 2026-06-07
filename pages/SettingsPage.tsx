import React, { useState } from 'react';
import { Shield, GitMerge, Plus, Trash2, Save, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBOMStore } from '../stores/useBOMStore';
import { Permission, UserRole, ProjectStageFlow } from '../types';

export const SettingsPage: React.FC = () => {
  const { rolePermissions, updateRolePermissions, resetRolePermissions } = useAuth();
  const { projects, projectFlows, projectFlowAssociations, setProjectFlowAssociation, updateProjectFlows } = useBOMStore();

  const [activeTab, setActiveTab] = useState<'roles' | 'flows'>('roles');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Local state for editing flow checklists
  const [selectedFlowId, setSelectedFlowId] = useState<string>(projectFlows[0]?.id ?? 'flow-standard');
  const [newChecklistItem, setNewChecklistItem] = useState<string>('');
  const [selectedTransitionSource, setSelectedTransitionSource] = useState<string>('EVT');

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleResetDefaults = () => {
    if (window.confirm('Are you sure you want to reset all role permissions to system defaults?')) {
      resetRolePermissions();
      showNotification('Permissions reset to system defaults successfully.');
    }
  };

  // Group permissions for better readability
  const permissionGroups = {
    'Navigation & Visibility': [
      Permission.VIEW_DASHBOARD,
      Permission.VIEW_BOM,
      Permission.VIEW_SUPPLY_CHAIN,
      Permission.VIEW_ECO,
      Permission.VIEW_DEMO_ROLE_SWITCHER,
    ],
    'Data Access Control': [
      Permission.VIEW_COST,
      Permission.VIEW_SUPPLIER_RISK,
      Permission.VIEW_COMMERCIAL_FIELDS,
    ],
    'Engineering Actions': [
      Permission.EDIT_BOM_STRUCTURE,
      Permission.EDIT_BOM_METADATA,
      Permission.EDIT_EBOM_ARCHITECTURE,
      Permission.CREATE_ECO,
      Permission.APPROVE_CHANGE,
      Permission.MANAGE_ATTRIBUTES,
    ],
    'Operations & Sourcing': [
      Permission.EDIT_COST,
      Permission.EDIT_COMMERCIAL_FIELDS,
      Permission.MANAGE_AVL,
      Permission.MANAGE_SKU_LIFECYCLE,
      Permission.MANAGE_TOOLING,
      Permission.TRANSITION_PROJECT_PHASE,
    ],
  };

  const roles: UserRole[] = ['ADMIN', 'ENG_LEAD', 'SOURCING', 'VIEWER'];
  const roleLabels: Record<UserRole, string> = {
    ADMIN: 'Admin',
    ENG_LEAD: 'Engineer',
    SOURCING: 'Sourcing',
    VIEWER: 'Viewer',
  };

  const selectedFlow = projectFlows.find((f) => f.id === selectedFlowId) ?? projectFlows[0];

  const handleAddChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistItem.trim() || !selectedFlow) return;

    const updatedFlows = projectFlows.map((flow) => {
      if (flow.id !== selectedFlow.id) return flow;
      
      const transition = flow.transitions[selectedTransitionSource] || { targetStages: [], checklist: [] };
      return {
        ...flow,
        transitions: {
          ...flow.transitions,
          [selectedTransitionSource]: {
            ...transition,
            checklist: [...transition.checklist, newChecklistItem.trim()]
          }
        }
      };
    });

    updateProjectFlows(updatedFlows);
    setNewChecklistItem('');
    showNotification(`Added checklist item to ${selectedTransitionSource} transition.`);
  };

  const handleDeleteChecklistItem = (phase: string, index: number) => {
    if (!selectedFlow) return;
    
    const updatedFlows = projectFlows.map((flow) => {
      if (flow.id !== selectedFlow.id) return flow;
      
      const transition = flow.transitions[phase];
      if (!transition) return flow;
      
      return {
        ...flow,
        transitions: {
          ...flow.transitions,
          [phase]: {
            ...transition,
            checklist: transition.checklist.filter((_, idx) => idx !== index)
          }
        }
      };
    });

    updateProjectFlows(updatedFlows);
    showNotification('Checklist item removed.');
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        {/* Header Section */}
        <section className="rounded-none border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600">
            <Shield className="h-4 w-4" />
            Admin Console
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Settings</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Role access and application preferences are collected here as a deterministic setup surface for frontend testing.
          </p>
        </section>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 bg-white p-1">
          <button
            onClick={() => setActiveTab('roles')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-t-2 transition-all ${
              activeTab === 'roles'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Shield className="h-4 w-4" />
            Role Access Matrix
          </button>
          <button
            onClick={() => setActiveTab('flows')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-t-2 transition-all ${
              activeTab === 'flows'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <GitMerge className="h-4 w-4" />
            Project Phase Flows & Checklists
          </button>
        </div>

        {/* Success Alert Banner */}
        {successMessage && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 p-3 text-sm font-bold text-emerald-800 animate-fadeIn rounded-none">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            {successMessage}
          </div>
        )}

        {/* Roles Tab Content */}
        {activeTab === 'roles' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-white border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                <span>
                  <strong>ADMIN Safety Lock Active:</strong> Admin privileges are locked to prevent accidental lockouts.
                </span>
              </div>
              <button
                onClick={handleResetDefaults}
                className="flex items-center gap-1.5 border border-slate-200 hover:bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Defaults
              </button>
            </div>

            <div className="border border-slate-200 bg-white shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-900 text-xs font-bold uppercase tracking-wider text-white">
                  <tr>
                    <th className="px-4 py-3">Module Permissions</th>
                    {roles.map((role) => (
                      <th key={role} className="px-4 py-3 text-center border-l border-slate-800">
                        {roleLabels[role]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {Object.entries(permissionGroups).map(([groupName, permissions]) => (
                    <React.Fragment key={groupName}>
                      <tr className="bg-slate-100 font-black text-xs text-slate-700 tracking-wider uppercase">
                        <td colSpan={roles.length + 1} className="px-4 py-2 bg-slate-100 border-y border-slate-200">
                          {groupName}
                        </td>
                      </tr>
                      {permissions.map((perm) => (
                        <tr key={perm} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            {perm.replace(/_/g, ' ')}
                          </td>
                          {roles.map((role) => {
                            const isChecked = (rolePermissions[role] || []).includes(perm);
                            const isAdmin = role === 'ADMIN';
                            
                            return (
                              <td key={`${role}-${perm}`} className="px-4 py-3 text-center border-l border-slate-100">
                                <input
                                  type="checkbox"
                                  disabled={isAdmin}
                                  checked={isAdmin ? true : isChecked}
                                  onChange={(e) => {
                                    const rolePerms = rolePermissions[role] || [];
                                    const nextPerms = e.target.checked
                                      ? [...rolePerms, perm]
                                      : rolePerms.filter((p) => p !== perm);
                                    updateRolePermissions(role, nextPerms);
                                    showNotification(`Updated permissions for ${roleLabels[role]}.`);
                                  }}
                                  className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Project Flows Tab Content */}
        {activeTab === 'flows' && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column: Project Associations */}
            <div className="lg:col-span-1 space-y-6">
              <section className="bg-white border border-slate-200 p-5 shadow-sm">
                <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <GitMerge className="h-4 w-4 text-blue-600" />
                  Project Associations
                </h2>
                <div className="space-y-4">
                  {projects.map((proj) => {
                    const currentAssocId = projectFlowAssociations[proj.id] ?? 'flow-standard';
                    
                    return (
                      <div key={proj.id} className="border border-slate-200 p-3 bg-slate-50/50">
                        <div className="font-bold text-sm text-slate-800">{proj.code}: {proj.name}</div>
                        <div className="text-xs text-slate-500 mt-1">Current stage: <span className="font-bold text-slate-700">{proj.phase}</span></div>
                        
                        <div className="mt-3">
                          <label htmlFor={`flow-select-${proj.id}`} className="text-xs font-semibold text-slate-500 uppercase">Assigned Flow Rule</label>
                          <select
                            id={`flow-select-${proj.id}`}
                            value={currentAssocId}
                            onChange={(e) => {
                              setProjectFlowAssociation(proj.id, e.target.value);
                              showNotification(`Updated flow association for project ${proj.code}.`);
                            }}
                            className="mt-1 w-full bg-white border border-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                          >
                            {projectFlows.map((flow) => (
                              <option key={flow.id} value={flow.id}>
                                {flow.name} ({flow.stages.join(' → ')})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Right Column: Flow Rule Checklist Editor */}
            <div className="lg:col-span-2 space-y-6">
              {selectedFlow && (
                <section className="bg-white border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Configure Flow Checklist</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Customize phase sequences and checklist items for dynamic validation</p>
                    </div>
                    <select
                      aria-label="Select stage flow to configure"
                      value={selectedFlowId}
                      onChange={(e) => {
                        setSelectedFlowId(e.target.value);
                        // Default selected source phase to first in newly selected flow
                        const flow = projectFlows.find((f) => f.id === e.target.value);
                        if (flow && flow.stages.length > 0) {
                          setSelectedTransitionSource(flow.stages[0]);
                        }
                      }}
                      className="bg-slate-50 border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 focus:outline-none"
                    >
                      {projectFlows.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Flow Stages Visual Representation */}
                  <div className="mb-6">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Stage Progression Path</div>
                    <div className="flex items-center gap-2 overflow-x-auto py-2">
                      {selectedFlow.stages.map((stage, idx) => (
                        <React.Fragment key={stage}>
                          <button
                            onClick={() => setSelectedTransitionSource(stage)}
                            className={`px-3 py-1.5 text-xs font-bold border transition-colors ${
                              selectedTransitionSource === stage
                                ? 'bg-blue-600 text-white border-blue-600 shadow'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            }`}
                          >
                            {stage}
                          </button>
                          {idx < selectedFlow.stages.length - 1 && (
                            <span className="text-slate-400 text-sm font-bold">→</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* Checklist Configuration for the selected stage transition */}
                  <div className="border border-slate-200 p-4 bg-slate-50/50">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 uppercase">
                          Transition checklist: {selectedTransitionSource}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          List items required to be checked off before moving out of this phase.
                        </p>
                      </div>
                    </div>

                    {/* Add checklist item form */}
                    <form onSubmit={handleAddChecklistItem} className="flex gap-2 mb-4">
                      <input
                        type="text"
                        placeholder="Add new checklist requirement..."
                        value={newChecklistItem}
                        onChange={(e) => setNewChecklistItem(e.target.value)}
                        className="flex-1 bg-white border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="submit"
                        className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 text-xs font-bold flex items-center gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </button>
                    </form>

                    {/* Current checklist items list */}
                    <div className="space-y-2">
                      {((selectedFlow.transitions[selectedTransitionSource]?.checklist) || []).length === 0 ? (
                        <div className="text-xs text-slate-400 italic py-4 text-center">
                          No checklist requirements defined. This transition will be immediate.
                        </div>
                      ) : (
                        (selectedFlow.transitions[selectedTransitionSource]?.checklist || []).map((item, idx) => (
                          <div key={`${selectedTransitionSource}-item-${idx}`} className="flex items-center justify-between bg-white border border-slate-200 px-3 py-2 text-xs">
                            <span className="font-medium text-slate-700">{item}</span>
                            <button
                              onClick={() => handleDeleteChecklistItem(selectedTransitionSource, idx)}
                              title="Delete checklist requirement"
                              className="text-slate-400 hover:text-red-500 p-0.5"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
