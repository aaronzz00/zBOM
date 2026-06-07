import { create } from 'zustand';
import { BOMNode, Project, LibraryPart, ComponentType, Supplier, BOMSnapshot, AttributeDefinition, Attachment, ProjectStageFlow, LifecycleState, ECO, ECOImpact } from '../types';
import { mockProject, previousBOM } from '../data/mockBOM';
import { FormulaEngine } from '../services/FormulaEngine';
import { coreRepository, toLegacyLibraryParts } from '../repositories/core/coreRepository';
import { useAuthStore } from './useAuthStore';
import type { CoreBOMNode, CoreBOMSnapshot, CoreProject } from '../domain/coreTypes';

interface BOMState {
    project: Project;
    projects: Project[];
    bomData: BOMNode;
    libraryParts: LibraryPart[];
    suppliers: Supplier[];
    snapshots: BOMSnapshot[];
    attributeDefs: AttributeDefinition[];
    projectFlows: ProjectStageFlow[];
    projectFlowAssociations: Record<string, string>;
    enabledComponentTypes: ComponentType[];
    enabledLifecycleStates: LifecycleState[];
    warehouseLocations: string[];
    complianceStandards: string[];
    componentTypeLabels: Record<ComponentType, string>;
    lifecycleStateLabels: Record<LifecycleState, string>;
    ecos: ECO[];
    isSandboxMode: boolean;
    sandboxBOMData: BOMNode | null;
    sandboxECOId: string | null;

    // Actions
    setActiveProject: (projectId: string) => void;
    updateBOMNode: (nodeId: string, updates: Partial<BOMNode>) => void;
    addBOMNode: (parentId: string, newNode: BOMNode) => void;
    deleteBOMNode: (nodeId: string) => void;
    setBOMData: (data: BOMNode) => void;
    updateLibraryPart: (partId: string, updates: Partial<LibraryPart>) => void;
    addLibraryPart: (part: LibraryPart) => void;
    createSnapshot: (name: string) => void;
    loadSnapshot: (snapshotId: string) => void;
    addAttributeDef: (def: AttributeDefinition) => void;
    deleteAttributeDef: (id: string) => void;
    updateAttributeDef: (id: string, updates: Partial<AttributeDefinition>) => void;
    addAttachment: (nodeId: string, file: File) => void;
    deleteAttachment: (nodeId: string, attachmentId: string) => void;
    updateProjectPhase: (projectId: string, newPhase: 'EVT' | 'DVT' | 'PVT' | 'MP', signatures?: any) => void;
    updateProjectFlows: (flows: ProjectStageFlow[]) => void;
    setProjectFlowAssociation: (projectId: string, flowId: string) => void;
    toggleComponentType: (type: ComponentType) => void;
    toggleLifecycleState: (state: LifecycleState) => void;
    updateComponentTypeLabel: (type: ComponentType, label: string) => void;
    updateLifecycleStateLabel: (state: LifecycleState, label: string) => void;
    addWarehouseLocation: (location: string) => void;
    deleteWarehouseLocation: (location: string) => void;
    updateWarehouseLocation: (oldLoc: string, newLoc: string) => void;
    addComplianceStandard: (standard: string) => void;
    deleteComplianceStandard: (standard: string) => void;
    createProject: (input: { code: string, name: string, sku: string, flowId: string }) => void;
    updateProject: (id: string, updates: Partial<Project>) => void;
    getBOMAndSnapshotsForProject: (projectId: string) => {
        bomData: BOMNode;
        snapshots: Array<{ id: string; name: string; timestamp: string; data: BOMNode }>;
    } | null;

    // ECO / Sandbox actions
    createECO: (title: string, description: string, initiator: string, impacts: ECOImpact[], priority: ECO['priority']) => ECO;
    approveECO: (ecoId: string, approvedBy: string) => void;
    rejectECO: (ecoId: string) => void;
    toggleSandboxMode: (enabled: boolean, ecoId?: string | null) => void;
    publishSandboxChanges: (ecoId?: string) => void;
    discardSandboxChanges: () => void;
}

const getActor = () => {
    const user = useAuthStore.getState().currentUser;
    return {
        userId: user.id,
        name: user.name,
        role: user.role,
    };
};

const coreProjectToProject = (project: CoreProject, totalCost = 0, totalWeight = 0): Project => ({
    id: project.id,
    code: project.code,
    name: project.name,
    sku: project.sku,
    phase: project.phase,
    lastModified: project.updatedAt,
    totalCost,
    totalWeight,
});

const getRepositoryState = () => {
    const snapshot = coreRepository.loadWorkspace();
    const recalculated = FormulaEngine.recalculate(snapshot.bomTree);
    const totals = FormulaEngine.calculateTotals(recalculated);
    const activeProject = snapshot.projects.find((item) => item.id === snapshot.activeProjectId) ?? snapshot.projects[0];
    const activeBOM = snapshot.boms.find((item) => item.projectId === activeProject?.id) ?? snapshot.boms[0];
    const project = activeProject
        ? coreProjectToProject(activeProject, totals.totalCost, totals.totalWeight)
        : {
            ...mockProject,
            id: snapshot.activeProjectId,
            totalCost: totals.totalCost,
            totalWeight: totals.totalWeight,
            lastModified: activeBOM?.updatedAt ?? mockProject.lastModified,
        } as Project;
    return {
        project,
        projects: snapshot.projects.map((item) => coreProjectToProject(item)),
        bomData: recalculated,
        libraryParts: toLegacyLibraryParts(snapshot),
        suppliers: snapshot.suppliers,
        snapshots: snapshot.bomSnapshots.filter((item) => !activeBOM || item.bomId === activeBOM.id).map((item) => ({
            id: item.id,
            name: item.name,
            timestamp: item.timestamp,
            data: buildLegacySnapshotTree(item),
        })),
    };
};

const coreNodeToBOMNode = (
    node: CoreBOMNode,
    childrenByParent: Map<string | undefined, CoreBOMNode[]>
): BOMNode => ({
    id: node.id,
    partNumber: node.partNumber,
    name: node.name,
    description: node.description,
    imageUrl: node.imageUrl,
    revision: node.revision,
    state: node.state,
    type: node.type,
    quantity: node.quantity,
    unit: node.unit,
    cost: node.cost,
    currency: node.currency,
    manufacturer: node.manufacturer,
    mpn: node.mpn,
    leadTimeWeeks: node.leadTimeWeeks,
    refDes: node.refDes,
    variants: node.variants,
    targetCost: node.targetCost,
    moq: node.moq,
    spq: node.spq,
    pricingTiers: node.pricingTiers,
    weightG: node.weightG,
    isAuxiliary: node.isAuxiliary,
    customAttributes: node.customAttributes,
    attachments: node.attachments,
    children: childrenByParent.get(node.id)?.map((child) => coreNodeToBOMNode(child, childrenByParent)),
});

const buildLegacySnapshotTree = (snapshot: CoreBOMSnapshot): BOMNode => {
    const childrenByParent = new Map<string | undefined, CoreBOMNode[]>();
    snapshot.nodes.forEach((node) => {
        const children = childrenByParent.get(node.parentId) ?? [];
        children.push(node);
        childrenByParent.set(node.parentId, children);
    });
    const root = snapshot.nodes.find((node) => node.id === snapshot.rootNodeId) ?? snapshot.nodes[0];
    return root ? FormulaEngine.recalculate(coreNodeToBOMNode(root, childrenByParent)) : previousBOM;
};


// Helper: Recursive Update
const updateNodeRecursive = (node: BOMNode, id: string, updates: Partial<BOMNode>): BOMNode => {
    if (node.id === id) {
        return { ...node, ...updates };
    }
    if (node.children) {
        return {
            ...node,
            children: node.children.map(child => updateNodeRecursive(child, id, updates))
        };
    }
    return node;
};

// Helper: Recursive Add
const addNodeRecursive = (node: BOMNode, parentId: string, newNode: BOMNode): BOMNode => {
    if (node.id === parentId) {
        return {
            ...node,
            children: [...(node.children || []), newNode]
        };
    }
    if (node.children) {
        return {
            ...node,
            children: node.children.map(child => addNodeRecursive(child, parentId, newNode))
        };
    }
    return node;
};

// Helper: Find and Process
const findNodeAndProcess = (node: BOMNode, id: string, processor: (n: BOMNode) => BOMNode): BOMNode => {
    if (node.id === id) return processor(node);
    if (node.children) {
        return {
            ...node,
            children: node.children.map(c => findNodeAndProcess(c, id, processor))
        };
    }
    return node;
};

const DEFAULT_PROJECT_FLOWS: ProjectStageFlow[] = [
    {
        id: 'flow-standard',
        name: 'Standard Hardware Flow',
        stages: ['EVT', 'DVT', 'PVT', 'MP'],
        transitions: {
            EVT: { targetStages: ['DVT'], checklist: ['BOM Cost Review Completed', 'DFM Review Completed', 'Initial EVT Yield Report Attached'] },
            DVT: { targetStages: ['PVT'], checklist: ['Functional Testing Completed', 'Compliance Certificates Obtained', 'Tooling T1 Trials Completed'] },
            PVT: { targetStages: ['MP'], checklist: ['PVT Qualification Complete', 'Operator Training Complete', 'Final Golden Sample Approved'] },
            MP: { targetStages: [], checklist: [] }
        }
    },
    {
        id: 'flow-fast',
        name: 'Fast-Track IoT Flow',
        stages: ['EVT', 'PVT', 'MP'],
        transitions: {
            EVT: { targetStages: ['PVT'], checklist: ['BOM Cost Review Completed', 'Functional Testing Completed', 'DFM Review Completed'] },
            PVT: { targetStages: ['MP'], checklist: ['Operator Training Complete', 'Final Golden Sample Approved'] },
            MP: { targetStages: [], checklist: [] }
        }
    }
];

const FLOWS_STORAGE_KEY = 'zbom.flows.configs';
const FLOW_ASSOC_STORAGE_KEY = 'zbom.flows.associations';
const COMP_TYPES_STORAGE_KEY = 'zbom.config.component_types';
const STATES_STORAGE_KEY = 'zbom.config.lifecycle_states';
const WAREHOUSE_STORAGE_KEY = 'zbom.config.warehouse_locations';
const COMPLIANCE_STORAGE_KEY = 'zbom.config.compliance_standards';
const ATTRIBUTES_STORAGE_KEY = 'zbom.config.attribute_defs';
const COMP_TYPE_LABELS_STORAGE_KEY = 'zbom.config.component_type_labels';
const LIFECYCLE_STATE_LABELS_STORAGE_KEY = 'zbom.config.lifecycle_state_labels';

const loadSavedComponentTypeLabels = (): Record<ComponentType, string> => {
    try {
        const saved = localStorage.getItem(COMP_TYPE_LABELS_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch {}
    return {
        [ComponentType.Assembly]: 'Assembly',
        [ComponentType.Part]: 'Part',
        [ComponentType.Material]: 'Material',
        [ComponentType.Software]: 'Software'
    };
};

const loadSavedLifecycleStateLabels = (): Record<LifecycleState, string> => {
    try {
        const saved = localStorage.getItem(LIFECYCLE_STATE_LABELS_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch {}
    return {
        [LifecycleState.Draft]: 'Draft',
        [LifecycleState.InReview]: 'In Review',
        [LifecycleState.Released]: 'Released',
        [LifecycleState.Obsolete]: 'Obsolete',
        [LifecycleState.Prototype]: 'Prototype'
    };
};

const loadSavedFlows = (): ProjectStageFlow[] => {
    try {
        const saved = localStorage.getItem(FLOWS_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch (e) {
        console.error('Failed to load flows configs', e);
    }
    return DEFAULT_PROJECT_FLOWS;
};

const loadSavedFlowAssociations = (): Record<string, string> => {
    try {
        const saved = localStorage.getItem(FLOW_ASSOC_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch (e) {
        console.error('Failed to load flow associations', e);
    }
    return {
        'project-zphone-2026': 'flow-standard',
        'project-zphone-lite-2026': 'flow-fast'
    };
};

const loadSavedComponentTypes = (): ComponentType[] => {
    try {
        const saved = localStorage.getItem(COMP_TYPES_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch {}
    return [ComponentType.Assembly, ComponentType.Part, ComponentType.Material, ComponentType.Software];
};

const loadSavedLifecycleStates = (): LifecycleState[] => {
    try {
        const saved = localStorage.getItem(STATES_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch {}
    return [LifecycleState.Draft, LifecycleState.InReview, LifecycleState.Released, LifecycleState.Obsolete, LifecycleState.Prototype];
};

const loadSavedWarehouseLocations = (): string[] => {
    try {
        const saved = localStorage.getItem(WAREHOUSE_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch {}
    return ['WH-A', 'WH-B', 'WH-C'];
};

const loadSavedComplianceStandards = (): string[] => {
    try {
        const saved = localStorage.getItem(COMPLIANCE_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch {}
    return ['RoHS', 'REACH', 'UN38.3'];
};

const loadSavedAttributeDefs = (): AttributeDefinition[] => {
    try {
        const saved = localStorage.getItem(ATTRIBUTES_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch {}
    return [
        { id: 'attr-1', name: 'Material', key: 'material', type: 'text' },
        { id: 'attr-2', name: 'Finish', key: 'finish', type: 'text' },
        { id: 'attr-3', name: 'Torque Spec', key: 'torque', type: 'text' },
        { id: 'attr-4', name: 'Compliance', key: 'compliance', type: 'select', options: ['RoHS', 'REACH', 'UN38.3'] }
    ];
};

const ECO_STORAGE_KEY = 'zbom.ecos.v1';

const loadSavedECOs = (): ECO[] => {
    try {
        const saved = localStorage.getItem(ECO_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'eco-001',
        ecoNumber: 'ECO-2024-112',
        title: 'Replace M1.2 screws with M1.4',
        description: 'Field failure reports indicate M1.2 screws stripping during assembly torque. Upgrading to M1.4 for durability.',
        status: 'Approved',
        initiator: 'Alex Chen',
        createdDate: '2024-10-12',
        approvedBy: 'Sarah Engineer',
        approvalDate: '2024-10-14',
        priority: 'High',
        impacts: [
          { partNumber: '500-22101-A', name: 'Screw, M1.2x3, Torx', changeType: 'Obsolete' },
          { partNumber: '500-22105-A', name: 'Screw, M1.4x3, Torx', changeType: 'New' }
        ]
      },
      {
        id: 'eco-002',
        ecoNumber: 'ECO-2024-115',
        title: 'Update FW Bootloader',
        description: 'Security patch for bootloader. Required for PVT builds.',
        status: 'Pending Approval',
        initiator: 'Mike Smith',
        createdDate: '2024-10-14',
        priority: 'Medium',
        impacts: [
          { partNumber: 'SW-10001', name: 'Firmware, Bootloader', changeType: 'RevUp', from: 'v1.2', to: 'v1.3' }
        ]
      }
    ];
};

export const useBOMStore = create<BOMState>((set, get) => ({
    ...getRepositoryState(),
    attributeDefs: loadSavedAttributeDefs(),
    projectFlows: loadSavedFlows(),
    projectFlowAssociations: loadSavedFlowAssociations(),
    enabledComponentTypes: loadSavedComponentTypes(),
    enabledLifecycleStates: loadSavedLifecycleStates(),
    warehouseLocations: loadSavedWarehouseLocations(),
    complianceStandards: loadSavedComplianceStandards(),
    componentTypeLabels: loadSavedComponentTypeLabels(),
    lifecycleStateLabels: loadSavedLifecycleStateLabels(),
    ecos: loadSavedECOs(),
    isSandboxMode: false,
    sandboxBOMData: null,
    sandboxECOId: null,

    setActiveProject: (projectId: string) => {
        coreRepository.setActiveProject(projectId);
        set(getRepositoryState());
    },

    setBOMData: (data: BOMNode) => {
        const recalculated = FormulaEngine.recalculate(data);
        const totals = FormulaEngine.calculateTotals(recalculated);
        coreRepository.replaceLegacyBOMTree(recalculated, getActor());
        set((state) => ({
            bomData: recalculated,
            project: { ...state.project, totalCost: totals.totalCost, totalWeight: totals.totalWeight }
        }));
    },

    updateBOMNode: (nodeId: string, updates: Partial<BOMNode>) => {
        if (get().isSandboxMode && get().sandboxBOMData) {
            set((state) => {
                const updatedTree = updateNodeRecursive(state.sandboxBOMData!, nodeId, updates);
                const recalculated = FormulaEngine.recalculate(updatedTree);
                return { sandboxBOMData: recalculated };
            });
            return;
        }
        set((state) => {
            const updatedTree = updateNodeRecursive(state.bomData, nodeId, updates);
            const recalculated = FormulaEngine.recalculate(updatedTree);
            const totals = FormulaEngine.calculateTotals(recalculated);
            coreRepository.replaceLegacyBOMTree(recalculated, getActor());
            return {
                bomData: recalculated,
                project: { ...state.project, totalCost: totals.totalCost, totalWeight: totals.totalWeight }
            };
        });
    },

    addBOMNode: (parentId: string, newNode: BOMNode) => {
        if (get().isSandboxMode && get().sandboxBOMData) {
            set((state) => {
                const updatedTree = addNodeRecursive(state.sandboxBOMData!, parentId, newNode);
                const recalculated = FormulaEngine.recalculate(updatedTree);
                return { sandboxBOMData: recalculated };
            });
            return;
        }
        set((state) => {
            const updatedTree = addNodeRecursive(state.bomData, parentId, newNode);
            const recalculated = FormulaEngine.recalculate(updatedTree);
            const totals = FormulaEngine.calculateTotals(recalculated);
            coreRepository.replaceLegacyBOMTree(recalculated, getActor());
            return {
                bomData: recalculated,
                project: { ...state.project, totalCost: totals.totalCost, totalWeight: totals.totalWeight }
            };
        });
    },

    deleteBOMNode: (nodeId: string) => {
        const deleteNodeRecursive = (node: BOMNode): BOMNode => ({
            ...node,
            children: (node.children || [])
                .filter((child) => child.id !== nodeId)
                .map(deleteNodeRecursive)
        });
        if (get().isSandboxMode && get().sandboxBOMData) {
            set((state) => {
                const updatedTree = deleteNodeRecursive(state.sandboxBOMData!);
                const recalculated = FormulaEngine.recalculate(updatedTree);
                return { sandboxBOMData: recalculated };
            });
            return;
        }
        set((state) => {
            const updatedTree = deleteNodeRecursive(state.bomData);
            const recalculated = FormulaEngine.recalculate(updatedTree);
            const totals = FormulaEngine.calculateTotals(recalculated);
            coreRepository.replaceLegacyBOMTree(recalculated, getActor());
            return {
                bomData: recalculated,
                project: { ...state.project, totalCost: totals.totalCost, totalWeight: totals.totalWeight }
            };
        });
    },

    updateLibraryPart: (partId: string, updates: Partial<LibraryPart>) => {
        set((state) => {
            const libraryParts = state.libraryParts.map(p => p.id === partId ? { ...p, ...updates } : p);
            coreRepository.replaceLegacyLibraryParts(libraryParts, getActor());
            const refreshed = getRepositoryState();
            return {
                ...refreshed,
                snapshots: state.snapshots,
            };
        });
    },

    addLibraryPart: (part: LibraryPart) => {
        set((state) => {
            const libraryParts = [...state.libraryParts, part];
            coreRepository.replaceLegacyLibraryParts(libraryParts, getActor());
            const refreshed = getRepositoryState();
            return {
                ...refreshed,
                snapshots: state.snapshots,
            };
        });
    },

    createSnapshot: (name: string) => {
        set((state) => {
            const workspace = coreRepository.loadWorkspace();
            const activeBOM = workspace.boms.find((item) => item.projectId === workspace.activeProjectId) ?? workspace.boms[0];
            const snapshot = coreRepository.createBOMSnapshot(activeBOM.id, name, getActor());
            return {
                snapshots: [{
                    id: snapshot.id,
                    name: snapshot.name,
                    timestamp: snapshot.timestamp,
                    data: JSON.parse(JSON.stringify(state.bomData))
                }, ...state.snapshots]
            };
        });
    },

    loadSnapshot: (snapshotId: string) => {
        set((state) => {
            const snapshot = state.snapshots.find((item) => item.id === snapshotId);
            if (!snapshot) return {};
            const recalculated = FormulaEngine.recalculate(snapshot.data);
            const totals = FormulaEngine.calculateTotals(recalculated);
            coreRepository.replaceLegacyBOMTree(recalculated, getActor());
            return {
                bomData: recalculated,
                project: { ...state.project, totalCost: totals.totalCost, totalWeight: totals.totalWeight }
            };
        });
    },

    addAttributeDef: (def: AttributeDefinition) => {
        const updated = [...get().attributeDefs, def];
        localStorage.setItem(ATTRIBUTES_STORAGE_KEY, JSON.stringify(updated));
        set({ attributeDefs: updated });
    },

    deleteAttributeDef: (id: string) => {
        const updated = get().attributeDefs.filter(a => a.id !== id);
        localStorage.setItem(ATTRIBUTES_STORAGE_KEY, JSON.stringify(updated));
        set({ attributeDefs: updated });
    },

    updateAttributeDef: (id: string, updates: Partial<AttributeDefinition>) => {
        const updated = get().attributeDefs.map((def) => {
            if (def.id === id) {
                return { ...def, ...updates };
            }
            return def;
        });
        localStorage.setItem(ATTRIBUTES_STORAGE_KEY, JSON.stringify(updated));
        set({ attributeDefs: updated });
    },

    addAttachment: (nodeId: string, file: File) => {
        const fakeUrl = URL.createObjectURL(file);
        const newAtt: Attachment = {
            id: `att-${Date.now()}`,
            name: file.name,
            type: file.name.endsWith('.pdf') ? 'datasheet' : (file.name.endsWith('.step') || file.name.endsWith('.dxf')) ? 'cad' : 'other',
            url: fakeUrl,
            size: `${(file.size / 1024).toFixed(1)} KB`,
            uploadDate: new Date().toISOString().split('T')[0]
        };

        set((state) => {
            const newData = findNodeAndProcess(state.bomData, nodeId, (n) => ({
                ...n,
                attachments: [...(n.attachments || []), newAtt]
            }));
            coreRepository.replaceLegacyBOMTree(newData, getActor());
            return { bomData: newData };
        });
    },

    deleteAttachment: (nodeId: string, attachmentId: string) => {
        set((state) => {
            const newData = findNodeAndProcess(state.bomData, nodeId, (n) => ({
                ...n,
                attachments: (n.attachments || []).filter(a => a.id !== attachmentId)
            }));
            coreRepository.replaceLegacyBOMTree(newData, getActor());
            return { bomData: newData };
        });
    },

    updateProjectPhase: (projectId: string, newPhase: 'EVT' | 'DVT' | 'PVT' | 'MP', signatures?: any) => {
        const actor = getActor();
        const updatedCoreProject = coreRepository.updateProjectPhase(projectId, newPhase, actor, signatures);
        set((state) => {
            const calculatedTree = state.bomData;
            const totals = FormulaEngine.calculateTotals(calculatedTree);
            const legacyProject = coreProjectToProject(updatedCoreProject, totals.totalCost, totals.totalWeight);
            const projects = state.projects.map((p) => p.id === projectId ? legacyProject : p);
            const project = state.project.id === projectId ? legacyProject : state.project;
            return { projects, project };
        });
    },

    updateProjectFlows: (flows: ProjectStageFlow[]) => {
        localStorage.setItem(FLOWS_STORAGE_KEY, JSON.stringify(flows));
        set({ projectFlows: flows });
    },

    setProjectFlowAssociation: (projectId: string, flowId: string) => {
        const updatedAssoc = {
            ...get().projectFlowAssociations,
            [projectId]: flowId
        };
        localStorage.setItem(FLOW_ASSOC_STORAGE_KEY, JSON.stringify(updatedAssoc));
        set({ projectFlowAssociations: updatedAssoc });
    },

    toggleComponentType: (type: ComponentType) => {
        const current = get().enabledComponentTypes;
        const updated = current.includes(type)
            ? current.filter((t) => t !== type)
            : [...current, type];
        localStorage.setItem(COMP_TYPES_STORAGE_KEY, JSON.stringify(updated));
        set({ enabledComponentTypes: updated });
    },

    toggleLifecycleState: (state: LifecycleState) => {
        const current = get().enabledLifecycleStates;
        const updated = current.includes(state)
            ? current.filter((s) => s !== state)
            : [...current, state];
        localStorage.setItem(STATES_STORAGE_KEY, JSON.stringify(updated));
        set({ enabledLifecycleStates: updated });
    },

    updateComponentTypeLabel: (type: ComponentType, label: string) => {
        const current = get().componentTypeLabels;
        const updated = { ...current, [type]: label };
        localStorage.setItem(COMP_TYPE_LABELS_STORAGE_KEY, JSON.stringify(updated));
        set({ componentTypeLabels: updated });
    },

    updateLifecycleStateLabel: (state: LifecycleState, label: string) => {
        const current = get().lifecycleStateLabels;
        const updated = { ...current, [state]: label };
        localStorage.setItem(LIFECYCLE_STATE_LABELS_STORAGE_KEY, JSON.stringify(updated));
        set({ lifecycleStateLabels: updated });
    },

    addWarehouseLocation: (location: string) => {
        const current = get().warehouseLocations;
        if (current.includes(location)) return;
        const updated = [...current, location];
        localStorage.setItem(WAREHOUSE_STORAGE_KEY, JSON.stringify(updated));
        set({ warehouseLocations: updated });
    },

    deleteWarehouseLocation: (location: string) => {
        const updated = get().warehouseLocations.filter((l) => l !== location);
        localStorage.setItem(WAREHOUSE_STORAGE_KEY, JSON.stringify(updated));
        set({ warehouseLocations: updated });
    },

    updateWarehouseLocation: (oldLoc: string, newLoc: string) => {
        const current = get().warehouseLocations;
        const updated = current.map((l) => l === oldLoc ? newLoc : l);
        localStorage.setItem(WAREHOUSE_STORAGE_KEY, JSON.stringify(updated));

        // Cascade update to library parts
        const updatedParts = get().libraryParts.map((p) => p.location === oldLoc ? { ...p, location: newLoc } : p);
        coreRepository.replaceLegacyLibraryParts(updatedParts, getActor());

        set({
            warehouseLocations: updated,
            ...getRepositoryState()
        });
    },

    addComplianceStandard: (standard: string) => {
        const current = get().complianceStandards;
        if (current.includes(standard)) return;
        const updated = [...current, standard];
        localStorage.setItem(COMPLIANCE_STORAGE_KEY, JSON.stringify(updated));
        set({ complianceStandards: updated });
    },

    deleteComplianceStandard: (standard: string) => {
        const updated = get().complianceStandards.filter((s) => s !== standard);
        localStorage.setItem(COMPLIANCE_STORAGE_KEY, JSON.stringify(updated));
        set({ complianceStandards: updated });
    },

    updateComplianceStandard: (oldStd: string, newStd: string) => {
        const current = get().complianceStandards;
        const updated = current.map((s) => s === oldStd ? newStd : s);
        localStorage.setItem(COMPLIANCE_STORAGE_KEY, JSON.stringify(updated));

        // Update attributeDefs options if they contain the old compliance standard
        const updatedAttrs = get().attributeDefs.map((def) => {
            if (def.type === 'select' && def.options) {
                return {
                    ...def,
                    options: def.options.map((o) => o === oldStd ? newStd : o)
                };
            }
            return def;
        });
        localStorage.setItem(ATTRIBUTES_STORAGE_KEY, JSON.stringify(updatedAttrs));

        set({
            complianceStandards: updated,
            attributeDefs: updatedAttrs
        });
    },

    createProject: (input: { code: string, name: string, sku: string, flowId: string }) => {
        const actor = getActor();
        const newCoreProject = coreRepository.createProject({
          id: `project-${input.code.toLowerCase()}-${Date.now()}`,
          code: input.code,
          name: input.name,
          sku: input.sku,
          phase: 'EVT'
        }, actor);

        const newLegacyProject = coreProjectToProject(newCoreProject);
        
        set((state) => {
            const updatedProjects = [...state.projects, newLegacyProject];
            const updatedAssoc = {
                ...state.projectFlowAssociations,
                [newLegacyProject.id]: input.flowId
            };
            localStorage.setItem(FLOW_ASSOC_STORAGE_KEY, JSON.stringify(updatedAssoc));
            return {
                projects: updatedProjects,
                projectFlowAssociations: updatedAssoc
            };
        });
    },

    updateProject: (id: string, updates: Partial<Project>) => {
        const actor = getActor();
        const updatedCoreProject = coreRepository.updateProject(id, {
            code: updates.code,
            name: updates.name,
            sku: updates.sku
        }, actor);

        const totals = FormulaEngine.calculateTotals(get().bomData);
        const legacyProject = coreProjectToProject(updatedCoreProject, totals.totalCost, totals.totalWeight);

        set((state) => {
            const projects = state.projects.map((p) => p.id === id ? legacyProject : p);
            const project = state.project.id === id ? legacyProject : state.project;
            return { projects, project };
        });
    },

    getBOMAndSnapshotsForProject: (projectId: string) => {
        const workspace = coreRepository.loadWorkspace();
        const bom = workspace.boms.find((b) => b.projectId === projectId);
        if (!bom) return null;

        const childrenByParent = new Map<string | undefined, CoreBOMNode[]>();
        for (const node of workspace.bomNodes.filter((item) => item.bomId === bom.id)) {
            const children = childrenByParent.get(node.parentId) ?? [];
            children.push(node);
            childrenByParent.set(node.parentId, children);
        }

        const convert = (node: CoreBOMNode): BOMNode => {
            const part = node.partId ? workspace.parts.find((item) => item.id === node.partId) : undefined;
            const source = part && part.active ? part : undefined;
            return {
                id: node.id,
                partNumber: source?.partNumber ?? node.partNumber,
                name: source?.description ?? node.name,
                description: source?.description ?? node.description,
                imageUrl: source?.imageUrl ?? node.imageUrl,
                revision: node.revision,
                state: source?.state ?? node.state,
                type: source?.type ?? node.type,
                quantity: node.quantity,
                unit: node.unit,
                cost: source?.cost ?? node.cost,
                currency: source?.currency ?? node.currency,
                manufacturer: source?.manufacturer ?? node.manufacturer,
                mpn: source?.mpn ?? node.mpn,
                leadTimeWeeks: source?.leadTimeWeeks ?? node.leadTimeWeeks,
                refDes: node.refDes,
                variants: node.variants,
                targetCost: node.targetCost,
                moq: source?.moq ?? node.moq,
                spq: source?.spq ?? node.spq,
                pricingTiers: source?.pricingTiers ?? node.pricingTiers,
                weightG: source?.weightG ?? node.weightG,
                isAuxiliary: node.isAuxiliary,
                customAttributes: node.customAttributes,
                attachments: node.attachments,
                children: childrenByParent.get(node.id)?.map(convert),
            };
        };

        const root = workspace.bomNodes.find((node) => node.id === bom.rootNodeId);
        if (!root) return null;

        const bomData = FormulaEngine.recalculate(convert(root));

        const projectSnapshots = workspace.bomSnapshots
            .filter((item) => item.bomId === bom.id)
            .map((item) => ({
                id: item.id,
                name: item.name,
                timestamp: item.timestamp,
                data: buildLegacySnapshotTree(item),
            }));

        return { bomData, snapshots: projectSnapshots };
    },

    createECO: (title: string, description: string, initiator: string, impacts: ECOImpact[], priority: ECO['priority'] = 'Medium') => {
        const nextIndex = get().ecos.length + 1;
        const newEco: ECO = {
            id: `eco-draft-${Date.now()}-${nextIndex}`,
            ecoNumber: `ECO-2024-DRAFT-${String(nextIndex).padStart(3, '0')}`,
            title,
            description,
            status: 'Draft',
            initiator,
            createdDate: new Date().toISOString().split('T')[0],
            priority,
            impacts
        };
        const updated = [newEco, ...get().ecos];
        localStorage.setItem(ECO_STORAGE_KEY, JSON.stringify(updated));
        set({ ecos: updated });
        return newEco;
    },

    approveECO: (ecoId: string, approvedBy: string) => {
        const updated = get().ecos.map(e => {
            if (e.id === ecoId) {
                return {
                    ...e,
                    status: 'Approved' as const,
                    approvedBy,
                    approvalDate: new Date().toISOString().split('T')[0]
                };
            }
            return e;
        });
        localStorage.setItem(ECO_STORAGE_KEY, JSON.stringify(updated));
        set({ ecos: updated });
    },

    rejectECO: (ecoId: string) => {
        const updated = get().ecos.map(e => {
            if (e.id === ecoId) {
                return {
                    ...e,
                    status: 'Rejected' as const
                };
            }
            return e;
        });
        localStorage.setItem(ECO_STORAGE_KEY, JSON.stringify(updated));
        set({ ecos: updated });
    },

    toggleSandboxMode: (enabled: boolean, ecoId?: string | null) => {
        if (enabled) {
            set((state) => ({
                isSandboxMode: true,
                sandboxBOMData: state.sandboxBOMData || JSON.parse(JSON.stringify(state.bomData)),
                sandboxECOId: ecoId || null
            }));
        } else {
            set({
                isSandboxMode: false,
                sandboxBOMData: null,
                sandboxECOId: null
            });
        }
    },

    publishSandboxChanges: (ecoId?: string) => {
        const { isSandboxMode, sandboxBOMData, sandboxECOId } = get();
        if (!isSandboxMode || !sandboxBOMData) return;

        // Apply changes to master
        const recalculated = FormulaEngine.recalculate(sandboxBOMData);
        const totals = FormulaEngine.calculateTotals(recalculated);
        coreRepository.replaceLegacyBOMTree(recalculated, getActor());

        // Update the ECO status to Pending Approval
        const targetEcoId = ecoId || sandboxECOId;
        let updatedEcos = get().ecos;
        if (targetEcoId) {
            updatedEcos = get().ecos.map(e => {
                if (e.id === targetEcoId) {
                    return {
                        ...e,
                        status: 'Pending Approval' as const
                    };
                }
                return e;
            });
            localStorage.setItem(ECO_STORAGE_KEY, JSON.stringify(updatedEcos));
        }

        set((state) => ({
            bomData: recalculated,
            project: { ...state.project, totalCost: totals.totalCost, totalWeight: totals.totalWeight },
            isSandboxMode: false,
            sandboxBOMData: null,
            sandboxECOId: null,
            ecos: updatedEcos
        }));
    },

    discardSandboxChanges: () => {
        set({
            isSandboxMode: false,
            sandboxBOMData: null,
            sandboxECOId: null
        });
    }
}));
