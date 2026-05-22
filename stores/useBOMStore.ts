import { create } from 'zustand';
import { BOMNode, Project, LibraryPart, ComponentType, Supplier, BOMSnapshot, AttributeDefinition, Attachment } from '../types';
import { mockProject, complexBOM, previousBOM } from '../data/mockBOM';
import { mockLibraryData } from '../data/mockLibrary';
import { mockSuppliers } from '../data/mockSuppliers';
import { FormulaEngine } from '../services/FormulaEngine';

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
    setBOMData: (data: BOMNode) => void;
    updateLibraryPart: (partId: string, updates: Partial<LibraryPart>) => void;
    addLibraryPart: (part: LibraryPart) => void;
    createSnapshot: (name: string) => void;
    addAttributeDef: (def: AttributeDefinition) => void;
    deleteAttributeDef: (id: string) => void;
    addAttachment: (nodeId: string, file: File) => void;
    deleteAttachment: (nodeId: string, attachmentId: string) => void;
}


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
    project: mockProject,
    bomData: complexBOM,
    libraryParts: mockLibraryData,
    suppliers: mockSuppliers,
    snapshots: [
        {
            id: 'snap-001',
            name: 'Baseline (Rev A.01)',
            timestamp: new Date(Date.now() - 86400000 * 7).toISOString(),
            data: previousBOM
        }
    ],
    attributeDefs: [
        { id: 'attr-1', name: 'Material', key: 'material', type: 'text' },
        { id: 'attr-2', name: 'Finish', key: 'finish', type: 'text' },
        { id: 'attr-3', name: 'Torque Spec', key: 'torque', type: 'text' },
        { id: 'attr-4', name: 'Compliance', key: 'compliance', type: 'select', options: ['RoHS', 'REACH', 'UN38.3'] }
    ],

    setBOMData: (data: BOMNode) => {
        const recalculated = FormulaEngine.recalculate(data);
        const totals = FormulaEngine.calculateTotals(recalculated);
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
            return {
                bomData: recalculated,
                project: { ...state.project, totalCost: totals.totalCost, totalWeight: totals.totalWeight }
            };
        });
    },

    updateLibraryPart: (partId: string, updates: Partial<LibraryPart>) => {
        set((state) => ({
            libraryParts: state.libraryParts.map(p => p.id === partId ? { ...p, ...updates } : p)
        }));
    },

    addLibraryPart: (part: LibraryPart) => {
        set((state) => ({
            libraryParts: [...state.libraryParts, part]
        }));
    },

    createSnapshot: (name: string) => {
        set((state) => ({
            snapshots: [{
                id: `snap-${Date.now()}`,
                name: name,
                timestamp: new Date().toISOString(),
                data: JSON.parse(JSON.stringify(state.bomData))
            }, ...state.snapshots]
        }));
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
            return { bomData: newData };
        });
    },

    deleteAttachment: (nodeId: string, attachmentId: string) => {
        set((state) => {
            const newData = findNodeAndProcess(state.bomData, nodeId, (n) => ({
                ...n,
                attachments: (n.attachments || []).filter(a => a.id !== attachmentId)
            }));
            return { bomData: newData };
        });
    }
}));
