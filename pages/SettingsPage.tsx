import React, { useState } from 'react';
import { Shield, GitMerge, Plus, Trash2, Save, RotateCcw, AlertTriangle, CheckCircle2, List, Settings, Database, FolderPlus, Tag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBOMStore } from '../stores/useBOMStore';
import { Permission, UserRole, ProjectStageFlow, ComponentType, LifecycleState, AttributeDefinition } from '../types';

export const SettingsPage: React.FC = () => {
  const { rolePermissions, updateRolePermissions, resetRolePermissions } = useAuth();
  const { 
    projects, 
    projectFlows, 
    projectFlowAssociations, 
    setProjectFlowAssociation, 
    updateProjectFlows,
    enabledComponentTypes,
    enabledLifecycleStates,
    warehouseLocations,
    complianceStandards,
    attributeDefs,
    toggleComponentType,
    toggleLifecycleState,
    addWarehouseLocation,
    deleteWarehouseLocation,
    addComplianceStandard,
    deleteComplianceStandard,
    addAttributeDef,
    deleteAttributeDef,
    createProject
  } = useBOMStore();

  const [activeTab, setActiveTab] = useState<'roles' | 'flows' | 'metadata' | 'fields'>('roles');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Tab 2: Flows & Projects state
  const [selectedFlowId, setSelectedFlowId] = useState<string>(projectFlows[0]?.id ?? 'flow-standard');
  const [newChecklistItem, setNewChecklistItem] = useState<string>('');
  const [selectedTransitionSource, setSelectedTransitionSource] = useState<string>('EVT');
  const [newProj, setNewProj] = useState({ code: '', name: '', sku: '', flowId: 'flow-standard' });

  // Tab 3: Metadata lists state
  const [newLocation, setNewLocation] = useState('');
  const [newCompliance, setNewCompliance] = useState('');

  // Tab 4: Attributes state
  const [newAttr, setNewAttr] = useState({
    name: '',
    key: '',
    type: 'text' as 'text' | 'number' | 'select' | 'date',
    optionsString: '',
    projectScope: 'all',
    typeScope: [] as ComponentType[]
  });

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleResetDefaults = () => {
    if (window.confirm('Are you sure you want to reset all configurations to system defaults?')) {
      resetRolePermissions();
      localStorage.clear();
      showNotification('Configuration reset to system defaults successfully.');
      window.location.reload();
    }
  };

  // Group permissions for Access Matrix
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

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProj.code.trim() || !newProj.name.trim() || !newProj.sku.trim()) return;
    try {
      createProject({
        code: newProj.code.toUpperCase().trim(),
        name: newProj.name.trim(),
        sku: newProj.sku.trim(),
        flowId: newProj.flowId
      });
      showNotification(`Successfully registered and seeded project program: ${newProj.code}`);
      setNewProj({ code: '', name: '', sku: '', flowId: 'flow-standard' });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create project.');
    }
  };

  const handleAddAttribute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAttr.name.trim() || !newAttr.key.trim()) return;

    const options = newAttr.type === 'select'
      ? newAttr.optionsString.split(',').map((o) => o.trim()).filter(Boolean)
      : undefined;

    const def: AttributeDefinition = {
      id: `attr-${Date.now()}`,
      name: newAttr.name.trim(),
      key: newAttr.key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      type: newAttr.type,
      options,
      projectIdScope: newAttr.projectScope === 'all' ? undefined : newAttr.projectScope,
      componentTypeScope: newAttr.typeScope.length === 0 ? undefined : newAttr.typeScope
    };

    addAttributeDef(def);
    setNewAttr({
      name: '',
      key: '',
      type: 'text',
      optionsString: '',
      projectScope: 'all',
      typeScope: []
    });
    showNotification(`Added custom column attribute: ${def.name}`);
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        {/* Header Section */}
        <section className="rounded-none border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600">
            <Settings className="h-4 w-4" />
            Admin Console
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Settings</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Role access and application preferences are collected here as a deterministic setup surface for frontend testing.
          </p>
        </section>

        {/* Tab Controls */}
        <div className="flex flex-wrap border-b border-slate-200 bg-white p-1">
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
          <button
            onClick={() => setActiveTab('metadata')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-t-2 transition-all ${
              activeTab === 'metadata'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Tag className="h-4 w-4" />
            Global Lists & Toggles
          </button>
          <button
            onClick={() => setActiveTab('fields')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-t-2 transition-all ${
              activeTab === 'fields'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Database className="h-4 w-4" />
            Custom Fields (Attributes)
          </button>
        </div>

        {/* Success Alert Banner */}
        {successMessage && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 p-3 text-sm font-bold text-emerald-800 rounded-none">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            {successMessage}
          </div>
        )}

        {/* Access Matrix Tab Content */}
        {activeTab === 'roles' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-white border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                <span>
                  <strong>ADMIN Safety Lock Active:</strong> Admin privileges are locked to prevent lockouts.
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

        {/* Project & Flows Tab Content */}
        {activeTab === 'flows' && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column: Project Associations & Portal */}
            <div className="lg:col-span-1 space-y-6">
              {/* Project Portal Setup */}
              <section className="bg-white border border-slate-200 p-5 shadow-sm">
                <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <FolderPlus className="h-4 w-4 text-blue-600" />
                  Register New Project
                </h2>
                <form onSubmit={handleCreateProject} className="space-y-3">
                  <div>
                    <label htmlFor="new-proj-code" className="text-xs font-bold text-slate-500 uppercase">Program Code</label>
                    <input
                      id="new-proj-code"
                      type="text"
                      placeholder="e.g. ZP27"
                      required
                      value={newProj.code}
                      onChange={(e) => setNewProj({ ...newProj, code: e.target.value })}
                      className="mt-1 w-full bg-white border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="new-proj-name" className="text-xs font-bold text-slate-500 uppercase">Program Name</label>
                    <input
                      id="new-proj-name"
                      type="text"
                      placeholder="e.g. zPhone 2027 Pro"
                      required
                      value={newProj.name}
                      onChange={(e) => setNewProj({ ...newProj, name: e.target.value })}
                      className="mt-1 w-full bg-white border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="new-proj-sku" className="text-xs font-bold text-slate-500 uppercase">Primary Config SKU</label>
                    <input
                      id="new-proj-sku"
                      type="text"
                      placeholder="e.g. US-Pro-Retail"
                      required
                      value={newProj.sku}
                      onChange={(e) => setNewProj({ ...newProj, sku: e.target.value })}
                      className="mt-1 w-full bg-white border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="new-proj-flow" className="text-xs font-bold text-slate-500 uppercase">Assigned Phase Flow</label>
                    <select
                      id="new-proj-flow"
                      value={newProj.flowId}
                      onChange={(e) => setNewProj({ ...newProj, flowId: e.target.value })}
                      className="mt-1 w-full bg-white border border-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    >
                      {projectFlows.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    Create Project Program
                  </button>
                </form>
              </section>

              {/* Current Associations */}
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

        {/* Global Lists & Toggles Tab Content */}
        {activeTab === 'metadata' && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Component Types and Lifecycles */}
            <div className="space-y-6">
              <section className="bg-white border border-slate-200 p-5 shadow-sm">
                <h2 className="text-base font-bold text-slate-900 mb-4">Active Component Types</h2>
                <div className="space-y-2.5">
                  {Object.values(ComponentType).map((type) => {
                    const isEnabled = enabledComponentTypes.includes(type);
                    return (
                      <label key={type} className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 cursor-pointer text-xs font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => {
                            toggleComponentType(type);
                            showNotification(`Toggled Component Type: ${type}`);
                          }}
                          className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        {type}
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="bg-white border border-slate-200 p-5 shadow-sm">
                <h2 className="text-base font-bold text-slate-900 mb-4">Active Lifecycle States</h2>
                <div className="space-y-2.5">
                  {Object.values(LifecycleState).map((state) => {
                    const isEnabled = enabledLifecycleStates.includes(state);
                    return (
                      <label key={state} className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 cursor-pointer text-xs font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => {
                            toggleLifecycleState(state);
                            showNotification(`Toggled Lifecycle State: ${state}`);
                          }}
                          className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        {state}
                      </label>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Warehouse locations and compliance standards */}
            <div className="space-y-6">
              <section className="bg-white border border-slate-200 p-5 shadow-sm">
                <h2 className="text-base font-bold text-slate-900 mb-4">Warehouse Locations</h2>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newLocation.trim()) return;
                    addWarehouseLocation(newLocation.toUpperCase().trim());
                    setNewLocation('');
                    showNotification('Added warehouse location.');
                  }}
                  className="flex gap-2 mb-4"
                >
                  <input
                    type="text"
                    placeholder="e.g. WH-D"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="flex-1 bg-white border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  />
                  <button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 text-xs font-bold flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </form>
                <div className="space-y-2">
                  {warehouseLocations.map((loc) => (
                    <div key={loc} className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                      <span>{loc} Zone</span>
                      <button 
                        onClick={() => {
                          deleteWarehouseLocation(loc);
                          showNotification(`Removed location: ${loc}`);
                        }}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white border border-slate-200 p-5 shadow-sm">
                <h2 className="text-base font-bold text-slate-900 mb-4">Compliance Standards</h2>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newCompliance.trim()) return;
                    addComplianceStandard(newCompliance.toUpperCase().trim());
                    setNewCompliance('');
                    showNotification('Added compliance standard.');
                  }}
                  className="flex gap-2 mb-4"
                >
                  <input
                    type="text"
                    placeholder="e.g. CE"
                    value={newCompliance}
                    onChange={(e) => setNewCompliance(e.target.value)}
                    className="flex-1 bg-white border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  />
                  <button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 text-xs font-bold flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </form>
                <div className="space-y-2">
                  {complianceStandards.map((std) => (
                    <div key={std} className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                      <span>{std}</span>
                      <button 
                        onClick={() => {
                          deleteComplianceStandard(std);
                          showNotification(`Removed compliance standard: ${std}`);
                        }}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Custom Fields Tab Content */}
        {activeTab === 'fields' && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left: Add custom attribute definition */}
            <div className="lg:col-span-1">
              <section className="bg-white border border-slate-200 p-5 shadow-sm">
                <h2 className="text-base font-bold text-slate-900 mb-4">Create Custom Field</h2>
                <form onSubmit={handleAddAttribute} className="space-y-4">
                  <div>
                    <label htmlFor="attr-name" className="text-xs font-bold text-slate-500 uppercase">Field Label</label>
                    <input
                      id="attr-name"
                      type="text"
                      placeholder="e.g. Finish Color"
                      required
                      value={newAttr.name}
                      onChange={(e) => setNewAttr({ ...newAttr, name: e.target.value, key: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_') })}
                      className="mt-1 w-full bg-white border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="attr-key" className="text-xs font-bold text-slate-500 uppercase">Internal Key</label>
                    <input
                      id="attr-key"
                      type="text"
                      placeholder="e.g. finish_color"
                      required
                      value={newAttr.key}
                      onChange={(e) => setNewAttr({ ...newAttr, key: e.target.value })}
                      className="mt-1 w-full bg-white border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="attr-type" className="text-xs font-bold text-slate-500 uppercase">Data Type</label>
                    <select
                      id="attr-type"
                      value={newAttr.type}
                      onChange={(e) => setNewAttr({ ...newAttr, type: e.target.value as any })}
                      className="mt-1 w-full bg-white border border-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    >
                      <option value="text">Text / String</option>
                      <option value="number">Numeric</option>
                      <option value="select">Dropdown / Selection</option>
                      <option value="date">Date</option>
                    </select>
                  </div>

                  {newAttr.type === 'select' && (
                    <div>
                      <label htmlFor="attr-options" className="text-xs font-bold text-slate-500 uppercase">Dropdown Options</label>
                      <input
                        id="attr-options"
                        type="text"
                        placeholder="Option A, Option B, Option C"
                        required
                        value={newAttr.optionsString}
                        onChange={(e) => setNewAttr({ ...newAttr, optionsString: e.target.value })}
                        className="mt-1 w-full bg-white border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">Comma-separated values</span>
                    </div>
                  )}

                  {/* Attribute Scoping */}
                  <div className="border-t border-slate-100 pt-3">
                    <div className="text-xs font-black text-slate-800 uppercase mb-2">Configure Scoping</div>
                    
                    {/* Project Scope */}
                    <div className="mb-3">
                      <label htmlFor="attr-scope-project" className="text-[11px] font-bold text-slate-500 uppercase">Project Scope</label>
                      <select
                        id="attr-scope-project"
                        value={newAttr.projectScope}
                        onChange={(e) => setNewAttr({ ...newAttr, projectScope: e.target.value })}
                        className="mt-1 w-full bg-white border border-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                      >
                        <option value="all">All Projects</option>
                        {projects.map((proj) => (
                          <option key={proj.id} value={proj.id}>{proj.code}: {proj.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Component Type Scope */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Component Type Scope</span>
                      <div className="space-y-1">
                        {Object.values(ComponentType).map((type) => {
                          const isChecked = newAttr.typeScope.includes(type);
                          return (
                            <label key={type} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  const updated = isChecked
                                    ? newAttr.typeScope.filter((t) => t !== type)
                                    : [...newAttr.typeScope, type];
                                  setNewAttr({ ...newAttr, typeScope: updated });
                                }}
                                className="h-3.5 w-3.5 border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              {type}
                            </label>
                          );
                        })}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block">Leave empty for global scope</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2 text-xs font-bold flex items-center justify-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Add Custom Attribute
                  </button>
                </form>
              </section>
            </div>

            {/* Right: List custom attribute definitions */}
            <div className="lg:col-span-2">
              <section className="bg-white border border-slate-200 p-5 shadow-sm">
                <h2 className="text-base font-bold text-slate-900 mb-4">Configured Custom Attributes</h2>
                <div className="space-y-3">
                  {attributeDefs.map((def) => {
                    const scopedProj = projects.find(p => p.id === def.projectIdScope);
                    
                    return (
                      <div key={def.id} className="border border-slate-200 p-4 bg-slate-50/50 flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-800">{def.name}</span>
                            <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-slate-300">
                              {def.type}
                            </span>
                          </div>
                          <div className="font-mono text-xs text-slate-500">Key: {def.key}</div>
                          
                          {/* Options if select */}
                          {def.options && def.options.length > 0 && (
                            <div className="text-xs text-slate-500 mt-1">
                              Options: <span className="font-mono font-medium">{def.options.join(', ')}</span>
                            </div>
                          )}

                          {/* Render scopes */}
                          {(def.projectIdScope || def.componentTypeScope) && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {scopedProj && (
                                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 border border-blue-200 text-[9px] font-bold uppercase">
                                  Scope: {scopedProj.code}
                                </span>
                              )}
                              {def.componentTypeScope && def.componentTypeScope.map((type) => (
                                <span key={type} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 border border-indigo-200 text-[9px] font-bold uppercase">
                                  Type: {type}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            deleteAttributeDef(def.id);
                            showNotification(`Removed attribute: ${def.name}`);
                          }}
                          className="text-slate-400 hover:text-red-500 p-1"
                          title="Delete attribute"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
