import { create } from 'zustand';
import { BOMNode, Project, LibraryPart, ComponentType, Supplier, BOMSnapshot, AttributeDefinition, Attachment, ProjectStageFlow, LifecycleState } from '../types';
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
    addAttachment: (nodeId: string, file: File) => void;
    deleteAttachment: (nodeId: string, attachmentId: string) => void;
    updateProjectPhase: (projectId: string, newPhase: 'EVT' | 'DVT' | 'PVT' | 'MP') => void;
    updateProjectFlows: (flows: ProjectStageFlow[]) => void;
    setProjectFlowAssociation: (projectId: string, flowId: string) => void;
    toggleComponentType: (type: ComponentType) => void;
    toggleLifecycleState: (state: LifecycleState) => void;
    addWarehouseLocation: (location: string) => void;
    deleteWarehouseLocation: (location: string) => void;
    addComplianceStandard: (standard: string) => void;
    deleteComplianceStandard: (standard: string) => void;
    createProject: (input: { code: string, name: string, sku: string, flowId: string }) => void;
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

export const useBOMStore = create<BOMState>((set, get) => ({
    ...getRepositoryState(),
    attributeDefs: loadSavedAttributeDefs(),
    projectFlows: loadSavedFlows(),
    projectFlowAssociations: loadSavedFlowAssociations(),
    enabledComponentTypes: loadSavedComponentTypes(),
    enabledLifecycleStates: loadSavedLifecycleStates(),
    warehouseLocations: loadSavedWarehouseLocations(),
    complianceStandards: loadSavedComplianceStandards(),

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

    updateProjectPhase: (projectId: string, newPhase: 'EVT' | 'DVT' | 'PVT' | 'MP') => {
        const actor = getActor();
        const updatedCoreProject = coreRepository.updateProjectPhase(projectId, newPhase, actor);
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
    }
}));
