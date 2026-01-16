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
  
  // Initialize with the mock 'previous' version as a snapshot so comparison works out of the box
  const [snapshots, setSnapshots] = useState<BOMSnapshot[]>([
    {
      id: 'snap-001',
      name: 'Baseline (Rev A.01)',
      timestamp: new Date(Date.now() - 86400000 * 7).toISOString(), // 7 days ago
      data: previousBOM
    }
  ]);

  // Helper to recursively update a node
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

  // Helper to recursively add a node
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

  // Recalculate Project Total Cost when BOM changes
  useEffect(() => {
    const calculateTotalCost = (node: BOMNode): number => {
      const selfCost = node.type !== ComponentType.Assembly ? (node.cost * node.quantity) : 0;
      const childrenCost = node.children ? node.children.reduce((acc, child) => acc + calculateTotalCost(child), 0) : 0;
      
      if (node.type === ComponentType.Assembly) return childrenCost;
      return selfCost;
    };

    const calcRecursive = (n: BOMNode): number => {
        if (!n.children || n.children.length === 0) return n.cost * n.quantity;
        const childrenSum = n.children.reduce((sum, child) => sum + calcRecursive(child), 0);
        return childrenSum * n.quantity; 
    };

    const rootCost = bomData.children ? bomData.children.reduce((sum, child) => sum + calcRecursive(child), 0) : 0;
    
    setProject(prev => ({ ...prev, totalCost: rootCost }));

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
        // Deep copy the current BOM Data
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