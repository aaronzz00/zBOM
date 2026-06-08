import React, { useState, useEffect } from 'react';
import { Shield, GitMerge, Plus, Trash2, Save, RotateCcw, AlertTriangle, CheckCircle2, List, Settings, Database, FolderPlus, Tag, Edit, X, KeyRound, History } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBOMStore } from '../stores/useBOMStore';
import { DEFAULT_AI_SETTINGS, useAISettingsStore } from '../stores/useAISettingsStore';
import { Permission, UserRole, ProjectStageFlow, ComponentType, LifecycleState, AttributeDefinition } from '../types';
import {
  isBackendApiConfigured,
  saveBackendAIProvider,
  loadBackendAIProviderConfig,
  loadBackendWorkspaceSettings,
  saveBackendWorkspaceSettings,
  type ApiWorkspaceSettings,
} from '../services/backendApi';

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
    createProject,
    componentTypeLabels,
    lifecycleStateLabels,
    updateComponentTypeLabel,
    updateLifecycleStateLabel,
    updateWarehouseLocation,
    updateComplianceStandard,
    updateAttributeDef,
    updateProject,
    auditEvents,
    totalAuditEvents,
    loadAuditTrail
  } = useBOMStore();
  const {
    settings: aiSettings,
    updateSettings: updateAISettings,
    resetSettings: resetAISettings,
    isConfigured: isAIConfigured,
  } = useAISettingsStore();

  const [activeTab, setActiveTab] = useState<'roles' | 'flows' | 'metadata' | 'fields' | 'ai' | 'audit'>('roles');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const backendAIConfigured = isBackendApiConfigured();
  
  // Tab 2: Flows & Projects state
  const [selectedFlowId, setSelectedFlowId] = useState<string>(projectFlows[0]?.id ?? 'flow-standard');
  const [newChecklistItem, setNewChecklistItem] = useState<string>('');
  const [selectedTransitionSource, setSelectedTransitionSource] = useState<string>('EVT');
  const [newProj, setNewProj] = useState({ code: '', name: '', sku: '', flowId: 'flow-standard' });

  // Tab 3: Metadata lists state
  const [newLocation, setNewLocation] = useState('');
  const [newCompliance, setNewCompliance] = useState('');

  // Tab 4: AI provider state
  const [aiForm, setAiForm] = useState(aiSettings);

  // Tab 5: Attributes state
  const [newAttr, setNewAttr] = useState({
    name: '',
    key: '',
    type: 'text' as 'text' | 'number' | 'select' | 'date',
    optionsString: '',
    projectScope: 'all',
    typeScope: [] as ComponentType[]
  });

  // Edit configurations states
  const [editingComponentType, setEditingComponentType] = useState<ComponentType | null>(null);
  const [editingComponentTypeLabel, setEditingComponentTypeLabel] = useState<string>('');
  
  const [editingLifecycleState, setEditingLifecycleState] = useState<LifecycleState | null>(null);
  const [editingLifecycleStateLabel, setEditingLifecycleStateLabel] = useState<string>('');

  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [editingLocationValue, setEditingLocationValue] = useState<string>('');

  const [editingCompliance, setEditingCompliance] = useState<string | null>(null);
  const [editingComplianceValue, setEditingComplianceValue] = useState<string>('');

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectData, setEditingProjectData] = useState({ code: '', name: '', sku: '' });

  const [editingAttributeId, setEditingAttributeId] = useState<string | null>(null);
  const [editingAttributeData, setEditingAttributeData] = useState({
    name: '',
    key: '',
    type: 'text' as 'text' | 'number' | 'select' | 'date',
    optionsString: '',
    projectScope: 'all',
    typeScope: [] as ComponentType[]
  });

  const [editingChecklistIndex, setEditingChecklistIndex] = useState<{ phase: string, index: number } | null>(null);
  const [editingChecklistValue, setEditingChecklistValue] = useState<string>('');

  const [keyLast4, setKeyLast4] = useState<string | null>(null);

  // Tab 6: Audit Trail state
  const [auditEntityType, setAuditEntityType] = useState<string>('');
  const [auditAction, setAuditAction] = useState<string>('');
  const [auditPage, setAuditPage] = useState<number>(1);
  const auditLimit = 20;

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditTrail({
        entityType: auditEntityType || undefined,
        action: auditAction || undefined,
        limit: auditLimit,
        offset: (auditPage - 1) * auditLimit,
      });
    }
  }, [activeTab, auditEntityType, auditAction, auditPage]);

  useEffect(() => {
    if (backendAIConfigured) {
      loadBackendAIProviderConfig()
        .then((provider) => {
          if (provider) {
            setAiForm((prev) => ({
              ...prev,
              enabled: provider.enabled,
              baseUrl: provider.baseUrl,
              model: provider.model,
              temperature: provider.temperature,
              apiKey: '',
            }));
            if (provider.keyLast4) {
              setKeyLast4(provider.keyLast4);
            }
          }
        })
        .catch((err) => {
          console.error('Failed to load backend AI config:', err);
        });
    }
  }, [backendAIConfigured]);

  useEffect(() => {
    const checkAndMigrateSettings = async () => {
      if (!isBackendApiConfigured()) return;
      try {
        const dbSettings = await loadBackendWorkspaceSettings();
        const localWarehouse = localStorage.getItem('zbom.config.warehouse_locations');
        const localAttrs = localStorage.getItem('zbom.config.attribute_defs');
        const localFlows = localStorage.getItem('zbom.flows.configs');

        if (localWarehouse || localAttrs || localFlows) {
          const mergedSettings: ApiWorkspaceSettings = {
            flows: localFlows ? JSON.parse(localFlows) : (dbSettings?.flows ?? []),
            flowAssociations: localStorage.getItem('zbom.flows.associations')
              ? JSON.parse(localStorage.getItem('zbom.flows.associations')!)
              : (dbSettings?.flowAssociations ?? {}),
            componentTypes: localStorage.getItem('zbom.config.component_types')
              ? JSON.parse(localStorage.getItem('zbom.config.component_types')!)
              : (dbSettings?.componentTypes ?? []),
            lifecycleStates: localStorage.getItem('zbom.config.lifecycle_states')
              ? JSON.parse(localStorage.getItem('zbom.config.lifecycle_states')!)
              : (dbSettings?.lifecycleStates ?? []),
            warehouseLocations: localWarehouse
              ? JSON.parse(localWarehouse)
              : (dbSettings?.warehouseLocations ?? []),
            complianceStandards: localStorage.getItem('zbom.config.compliance_standards')
              ? JSON.parse(localStorage.getItem('zbom.config.compliance_standards')!)
              : (dbSettings?.complianceStandards ?? []),
            attributeDefs: localAttrs
              ? JSON.parse(localAttrs)
              : (dbSettings?.attributeDefs ?? []),
            componentTypeLabels: localStorage.getItem('zbom.config.component_type_labels')
              ? JSON.parse(localStorage.getItem('zbom.config.component_type_labels')!)
              : (dbSettings?.componentTypeLabels ?? {}),
            lifecycleStateLabels: localStorage.getItem('zbom.config.lifecycle_state_labels')
              ? JSON.parse(localStorage.getItem('zbom.config.lifecycle_state_labels')!)
              : (dbSettings?.lifecycleStateLabels ?? {}),
          };

          await saveBackendWorkspaceSettings(mergedSettings);

          localStorage.removeItem('zbom.flows.configs');
          localStorage.removeItem('zbom.flows.associations');
          localStorage.removeItem('zbom.config.component_types');
          localStorage.removeItem('zbom.config.lifecycle_states');
          localStorage.removeItem('zbom.config.warehouse_locations');
          localStorage.removeItem('zbom.config.compliance_standards');
          localStorage.removeItem('zbom.config.attribute_defs');
          localStorage.removeItem('zbom.config.component_type_labels');
          localStorage.removeItem('zbom.config.lifecycle_state_labels');

          window.location.reload();
        }
      } catch (err) {
        console.error('Failed to auto-migrate local settings:', err);
      }
    };
    checkAndMigrateSettings();
  }, []);

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleResetDefaults = () => {
    if (window.confirm('Are you sure you want to reset all configurations to system defaults?')) {
      resetRolePermissions();
      localStorage.clear();
      resetAISettings();
      showNotification('Configuration reset to system defaults successfully.');
      window.location.reload();
    }
  };

  const handleSaveAISettings = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!aiForm.baseUrl.trim() || !aiForm.model.trim()) {
      showNotification('AI provider base URL and model are required.');
      return;
    }

    try {
      if (backendAIConfigured) {
        await saveBackendAIProvider({
          enabled: aiForm.enabled,
          providerType: 'openai-compatible',
          baseUrl: aiForm.baseUrl,
          model: aiForm.model,
          temperature: aiForm.temperature,
          ...(aiForm.apiKey.trim() ? { apiKey: aiForm.apiKey } : {}),
        });
      }

      updateAISettings({
        enabled: aiForm.enabled,
        providerType: 'openai-compatible',
        baseUrl: aiForm.baseUrl,
        apiKey: backendAIConfigured ? '' : aiForm.apiKey,
        model: aiForm.model,
        temperature: aiForm.temperature,
      });
      if (backendAIConfigured) {
        setAiForm({ ...aiForm, apiKey: '' });
      }
      showNotification(backendAIConfigured ? 'AI provider settings saved to backend.' : 'AI provider settings saved.');
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'Failed to save AI provider settings.');
    }
  };

  const handleResetAISettings = async () => {
    try {
      if (backendAIConfigured) {
        await saveBackendAIProvider({
          ...DEFAULT_AI_SETTINGS,
          apiKey: undefined,
          clearApiKey: true,
        });
      }
      resetAISettings();
      setAiForm({ ...DEFAULT_AI_SETTINGS });
      showNotification('AI provider settings reset to defaults.');
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'Failed to reset AI provider settings.');
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

  const handleEditChecklistItem = (phase: string, index: number, newValue: string) => {
    if (!newValue.trim() || !selectedFlow) return;
    
    const updatedFlows = projectFlows.map((flow) => {
      if (flow.id !== selectedFlow.id) return flow;
      
      const transition = flow.transitions[phase];
      if (!transition) return flow;
      
      const nextChecklist = [...transition.checklist];
      nextChecklist[index] = newValue.trim();
      
      return {
        ...flow,
        transitions: {
          ...flow.transitions,
          [phase]: {
            ...transition,
            checklist: nextChecklist
          }
        }
      };
    });

    updateProjectFlows(updatedFlows);
    setEditingChecklistIndex(null);
    showNotification('Checklist item updated.');
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
    <div className="w-full h-full flex flex-col overflow-y-auto bg-slate-50">
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
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-t-2 transition-all ${
              activeTab === 'ai'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            AI Provider
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
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-t-2 transition-all ${
              activeTab === 'audit'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <History className="h-4 w-4" />
            Audit Trail
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
                    const isEditing = editingProjectId === proj.id;
                    
                    return (
                      <div key={proj.id} className="border border-slate-200 p-3 bg-slate-50/50">
                        {isEditing ? (
                          <div className="space-y-2 mb-3">
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase block">Program Code</label>
                              <input
                                type="text"
                                value={editingProjectData.code}
                                onChange={(e) => setEditingProjectData({ ...editingProjectData, code: e.target.value.toUpperCase() })}
                                className="w-full bg-white border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase block">Program Name</label>
                              <input
                                type="text"
                                value={editingProjectData.name}
                                onChange={(e) => setEditingProjectData({ ...editingProjectData, name: e.target.value })}
                                className="w-full bg-white border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase block">Primary SKU</label>
                              <input
                                type="text"
                                value={editingProjectData.sku}
                                onChange={(e) => setEditingProjectData({ ...editingProjectData, sku: e.target.value })}
                                className="w-full bg-white border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="flex gap-2 justify-end pt-1">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (editingProjectData.code.trim() && editingProjectData.name.trim()) {
                                    updateProject(proj.id, editingProjectData);
                                    showNotification(`Updated project details for ${editingProjectData.code}`);
                                  }
                                  setEditingProjectId(null);
                                }}
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  setEditingProjectId(null);
                                }}
                                className="text-xs font-bold text-slate-400 hover:text-slate-600"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-bold text-sm text-slate-800">{proj.code}: {proj.name}</div>
                              <div className="text-xs text-slate-500 mt-1">
                                Primary SKU: <span className="font-semibold text-slate-700">{proj.sku}</span>
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                Current stage: <span className="font-bold text-slate-700">{proj.phase}</span>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                setEditingProjectId(proj.id);
                                setEditingProjectData({ code: proj.code, name: proj.name, sku: proj.sku });
                              }}
                              className="text-slate-400 hover:text-blue-600 p-0.5"
                              title="Edit project properties"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                        
                        <div className="mt-3 border-t border-slate-200/60 pt-2">
                          <label htmlFor={`flow-select-${proj.id}`} className="text-xs font-semibold text-slate-500 uppercase block">Assigned Flow Rule</label>
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
                        (selectedFlow.transitions[selectedTransitionSource]?.checklist || []).map((item, idx) => {
                          const isEditing = editingChecklistIndex?.phase === selectedTransitionSource && editingChecklistIndex?.index === idx;
                          
                          return (
                            <div key={`${selectedTransitionSource}-item-${idx}`} className="flex items-center justify-between bg-white border border-slate-200 px-3 py-2 text-xs">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editingChecklistValue}
                                  onChange={(e) => setEditingChecklistValue(e.target.value)}
                                  className="flex-1 bg-white border border-slate-300 px-2 py-0.5 text-xs font-normal focus:outline-none focus:border-blue-500 mr-2"
                                />
                              ) : (
                                <span className="font-medium text-slate-700">{item}</span>
                              )}
                              <div className="flex items-center gap-1.5">
                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        handleEditChecklistItem(selectedTransitionSource, idx, editingChecklistValue);
                                      }}
                                      className="text-emerald-600 hover:text-emerald-700 font-bold"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setEditingChecklistIndex(null);
                                      }}
                                      className="text-slate-400 hover:text-slate-600"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setEditingChecklistIndex({ phase: selectedTransitionSource, index: idx });
                                        setEditingChecklistValue(item);
                                      }}
                                      className="text-slate-400 hover:text-blue-600 p-0.5"
                                      title="Edit requirement"
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteChecklistItem(selectedTransitionSource, idx)}
                                      title="Delete checklist requirement"
                                      className="text-slate-400 hover:text-red-500 p-0.5"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })
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
                    const isEditing = editingComponentType === type;
                    const displayLabel = componentTypeLabels[type] || type;
                    
                    return (
                      <div key={type} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => {
                              toggleComponentType(type);
                              showNotification(`Toggled Component Type: ${displayLabel}`);
                            }}
                            className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingComponentTypeLabel}
                              onChange={(e) => setEditingComponentTypeLabel(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-white border border-slate-300 px-2 py-0.5 text-xs font-normal focus:outline-none focus:border-blue-500"
                            />
                          ) : (
                            <span>{displayLabel}</span>
                          )}
                        </label>
                        <div className="flex items-center gap-1.5 ml-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (editingComponentTypeLabel.trim()) {
                                    updateComponentTypeLabel(type, editingComponentTypeLabel.trim());
                                    showNotification(`Renamed component type ${type} to ${editingComponentTypeLabel.trim()}`);
                                  }
                                  setEditingComponentType(null);
                                }}
                                className="text-emerald-600 hover:text-emerald-700 font-bold"
                              >
                                Save
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  setEditingComponentType(null);
                                }}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                setEditingComponentType(type);
                                setEditingComponentTypeLabel(displayLabel);
                              }}
                              className="text-slate-400 hover:text-blue-600"
                              title="Rename component type"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
 
              <section className="bg-white border border-slate-200 p-5 shadow-sm">
                <h2 className="text-base font-bold text-slate-900 mb-4">Active Lifecycle States</h2>
                <div className="space-y-2.5">
                  {Object.values(LifecycleState).map((state) => {
                    const isEnabled = enabledLifecycleStates.includes(state);
                    const isEditing = editingLifecycleState === state;
                    const displayLabel = lifecycleStateLabels[state] || state;
                    
                    return (
                      <div key={state} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => {
                              toggleLifecycleState(state);
                              showNotification(`Toggled Lifecycle State: ${displayLabel}`);
                            }}
                            className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingLifecycleStateLabel}
                              onChange={(e) => setEditingLifecycleStateLabel(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-white border border-slate-300 px-2 py-0.5 text-xs font-normal focus:outline-none focus:border-blue-500"
                            />
                          ) : (
                            <span>{displayLabel}</span>
                          )}
                        </label>
                        <div className="flex items-center gap-1.5 ml-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (editingLifecycleStateLabel.trim()) {
                                    updateLifecycleStateLabel(state, editingLifecycleStateLabel.trim());
                                    showNotification(`Renamed lifecycle state ${state} to ${editingLifecycleStateLabel.trim()}`);
                                  }
                                  setEditingLifecycleState(null);
                                }}
                                className="text-emerald-600 hover:text-emerald-700 font-bold"
                              >
                                Save
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  setEditingLifecycleState(null);
                                }}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                setEditingLifecycleState(state);
                                setEditingLifecycleStateLabel(displayLabel);
                              }}
                              className="text-slate-400 hover:text-blue-600"
                              title="Rename lifecycle state"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
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
                  {warehouseLocations.map((loc) => {
                    const isEditing = editingLocation === loc;
                    return (
                      <div key={loc} className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingLocationValue}
                            onChange={(e) => setEditingLocationValue(e.target.value.toUpperCase().trim())}
                            className="bg-white border border-slate-300 px-2 py-0.5 text-xs font-normal focus:outline-none focus:border-blue-500"
                          />
                        ) : (
                          <span>{loc} Zone</span>
                        )}
                        <div className="flex items-center gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (editingLocationValue && editingLocationValue !== loc) {
                                    updateWarehouseLocation(loc, editingLocationValue);
                                    showNotification(`Renamed location ${loc} to ${editingLocationValue}`);
                                  }
                                  setEditingLocation(null);
                                }}
                                className="text-emerald-600 hover:text-emerald-700 font-bold"
                              >
                                Save
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  setEditingLocation(null);
                                }}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  setEditingLocation(loc);
                                  setEditingLocationValue(loc);
                                }}
                                className="text-slate-400 hover:text-blue-600"
                                title="Rename warehouse location"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button 
                                onClick={() => {
                                  deleteWarehouseLocation(loc);
                                  showNotification(`Removed location: ${loc}`);
                                }}
                                className="text-slate-400 hover:text-red-500"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
                  {complianceStandards.map((std) => {
                    const isEditing = editingCompliance === std;
                    return (
                      <div key={std} className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingComplianceValue}
                            onChange={(e) => setEditingComplianceValue(e.target.value.toUpperCase().trim())}
                            className="bg-white border border-slate-300 px-2 py-0.5 text-xs font-normal focus:outline-none focus:border-blue-500"
                          />
                        ) : (
                          <span>{std}</span>
                        )}
                        <div className="flex items-center gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (editingComplianceValue && editingComplianceValue !== std) {
                                    updateComplianceStandard(std, editingComplianceValue);
                                    showNotification(`Renamed compliance standard ${std} to ${editingComplianceValue}`);
                                  }
                                  setEditingCompliance(null);
                                }}
                                className="text-emerald-600 hover:text-emerald-700 font-bold"
                              >
                                Save
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  setEditingCompliance(null);
                                }}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  setEditingCompliance(std);
                                  setEditingComplianceValue(std);
                                }}
                                className="text-slate-400 hover:text-blue-600"
                                title="Rename compliance standard"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button 
                                onClick={() => {
                                  deleteComplianceStandard(std);
                                  showNotification(`Removed compliance standard: ${std}`);
                                }}
                                className="text-slate-400 hover:text-red-500"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* AI Provider Tab Content */}
        {activeTab === 'ai' && (
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="lg:col-span-2 bg-white border border-slate-200 p-5 shadow-sm">
              <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">OpenAI-compatible Provider</h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    Configure the AI Assistant to call a provider that supports the OpenAI chat completions API.
                  </p>
                </div>
                <div
                  className={`shrink-0 border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                    backendAIConfigured && aiSettings.enabled
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : isAIConfigured()
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : aiSettings.enabled
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}
                >
                  {backendAIConfigured && aiSettings.enabled
                    ? 'Backend Proxy'
                    : isAIConfigured()
                      ? 'Configured'
                      : aiSettings.enabled
                        ? 'Missing Key'
                        : 'Disabled'}
                </div>
              </div>

              <form onSubmit={handleSaveAISettings} className="space-y-5">
                <label className="flex items-center justify-between gap-4 border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <div className="text-sm font-bold text-slate-800">Enable AI Assistant</div>
                    <div className="mt-0.5 text-xs text-slate-500">Allow analysis and chat actions to call the configured provider.</div>
                  </div>
                  <input
                    id="ai-enabled"
                    type="checkbox"
                    aria-label="Enable AI Assistant"
                    checked={aiForm.enabled}
                    onChange={(e) => setAiForm({ ...aiForm, enabled: e.target.checked })}
                    className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="ai-provider-type" className="text-xs font-bold uppercase text-slate-500">Provider Type</label>
                    <select
                      id="ai-provider-type"
                      value={aiForm.providerType}
                      onChange={() => setAiForm({ ...aiForm, providerType: 'openai-compatible' })}
                      className="mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="openai-compatible">OpenAI-compatible</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="ai-model" className="text-xs font-bold uppercase text-slate-500">Model</label>
                    <input
                      id="ai-model"
                      type="text"
                      value={aiForm.model}
                      onChange={(e) => setAiForm({ ...aiForm, model: e.target.value })}
                      placeholder="gpt-4o-mini"
                      className="mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="ai-base-url" className="text-xs font-bold uppercase text-slate-500">OpenAI-compatible Base URL</label>
                  <input
                    id="ai-base-url"
                    type="url"
                    value={aiForm.baseUrl}
                    onChange={(e) => setAiForm({ ...aiForm, baseUrl: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                    className="mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_160px]">
                  <div>
                    <label htmlFor="ai-api-key" className="text-xs font-bold uppercase text-slate-500">API Key</label>
                    <input
                      id="ai-api-key"
                      type="password"
                      autoComplete="off"
                      value={aiForm.apiKey}
                      onChange={(e) => setAiForm({ ...aiForm, apiKey: e.target.value })}
                      placeholder={keyLast4 ? `••••••••••••${keyLast4}` : "sk-..."}
                      className="mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="ai-temperature" className="text-xs font-bold uppercase text-slate-500">Temperature</label>
                    <input
                      id="ai-temperature"
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={aiForm.temperature}
                      onChange={(e) => setAiForm({ ...aiForm, temperature: Number(e.target.value) })}
                      className="mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={handleResetAISettings}
                    className="flex items-center gap-1.5 border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset AI Defaults
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Save AI Settings
                  </button>
                </div>
              </form>
            </section>

            <section className="bg-amber-50 border border-amber-200 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <h2 className="text-sm font-black uppercase tracking-wider">Production Note</h2>
              </div>
              <p className="text-xs leading-relaxed text-amber-900">
                API keys are not persisted in browser localStorage. When VITE_API_BASE_URL is configured, this form saves
                provider credentials to the backend encrypted store and AI calls use the server-side proxy.
              </p>
              <div className="mt-4 border-t border-amber-200 pt-4 text-xs text-amber-900">
                <div className="font-bold">Saved endpoint</div>
                <div className="mt-1 break-all font-mono">{aiSettings.baseUrl}/chat/completions</div>
                <div className="mt-3 font-bold">Saved model</div>
                <div className="mt-1 font-mono">{aiSettings.model}</div>
              </div>
            </section>
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
                    const isEditing = editingAttributeId === def.id;
                    const scopedProj = projects.find(p => p.id === def.projectIdScope);
                    
                    return (
                      <div key={def.id} className="border border-slate-200 p-4 bg-slate-50/50 flex flex-col gap-3">
                        {isEditing ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                              <span className="font-bold text-xs uppercase text-slate-500">Edit Custom Field</span>
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    if (editingAttributeData.name.trim()) {
                                      const options = editingAttributeData.type === 'select'
                                        ? editingAttributeData.optionsString.split(',').map(o => o.trim()).filter(Boolean)
                                        : undefined;
                                      
                                      updateAttributeDef(def.id, {
                                        name: editingAttributeData.name.trim(),
                                        options,
                                        projectIdScope: editingAttributeData.projectScope === 'all' ? undefined : editingAttributeData.projectScope,
                                        componentTypeScope: editingAttributeData.typeScope.length === 0 ? undefined : editingAttributeData.typeScope
                                      });
                                      showNotification(`Updated custom attribute: ${editingAttributeData.name}`);
                                    }
                                    setEditingAttributeId(null);
                                  }}
                                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setEditingAttributeId(null);
                                  }}
                                  className="text-xs font-bold text-slate-400 hover:text-slate-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                            
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase block">Field Label</label>
                              <input
                                type="text"
                                value={editingAttributeData.name}
                                onChange={(e) => setEditingAttributeData({ ...editingAttributeData, name: e.target.value })}
                                className="w-full bg-white border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            
                            {def.type === 'select' && (
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block">Dropdown Options</label>
                                <input
                                  type="text"
                                  value={editingAttributeData.optionsString}
                                  onChange={(e) => setEditingAttributeData({ ...editingAttributeData, optionsString: e.target.value })}
                                  className="w-full bg-white border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                                />
                                <span className="text-[9px] text-slate-400 mt-0.5 block">Comma-separated values</span>
                              </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-3 pt-1">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block">Project Scope</label>
                                <select
                                  value={editingAttributeData.projectScope}
                                  onChange={(e) => setEditingAttributeData({ ...editingAttributeData, projectScope: e.target.value })}
                                  className="w-full bg-white border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                                >
                                  <option value="all">All Projects</option>
                                  {projects.map((p) => (
                                    <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Component Type Scope</span>
                                <div className="space-y-1">
                                  {Object.values(ComponentType).map((type) => {
                                    const isChecked = editingAttributeData.typeScope.includes(type);
                                    return (
                                      <label key={type} className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => {
                                            const updated = isChecked
                                              ? editingAttributeData.typeScope.filter(t => t !== type)
                                              : [...editingAttributeData.typeScope, type];
                                            setEditingAttributeData({ ...editingAttributeData, typeScope: updated });
                                          }}
                                          className="h-3 w-3 border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        {type}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-start">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-800">{def.name}</span>
                                <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-slate-300">
                                  {def.type}
                                </span>
                              </div>
                              <div className="font-mono text-xs text-slate-500">Key: {def.key}</div>
                              
                              {def.options && def.options.length > 0 && (
                                <div className="text-xs text-slate-500 mt-1">
                                  Options: <span className="font-mono font-medium">{def.options.join(', ')}</span>
                                </div>
                              )}

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
                            
                            <div className="flex items-center gap-1 ml-2">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  setEditingAttributeId(def.id);
                                  setEditingAttributeData({
                                    name: def.name,
                                    key: def.key,
                                    type: def.type,
                                    optionsString: def.options ? def.options.join(', ') : '',
                                    projectScope: def.projectIdScope || 'all',
                                    typeScope: def.componentTypeScope || []
                                  });
                                }}
                                className="text-slate-400 hover:text-blue-600 p-1"
                                title="Edit attribute"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
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
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        )}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <History className="h-5 w-5 text-slate-500" />
                    Workspace Audit Trail
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Query, filter and review audit event history and electronic signatures in this workspace.
                  </p>
                </div>
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600">Entity Type</label>
                    <select
                      value={auditEntityType}
                      onChange={(e) => {
                        setAuditEntityType(e.target.value);
                        setAuditPage(1);
                      }}
                      className="text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">All Entities</option>
                      <option value="project">Project</option>
                      <option value="part">Part</option>
                      <option value="bom">BOM</option>
                      <option value="bom-node">BOM Node</option>
                      <option value="tooling-record">Tooling Record</option>
                      <option value="supplier">Supplier</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600">Action</label>
                    <select
                      value={auditAction}
                      onChange={(e) => {
                        setAuditAction(e.target.value);
                        setAuditPage(1);
                      }}
                      className="text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">All Actions</option>
                      <option value="create">Create</option>
                      <option value="update">Update</option>
                      <option value="delete">Delete</option>
                      <option value="transition-phase">Transition Phase</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 justify-end pt-5">
                    <button
                      onClick={() => {
                        setAuditEntityType('');
                        setAuditAction('');
                        setAuditPage(1);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-bold px-2 py-1"
                    >
                      Reset Filters
                    </button>
                  </div>
                </div>
              </div>

              {/* Event List/Table */}
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider">
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Actor</th>
                      <th className="px-4 py-3">Entity Type</th>
                      <th className="px-4 py-3">Entity ID</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Details / Signatures</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditEvents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-medium">
                          No audit events found matching filters.
                        </td>
                      </tr>
                    ) : (
                      auditEvents.map((event) => {
                        let parsedAfter: any = null;
                        try {
                          if (event.afterJson) {
                            parsedAfter = JSON.parse(event.afterJson);
                          }
                        } catch (e) {}
                        
                        let badgeColor = 'bg-slate-50 text-slate-600 border-slate-200';
                        if (event.action === 'create') badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                        else if (event.action === 'delete') badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                        else if (event.action === 'update') badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                        else if (event.action === 'transition-phase') badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';

                        return (
                          <tr key={event.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-500 whitespace-nowrap">
                              {new Date(event.createdAt).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap">
                              {event.actorName}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-xs">
                                {event.entityType}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-500 truncate max-w-[150px]" title={event.entityId}>
                              {event.entityId}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-block px-2.5 py-0.5 border text-xs font-bold rounded-full ${badgeColor}`}>
                                {event.action}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {event.action === 'transition-phase' && parsedAfter?.signatures ? (
                                <div className="space-y-1">
                                  <div className="font-bold text-xs text-slate-700">
                                    Transitioned Phase to <span className="text-amber-800 font-extrabold">{parsedAfter.phase}</span>
                                  </div>
                                  <div className="pl-2 border-l-2 border-amber-200 space-y-0.5 text-xs text-slate-500">
                                    {parsedAfter.signatures.map((sig: any, idx: number) => (
                                      <div key={idx} className="flex flex-wrap gap-x-2">
                                        <span className="font-bold text-slate-600">• {sig.item}:</span>
                                        <span>Signed by {sig.role || sig.userRole || 'Unknown'} ({sig.actor || sig.actorName || 'System'})</span>
                                        <span className="text-slate-400">{new Date(sig.timestamp).toLocaleTimeString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-slate-600 break-words font-medium">
                                  {event.action === 'create' && `Created new ${event.entityType}`}
                                  {event.action === 'update' && `Updated ${event.entityType}`}
                                  {event.action === 'delete' && `Deleted ${event.entityType}`}
                                  {!['create', 'update', 'delete', 'transition-phase'].includes(event.action) && event.action}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              {totalAuditEvents > auditLimit && (
                <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-4 text-xs font-bold text-slate-500">
                  <div>
                    Showing {((auditPage - 1) * auditLimit) + 1} to {Math.min(auditPage * auditLimit, totalAuditEvents)} of {totalAuditEvents} events
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={auditPage === 1}
                      onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1.5 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                    >
                      Previous
                    </button>
                    <button
                      disabled={auditPage * auditLimit >= totalAuditEvents}
                      onClick={() => setAuditPage(p => p + 1)}
                      className="px-3 py-1.5 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
