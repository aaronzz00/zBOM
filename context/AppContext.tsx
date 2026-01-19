import React, { createContext, useContext, useState, useEffect } from 'react';
import { BOMNode, Project, LibraryPart, ComponentType, LifecycleState, Supplier, BOMSnapshot } from '../types';
import { mockProject, complexBOM, previousBOM } from '../data/mockBOM';
import { mockLibraryData } from '../data/mockLibrary';
import { mockSuppliers } from '../data/mockSuppliers';

interface AppState {
  project: Project;
  bomData: BOMNode;
  libraryParts: LibraryPart[];
  suppliers: Supplier[];
  snapshots: BOMSnapshot[];
}

interface AppContextType extends AppState {
  updateBOMNode: (nodeId: string, updates: Partial<BOMNode>) => void;
  addBOMNode: (parentId: string, newNode: BOMNode) => void;
  setBOMData: (data: BOMNode) => void;
  updateLibraryPart: (partId: string, updates: Partial<LibraryPart>) => void;
  addLibraryPart: (part: LibraryPart) => void;
  createSnapshot: (name: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [project, setProject] = useState<Project>(mockProject);
  const [bomData, setBOMData] = useState<BOMNode>(complexBOM);
  const [libraryParts, setLibraryParts] = useState<LibraryPart[]>(mockLibraryData);
  const [suppliers, setSuppliers] = useState<Supplier[]>(mockSuppliers);
  
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
    // Return [Cost, Weight]
    const calculateTotals = (node: BOMNode): [number, number] => {
      // Base values
      const selfCost = node.type !== ComponentType.Assembly ? (node.cost * node.quantity) : 0;
      const selfWeight = (node.weightG || 0) * node.quantity;

      // Children values
      let childrenCost = 0;
      let childrenWeight = 0;

      if (node.children) {
          node.children.forEach(child => {
              const [cCost, cWeight] = calculateTotals(child);
              childrenCost += cCost;
              childrenWeight += cWeight;
          });
      }

      // If assembly, its cost/weight is sum of children + its own (if any, e.g. aux)
      // Note: Logic depends if cost/weightG on Assembly node means "Assembly Process Cost/Weight" or "Total".
      // Usually Total = Children + Self.
      
      const totalCost = (node.type === ComponentType.Assembly ? childrenCost : selfCost); 
      // Weight roll-up: Sum of children weights
      const totalWeight = node.type === ComponentType.Assembly ? childrenWeight + selfWeight : selfWeight;

      return [totalCost, totalWeight];
    };

    // Calculate recursively for the root's CHILDREN (as root qty is usually 1 project)
    // Or just run on root and assume root quantity is 1 unit of product
    
    // We want the cost/weight of ONE unit of the root product
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

  return (
    <AppContext.Provider value={{ project, bomData, libraryParts, suppliers, snapshots, updateBOMNode, addBOMNode, setBOMData, updateLibraryPart, addLibraryPart, createSnapshot }}>
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