import { create } from 'zustand';
import { BOMNode, Project, LibraryPart, ComponentType, Supplier, BOMSnapshot, AttributeDefinition, Attachment } from '../types';
import { mockProject, previousBOM } from '../data/mockBOM';
import { FormulaEngine } from '../services/FormulaEngine';
import { coreRepository, toLegacyLibraryParts } from '../repositories/core/coreRepository';
import { useAuthStore } from './useAuthStore';
import type { CoreBOMNode, CoreBOMSnapshot } from '../domain/coreTypes';

interface BOMState {
    project: Project;
    bomData: BOMNode;
    libraryParts: LibraryPart[];
    suppliers: Supplier[];
    snapshots: BOMSnapshot[];
    attributeDefs: AttributeDefinition[];

    // Actions
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
}

const getActor = () => {
    const user = useAuthStore.getState().currentUser;
    return {
        userId: user.id,
        name: user.name,
        role: user.role,
    };
};

const getRepositoryState = () => {
    const snapshot = coreRepository.loadWorkspace();
    const recalculated = FormulaEngine.recalculate(snapshot.bomTree);
    const totals = FormulaEngine.calculateTotals(recalculated);
    return {
        project: {
            ...mockProject,
            id: snapshot.projectId,
            totalCost: totals.totalCost,
            totalWeight: totals.totalWeight,
            lastModified: snapshot.boms[0]?.updatedAt ?? mockProject.lastModified,
        } as Project,
        bomData: recalculated,
        libraryParts: toLegacyLibraryParts(snapshot),
        suppliers: snapshot.suppliers,
        snapshots: snapshot.bomSnapshots.map((item) => ({
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

export const useBOMStore = create<BOMState>((set, get) => ({
    ...getRepositoryState(),
    attributeDefs: [
        { id: 'attr-1', name: 'Material', key: 'material', type: 'text' },
        { id: 'attr-2', name: 'Finish', key: 'finish', type: 'text' },
        { id: 'attr-3', name: 'Torque Spec', key: 'torque', type: 'text' },
        { id: 'attr-4', name: 'Compliance', key: 'compliance', type: 'select', options: ['RoHS', 'REACH', 'UN38.3'] }
    ],

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
            const snapshot = coreRepository.createBOMSnapshot(coreRepository.loadWorkspace().boms[0].id, name, getActor());
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
        set((state) => ({
            attributeDefs: [...state.attributeDefs, def]
        }));
    },

    deleteAttributeDef: (id: string) => {
        set((state) => ({
            attributeDefs: state.attributeDefs.filter(a => a.id !== id)
        }));
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
    }
}));
