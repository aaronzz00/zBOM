import React, { createContext, useContext, useState, useEffect } from 'react';
import { BOMNode, Project, LibraryPart, ComponentType, LifecycleState, Supplier, BOMSnapshot, AttributeDefinition, Attachment } from '../types';
import { mockProject, complexBOM, previousBOM } from '../data/mockBOM';
import { mockLibraryData } from '../data/mockLibrary';
import { mockSuppliers } from '../data/mockSuppliers';

interface AppState {
  project: Project;
  bomData: BOMNode;
  libraryParts: LibraryPart[];
  suppliers: Supplier[];
  snapshots: BOMSnapshot[];
  attributeDefs: AttributeDefinition[];
}

interface AppContextType extends AppState {
  updateBOMNode: (nodeId: string, updates: Partial<BOMNode>) => void;
  addBOMNode: (parentId: string, newNode: BOMNode) => void;
  setBOMData: (data: BOMNode) => void;
  updateLibraryPart: (partId: string, updates: Partial<LibraryPart>) => void;
  addLibraryPart: (part: LibraryPart) => void;
  createSnapshot: (name: string) => void;
  
  // Custom Attribute Actions
  addAttributeDef: (def: AttributeDefinition) => void;
  deleteAttributeDef: (id: string) => void;
  
  // Attachment Actions
  addAttachment: (nodeId: string, file: File) => void;
  deleteAttachment: (nodeId: string, attachmentId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [project, setProject] = useState<Project>(mockProject);
  const [bomData, setBOMData] = useState<BOMNode>(complexBOM);
  const [libraryParts, setLibraryParts] = useState<LibraryPart[]>(mockLibraryData);
  const [suppliers, setSuppliers] = useState<Supplier[]>(mockSuppliers);
  
  // P1: Initial Attribute Definitions
  const [attributeDefs, setAttributeDefs] = useState<AttributeDefinition[]>([
      { id: 'attr-1', name: 'Material', key: 'material', type: 'text' },
      { id: 'attr-2', name: 'Finish', key: 'finish', type: 'text' },
      { id: 'attr-3', name: 'Torque Spec', key: 'torque', type: 'text' },
      { id: 'attr-4', name: 'Compliance', key: 'compliance', type: 'select', options: ['RoHS', 'REACH', 'UN38.3'] }
  ]);

  const [snapshots, setSnapshots] = useState<BOMSnapshot[]>([
    {
      id: 'snap-001',
      name: 'Baseline (Rev A.01)',
      timestamp: new Date(Date.now() - 86400000 * 7).toISOString(), 
      data: previousBOM
    }
  ]);

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

  // Recalculate Project Total Cost AND Total Weight when BOM changes
  useEffect(() => {
    const calculateTotals = (node: BOMNode): [number, number] => {
      const selfCost = node.type !== ComponentType.Assembly ? (node.cost * node.quantity) : 0;
      const selfWeight = (node.weightG || 0) * node.quantity;

      let childrenCost = 0;
      let childrenWeight = 0;

      if (node.children) {
          node.children.forEach(child => {
              const [cCost, cWeight] = calculateTotals(child);
              childrenCost += cCost;
              childrenWeight += cWeight;
          });
      }
      
      const totalCost = (node.type === ComponentType.Assembly ? childrenCost : selfCost); 
      const totalWeight = node.type === ComponentType.Assembly ? childrenWeight + selfWeight : selfWeight;

      return [totalCost, totalWeight];
    };

    let pCost = 0;
    let pWeight = 0;

    if (bomData.children) {
        bomData.children.forEach(child => {
             const [c, w] = calculateTotals(child);
             pCost += c;
             pWeight += w;
        });
    }
    
    setProject(prev => ({ ...prev, totalCost: pCost, totalWeight: pWeight }));

  }, [bomData]);

  const updateBOMNode = (nodeId: string, updates: Partial<BOMNode>) => {
    setBOMData(prev => updateNodeRecursive(prev, nodeId, updates));
  };

  const addBOMNode = (parentId: string, newNode: BOMNode) => {
    setBOMData(prev => addNodeRecursive(prev, parentId, newNode));
  };

  const updateLibraryPart = (partId: string, updates: Partial<LibraryPart>) => {
    setLibraryParts(prev => prev.map(p => p.id === partId ? { ...p, ...updates } : p));
  };

  const addLibraryPart = (part: LibraryPart) => {
    setLibraryParts(prev => [...prev, part]);
  }

  const createSnapshot = (name: string) => {
    const newSnapshot: BOMSnapshot = {
        id: `snap-${Date.now()}`,
        name: name,
        timestamp: new Date().toISOString(),
        data: JSON.parse(JSON.stringify(bomData))
    };
    setSnapshots(prev => [newSnapshot, ...prev]);
  };

  // --- Attribute Management ---
  const addAttributeDef = (def: AttributeDefinition) => {
      setAttributeDefs(prev => [...prev, def]);
  };

  const deleteAttributeDef = (id: string) => {
      setAttributeDefs(prev => prev.filter(a => a.id !== id));
  };

  // --- Attachment Management ---
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

  const addAttachment = (nodeId: string, file: File) => {
      // Create a fake URL for demo purposes
      const fakeUrl = URL.createObjectURL(file);
      const newAtt: Attachment = {
          id: `att-${Date.now()}`,
          name: file.name,
          type: file.name.endsWith('.pdf') ? 'datasheet' : (file.name.endsWith('.step') || file.name.endsWith('.dxf')) ? 'cad' : 'other',
          url: fakeUrl,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          uploadDate: new Date().toISOString().split('T')[0]
      };

      setBOMData(prev => findNodeAndProcess(prev, nodeId, (n) => ({
          ...n,
          attachments: [...(n.attachments || []), newAtt]
      })));
  };

  const deleteAttachment = (nodeId: string, attachmentId: string) => {
      setBOMData(prev => findNodeAndProcess(prev, nodeId, (n) => ({
          ...n,
          attachments: (n.attachments || []).filter(a => a.id !== attachmentId)
      })));
  };

  return (
    <AppContext.Provider value={{ 
        project, bomData, libraryParts, suppliers, snapshots, attributeDefs, 
        updateBOMNode, addBOMNode, setBOMData, updateLibraryPart, addLibraryPart, createSnapshot,
        addAttributeDef, deleteAttributeDef, addAttachment, deleteAttachment
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppStore must be used within an AppProvider');
  }
  return context;
};