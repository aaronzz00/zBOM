import React, { useState, useRef } from 'react';
import { BOMTable } from '../components/BOMTable';
import { BOMMatrix } from '../components/BOMMatrix';
import { BOMFlatView } from '../components/BOMFlatView';
import { AIAssistant } from '../components/AIAssistant';
import { useAppStore } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { BOMNode, ComponentType, LifecycleState, LibraryPart, AVLEntry, Permission } from '../types';
import { Filter, Download, Upload, Plus, Minus, Bot, History, RotateCcw, Info, X, Search, Database, Box, Camera, FileSpreadsheet, CircuitBoard, Tags, LayoutGrid, ListTree, Trash2, Check, Star, Table2, Target, Lock } from 'lucide-react';
import { exportBOMToCSV, parseCSVToBOM } from '../utils/csvHelper';

export const BOMEditor: React.FC = () => {
  // Use Global Store
  const { bomData, setBOMData, libraryParts, updateBOMNode, addBOMNode, createSnapshot } = useAppStore();
  const { hasPermission } = useAuth(); // Auth Context
  
  const [selectedNode, setSelectedNode] = useState<BOMNode | null>(null);
  const [showAI, setShowAI] = useState(false);
  const [detailsTab, setDetailsTab] = useState<'info' | 'history'>('info');
  const [viewMode, setViewMode] = useState<'tree' | 'matrix' | 'flat'>('tree');

  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMethod, setAddMethod] = useState<'custom' | 'library'>('library');
  const [librarySearch, setLibrarySearch] = useState('');
  
  // Custom Item Form State
  const [newItem, setNewItem] = useState({
    partNumber: '',
    name: '',
    quantity: 1,
    cost: 0,
    type: ComponentType.Part
  });

  // AVL Form State
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [newSource, setNewSource] = useState({ manufacturer: '', mpn: '' });

  // Permissions Check
  const canEditStructure = hasPermission(Permission.EDIT_BOM_STRUCTURE);
  const canEditMetadata = hasPermission(Permission.EDIT_BOM_METADATA);
  const canEditCost = hasPermission(Permission.EDIT_COST);
  const canViewCost = hasPermission(Permission.VIEW_COST);
  const canManageAVL = hasPermission(Permission.MANAGE_AVL);

  const handleNodeSelect = (node: BOMNode) => {
    setSelectedNode(node);
    setDetailsTab('info');
    setIsAddingSource(false);
  };

  const handleUpdateQuantity = (nodeId: string, newQty: number) => {
    if (!canEditStructure) return;
    if (newQty < 0) return;
    updateBOMNode(nodeId, { quantity: newQty });
    if (selectedNode && selectedNode.id === nodeId) {
        setSelectedNode({ ...selectedNode, quantity: newQty });
    }
  };

  const handleUpdateField = (nodeId: string, field: keyof BOMNode, value: any) => {
      // Permission checks for fields
      if (field === 'targetCost' && !canEditCost) return;
      if (['refDes', 'variants', 'description'].includes(field as string) && !canEditMetadata) return;

      updateBOMNode(nodeId, { [field]: value });
      if (selectedNode && selectedNode.id === nodeId) {
          setSelectedNode({ ...selectedNode, [field]: value });
      }
  };

  // --- AVL Logic ---
  const handleAddAVL = () => {
      if (!canManageAVL) return;
      if (!selectedNode || !newSource.manufacturer || !newSource.mpn) return;
      
      const newEntry: AVLEntry = {
          id: `avl-${Date.now()}`,
          manufacturer: newSource.manufacturer,
          mpn: newSource.mpn,
          status: 'Alternate' // Default to alternate
      };

      const currentAVL = selectedNode.avl || [];
      const updatedAVL = [...currentAVL, newEntry];
      
      updateBOMNode(selectedNode.id, { avl: updatedAVL });
      setSelectedNode({ ...selectedNode, avl: updatedAVL });
      
      setNewSource({ manufacturer: '', mpn: '' });
      setIsAddingSource(false);
  };

  const handleRemoveAVL = (entryId: string) => {
      if (!canManageAVL) return;
      if (!selectedNode) return;
      const updatedAVL = (selectedNode.avl || []).filter(e => e.id !== entryId);
      updateBOMNode(selectedNode.id, { avl: updatedAVL });
      setSelectedNode({ ...selectedNode, avl: updatedAVL });
  };

  const handleSetPreferred = (entry: AVLEntry) => {
      if (!canManageAVL) return;
      if (!selectedNode) return;
      
      // Update AVL statuses
      const updatedAVL = (selectedNode.avl || []).map(e => ({
          ...e,
          status: (e.id === entry.id ? 'Preferred' : (e.status === 'Preferred' ? 'Alternate' : e.status)) as 'Preferred' | 'Alternate' | 'DoNotUse' | 'Pending'
      }));

      // Also update the root node properties for display consistency
      updateBOMNode(selectedNode.id, { 
          avl: updatedAVL,
          manufacturer: entry.manufacturer,
          mpn: entry.mpn
      });
      setSelectedNode({ 
          ...selectedNode, 
          avl: updatedAVL,
          manufacturer: entry.manufacturer,
          mpn: entry.mpn 
      });
  };

  // ... (Export/Import/Snapshot logic remains same)
  // --- Snapshot Logic ---
  const handleCreateSnapshot = () => {
    const name = prompt("Enter a name for this snapshot (e.g. 'Pre-ECO Review'):", `Snapshot ${new Date().toLocaleTimeString()}`);
    if (name) {
        createSnapshot(name);
        alert("Snapshot saved! You can now use it in the Compare module.");
    }
  };

  const handleExportCSV = () => {
    const csvContent = exportBOMToCSV(bomData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${bomData.partNumber}_BOM_Export.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };

  const handleImportClick = () => {
    if(!canEditStructure) {
        alert("You do not have permission to import BOMs.");
        return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        const text = evt.target?.result as string;
        if (text) {
            const newBOM = parseCSVToBOM(text);
            if (newBOM) {
                if (window.confirm(`Successfully parsed BOM: ${newBOM.partNumber}. This will replace your current BOM. Continue?`)) {
                    setBOMData(newBOM);
                    setSelectedNode(null);
                }
            } else {
                alert("Failed to parse CSV. Please ensure format is correct.");
            }
        }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.partNumber || !newItem.name) return;

    const newNode: BOMNode = {
        id: `new-${Date.now()}`,
        partNumber: newItem.partNumber,
        name: newItem.name,
        revision: '0.1',
        state: LifecycleState.Draft,
        type: newItem.type,
        quantity: Number(newItem.quantity),
        unit: 'EA',
        cost: Number(newItem.cost),
        currency: 'USD',
        children: []
    };

    const parentId = selectedNode ? selectedNode.id : bomData.id;
    addBOMNode(parentId, newNode);
    closeModal();
  };

  const handleAddFromLibrary = (part: LibraryPart) => {
     const newNode: BOMNode = {
        id: `lib-${Date.now()}`,
        partNumber: part.partNumber,
        name: part.description.split(',')[0], 
        description: part.description,
        revision: '1.0', 
        state: part.state, 
        type: part.type || ComponentType.Part,
        quantity: 1, 
        unit: 'EA',
        cost: part.cost,
        currency: 'USD',
        manufacturer: part.manufacturer,
        mpn: part.mpn,
        children: []
     };

     const parentId = selectedNode ? selectedNode.id : bomData.id;
     addBOMNode(parentId, newNode);
     closeModal();
  };

  const closeModal = () => {
    setIsAddModalOpen(false);
    setNewItem({
        partNumber: '',
        name: '',
        quantity: 1,
        cost: 0,
        type: ComponentType.Part
    });
    setLibrarySearch('');
  };

  const filteredLibraryParts = libraryParts.filter(p => 
    p.partNumber.toLowerCase().includes(librarySearch.toLowerCase()) || 
    p.description.toLowerCase().includes(librarySearch.toLowerCase()) ||
    p.manufacturer.toLowerCase().includes(librarySearch.toLowerCase())
  );

  return (
    <div className="flex flex-1 h-full overflow-hidden bg-slate-50 relative">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />

      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div className="flex items-center gap-2">
                 <h2 className="text-lg font-bold text-slate-800">BOM Editor</h2>
                 <span className="text-slate-400">/</span>
                 <span className="text-sm font-medium text-slate-500">{bomData.revision} (Working)</span>
            </div>
            
            <div className="flex items-center gap-2">
                 {/* View Toggle */}
                 <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 mr-2">
                    <button 
                        onClick={() => setViewMode('tree')}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all ${viewMode === 'tree' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        title="Engineering Structure View"
                    >
                        <ListTree className="w-3.5 h-3.5" />
                        Tree
                    </button>
                    <button 
                        onClick={() => setViewMode('matrix')}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all ${viewMode === 'matrix' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        title="Product Variant View"
                    >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        Matrix
                    </button>
                    <button 
                        onClick={() => setViewMode('flat')}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all ${viewMode === 'flat' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        title="Procurement & Cost View"
                    >
                        <Table2 className="w-3.5 h-3.5" />
                        Flat
                    </button>
                </div>

                <div className="h-6 w-px bg-slate-300 mx-1"></div>

                <button 
                    onClick={handleCreateSnapshot}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-colors"
                >
                    <Camera className="w-4 h-4" />
                    Snapshot
                </button>
                <div className="h-6 w-px bg-slate-300 mx-1"></div>
                <button 
                    onClick={handleImportClick}
                    className={`flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded text-sm font-medium text-slate-600 shadow-sm transition-colors ${!canEditStructure ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 hover:text-slate-900'}`}
                    disabled={!canEditStructure}
                >
                    <Upload className="w-4 h-4" />
                    Import
                </button>
                <button 
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-colors"
                >
                    <Download className="w-4 h-4" />
                    Export
                </button>
                <div className="h-6 w-px bg-slate-300 mx-1"></div>
                 <button 
                    onClick={() => setShowAI(!showAI)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium shadow-sm transition-all ${showAI ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'}`}
                >
                    <Bot className="w-4 h-4" />
                    AI Assistant
                </button>
                <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium shadow-sm transition-colors ${!canEditStructure ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    disabled={!canEditStructure}
                >
                    <Plus className="w-4 h-4" />
                    Add Item
                </button>
            </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex gap-4 overflow-hidden relative">
            {viewMode === 'tree' && (
                <BOMTable 
                    data={bomData} 
                    onSelect={handleNodeSelect}
                    selectedId={selectedNode?.id || null}
                />
            )}
            
            {viewMode === 'matrix' && (
                <BOMMatrix 
                    data={bomData} 
                    onSelect={handleNodeSelect}
                    selectedId={selectedNode?.id || null}
                />
            )}

            {viewMode === 'flat' && (
                <BOMFlatView data={bomData} />
            )}
            
            {/* Properties Panel (Right Side) */}
            {selectedNode && !showAI && viewMode !== 'flat' && (
                <div className="w-96 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
                    
                    {/* Header */}
                    <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                        <div className="flex items-start justify-between">
                            <h3 className="text-lg font-bold text-slate-800 break-words w-full mr-2">{selectedNode.partNumber}</h3>
                            <span className="flex-shrink-0 px-2 py-1 bg-slate-200 rounded text-xs font-mono text-slate-600 font-bold">
                                {selectedNode.revision}
                            </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">{selectedNode.name}</p>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-slate-200">
                        <button 
                            onClick={() => setDetailsTab('info')}
                            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
                                detailsTab === 'info' 
                                ? 'text-blue-600 border-blue-600 bg-white' 
                                : 'text-slate-500 border-transparent hover:bg-slate-50'
                            }`}
                        >
                            <Info className="w-4 h-4" />
                            Attributes
                        </button>
                        <button 
                            onClick={() => setDetailsTab('history')}
                            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
                                detailsTab === 'history' 
                                ? 'text-blue-600 border-blue-600 bg-white' 
                                : 'text-slate-500 border-transparent hover:bg-slate-50'
                            }`}
                        >
                            <History className="w-4 h-4" />
                            History
                        </button>
                    </div>

                    {/* Panel Content */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {detailsTab === 'info' ? (
                            <div className="space-y-6">
                                {/* P1 Feature: Target Cost Editing */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Cost & Budget (P1)</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 bg-slate-50 rounded border border-slate-100">
                                            <label className="text-xs text-slate-500 block mb-1 font-semibold">Actual Cost</label>
                                            <span className="font-mono font-medium text-slate-800 text-lg">
                                                {canViewCost ? `$${selectedNode.cost.toFixed(2)}` : '***'}
                                            </span>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded border border-slate-100">
                                            <label className="text-xs text-blue-600 block mb-1 font-semibold flex items-center gap-1">
                                                <Target className="w-3 h-3" /> Target Budget
                                                {!canEditCost && <Lock className="w-3 h-3 text-slate-400" />}
                                            </label>
                                            <div className="flex items-center gap-1">
                                                <span className="text-slate-500 text-sm">$</span>
                                                <input 
                                                    type="number" 
                                                    step="0.01"
                                                    disabled={!canEditCost}
                                                    value={selectedNode.targetCost || ''} 
                                                    onChange={(e) => handleUpdateField(selectedNode.id, 'targetCost', parseFloat(e.target.value))}
                                                    placeholder={canEditCost ? "-" : "***"}
                                                    className="w-full bg-white border border-slate-300 rounded px-2 py-0.5 text-sm font-mono focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    {selectedNode.targetCost && canViewCost && (
                                        <div className={`mt-2 text-xs flex items-center gap-1 ${selectedNode.cost > selectedNode.targetCost ? 'text-red-600' : 'text-green-600'}`}>
                                            <span className="font-bold">{selectedNode.cost > selectedNode.targetCost ? 'Over Budget:' : 'Under Budget:'}</span>
                                            <span>${(selectedNode.cost - selectedNode.targetCost).toFixed(2)}</span>
                                            <span>({((selectedNode.cost - selectedNode.targetCost) / selectedNode.targetCost * 100).toFixed(1)}%)</span>
                                        </div>
                                    )}
                                </div>

                                <div className="border-t border-slate-100 pt-4">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Cost & Supply</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 bg-slate-50 rounded border border-slate-100 col-span-2">
                                            <label className="text-xs text-slate-500 block mb-1 font-semibold">Quantity</label>
                                            <div className="flex items-center gap-3">
                                                <button 
                                                    onClick={() => handleUpdateQuantity(selectedNode.id, (selectedNode.quantity || 0) - 1)}
                                                    className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    disabled={selectedNode.quantity <= 0 || !canEditStructure}
                                                >
                                                    <Minus className="w-3 h-3 text-slate-600" />
                                                </button>
                                                <input 
                                                    type="number"
                                                    min="0"
                                                    disabled={!canEditStructure}
                                                    value={selectedNode.quantity}
                                                    onChange={(e) => handleUpdateQuantity(selectedNode.id, parseFloat(e.target.value) || 0)}
                                                    className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-center font-mono font-bold text-lg focus:border-blue-500 outline-none disabled:bg-slate-100"
                                                />
                                                <button 
                                                    onClick={() => handleUpdateQuantity(selectedNode.id, (selectedNode.quantity || 0) + 1)}
                                                    disabled={!canEditStructure}
                                                    className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <Plus className="w-3 h-3 text-slate-600" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded border border-slate-100">
                                            <span className="text-xs text-slate-500 block mb-1">Unit Cost</span>
                                            <span className="font-mono font-medium text-slate-800 text-lg">
                                                {canViewCost ? `$${selectedNode.cost.toFixed(2)}` : '***'}
                                            </span>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded border border-slate-100">
                                            <span className="text-xs text-slate-500 block mb-1">Lead Time</span>
                                            <span className="font-mono font-medium text-slate-800 text-lg">{selectedNode.leadTimeWeeks || '-'} <span className="text-xs font-normal text-slate-500">wks</span></span>
                                        </div>
                                    </div>
                                </div>

                                {/* P2: AVL Management */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                                        Approved Vendor List (AVL)
                                        {canManageAVL && (
                                            <button 
                                                onClick={() => setIsAddingSource(!isAddingSource)}
                                                className="text-blue-600 hover:text-blue-800 text-[10px] font-bold flex items-center gap-1"
                                            >
                                                <Plus className="w-3 h-3" /> ADD SOURCE
                                            </button>
                                        )}
                                    </h4>
                                    
                                    {isAddingSource && (
                                        <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-md animate-in fade-in zoom-in-95 duration-200">
                                            <div className="space-y-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="Manufacturer Name" 
                                                    className="w-full text-xs p-1.5 border border-blue-200 rounded"
                                                    value={newSource.manufacturer}
                                                    onChange={e => setNewSource({...newSource, manufacturer: e.target.value})}
                                                />
                                                <input 
                                                    type="text" 
                                                    placeholder="Manufacturer Part Number (MPN)" 
                                                    className="w-full text-xs p-1.5 border border-blue-200 rounded font-mono"
                                                    value={newSource.mpn}
                                                    onChange={e => setNewSource({...newSource, mpn: e.target.value})}
                                                />
                                                <div className="flex justify-end gap-2 mt-2">
                                                    <button onClick={() => setIsAddingSource(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                                                    <button onClick={handleAddAVL} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">Save</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        {(!selectedNode.avl || selectedNode.avl.length === 0) ? (
                                            <div className="text-sm text-slate-400 italic bg-slate-50 p-3 rounded border border-dashed border-slate-200 text-center">
                                                No specific manufacturers assigned.
                                            </div>
                                        ) : (
                                            selectedNode.avl.map(entry => (
                                                <div key={entry.id} className={`p-2 rounded border flex items-start justify-between group ${entry.status === 'Preferred' ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                            {entry.manufacturer}
                                                            {entry.status === 'Preferred' && <span className="bg-green-600 text-white text-[9px] px-1 rounded uppercase">Pref</span>}
                                                            {entry.status === 'Alternate' && <span className="bg-slate-200 text-slate-500 text-[9px] px-1 rounded uppercase">Alt</span>}
                                                        </div>
                                                        <div className="text-xs font-mono text-slate-500 mt-0.5">{entry.mpn}</div>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {entry.status !== 'Preferred' && canManageAVL && (
                                                            <button 
                                                                onClick={() => handleSetPreferred(entry)}
                                                                className="p-1 hover:bg-green-100 text-green-600 rounded"
                                                                title="Set as Preferred"
                                                            >
                                                                <Star className="w-3.5 h-3.5 fill-current" />
                                                            </button>
                                                        )}
                                                        {canManageAVL && (
                                                            <button 
                                                                onClick={() => handleRemoveAVL(entry.id)}
                                                                className="p-1 hover:bg-red-100 text-red-500 rounded"
                                                                title="Remove Source"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                        {/* Display legacy fields if no AVL list but fields exist */}
                                        {(!selectedNode.avl || selectedNode.avl.length === 0) && selectedNode.manufacturer && (
                                            <div className="p-2 bg-slate-50 border border-slate-200 rounded opacity-70">
                                                <div className="text-xs font-bold text-slate-600">{selectedNode.manufacturer} (Legacy)</div>
                                                <div className="text-xs font-mono text-slate-400">{selectedNode.mpn}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">RefDes & Variants (P0)</h4>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
                                                <CircuitBoard className="w-3.5 h-3.5" />
                                                Reference Designators
                                                {!canEditMetadata && <Lock className="w-3 h-3 text-slate-400" />}
                                            </label>
                                            <textarea 
                                                rows={2}
                                                disabled={!canEditMetadata}
                                                value={selectedNode.refDes || ''}
                                                onChange={(e) => handleUpdateField(selectedNode.id, 'refDes', e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono focus:border-blue-500 outline-none disabled:bg-slate-100"
                                                placeholder="e.g. R1, R2, R15"
                                            />
                                            <p className="text-[10px] text-slate-400 mt-1">Separate with commas. Required for SMT.</p>
                                        </div>
                                        <div>
                                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
                                                <Tags className="w-3.5 h-3.5" />
                                                Variant Tags
                                                {!canEditMetadata && <Lock className="w-3 h-3 text-slate-400" />}
                                            </label>
                                            <input 
                                                type="text"
                                                disabled={!canEditMetadata}
                                                value={(selectedNode.variants || []).join(', ')}
                                                onChange={(e) => handleUpdateField(selectedNode.id, 'variants', e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                                                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:border-blue-500 outline-none disabled:bg-slate-100"
                                                placeholder="e.g. Common, US-Only"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Attributes</h4>
                                    <div className="space-y-3 text-sm border-t border-slate-100 pt-2">
                                        <div className="flex justify-between items-center py-1">
                                            <span className="text-slate-500">Type</span>
                                            <span className="text-slate-800">{selectedNode.type}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-1">
                                            <span className="text-slate-500">State</span>
                                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-100 text-slate-600 border border-slate-200">{selectedNode.state}</span>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => setShowAI(true)}
                                    className="w-full mt-4 py-3 border border-blue-200 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 group"
                                >
                                    <Bot className="w-4 h-4 group-hover:text-blue-700" />
                                    Ask AI Assistant
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {selectedNode.history && selectedNode.history.length > 0 ? (
                                    <div className="relative pl-4 border-l-2 border-slate-200 space-y-8 my-2">
                                        {selectedNode.history.map((log, index) => (
                                            <div key={index} className="relative">
                                                {/* Timeline Dot */}
                                                <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 ${index === 0 ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}></div>
                                                
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-sm font-bold font-mono ${index === 0 ? 'text-blue-700' : 'text-slate-700'}`}>Rev {log.revision}</span>
                                                        {index === 0 && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">LATEST</span>}
                                                    </div>
                                                    <div className="text-xs text-slate-400 flex items-center gap-2">
                                                        <span>{log.date}</span>
                                                        <span>•</span>
                                                        <span>{log.author}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 mt-1 bg-slate-50 p-2 rounded border border-slate-100">
                                                        {log.description}
                                                    </p>
                                                    
                                                    {index > 0 && (
                                                        <button className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors w-fit">
                                                            <RotateCcw className="w-3 h-3" />
                                                            Revert to this version
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-10 text-slate-400">
                                        <History className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                        <p className="text-sm">No revision history available.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* AI Assistant Overlay/Panel */}
            {showAI && (
                <AIAssistant 
                    selectedNode={selectedNode} 
                    onClose={() => setShowAI(false)} 
                />
            )}
        </div>
      </div>

      {/* Unified Add Item Modal */}
      {isAddModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-lg shadow-xl w-[550px] border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-bold text-slate-800">Add BOM Item</h3>
                    <button 
                        onClick={closeModal}
                        className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 py-4 border-b border-slate-100 flex gap-4">
                     <button 
                        onClick={() => setAddMethod('library')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${addMethod === 'library' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                     >
                        <Database className="w-4 h-4" />
                        From Library
                     </button>
                     <button 
                        onClick={() => setAddMethod('custom')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${addMethod === 'custom' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                     >
                        <Box className="w-4 h-4" />
                        Create Custom
                     </button>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    <div className="p-2 bg-blue-50 border border-blue-100 rounded text-xs text-blue-700 mb-4">
                        Adding to: <span className="font-bold">{selectedNode ? `${selectedNode.partNumber} - ${selectedNode.name}` : 'Root Assembly'}</span>
                    </div>

                    {addMethod === 'library' ? (
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    autoFocus
                                    type="text" 
                                    placeholder="Search library (PN, Desc, MPN)..." 
                                    value={librarySearch}
                                    onChange={(e) => setLibrarySearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                />
                            </div>

                            <div className="space-y-2 mt-2 max-h-[300px] overflow-y-auto">
                                {filteredLibraryParts.length > 0 ? (
                                    filteredLibraryParts.map(part => (
                                        <div key={part.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-slate-800 text-sm">{part.partNumber}</span>
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 border border-slate-200">{part.mpn}</span>
                                                </div>
                                                <div className="text-sm text-slate-600 mt-0.5">{part.description}</div>
                                                <div className="text-xs text-slate-400 mt-1 flex gap-2">
                                                    <span>{part.manufacturer}</span>
                                                    <span>•</span>
                                                    <span>${part.cost}</span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleAddFromLibrary(part)}
                                                className="px-3 py-1.5 bg-white border border-slate-200 text-blue-600 text-xs font-bold rounded shadow-sm hover:bg-blue-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                Select
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-slate-400 text-sm">
                                        No matching parts found in library.
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleAddCustomItem} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Part Number *</label>
                                    <input 
                                        required
                                        type="text" 
                                        value={newItem.partNumber}
                                        onChange={(e) => setNewItem({...newItem, partNumber: e.target.value})}
                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                        placeholder="e.g. 100-2003"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Type</label>
                                    <select 
                                        value={newItem.type}
                                        onChange={(e) => setNewItem({...newItem, type: e.target.value as ComponentType})}
                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                                    >
                                        {Object.values(ComponentType).map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Name / Description *</label>
                                <input 
                                    required
                                    type="text" 
                                    value={newItem.name}
                                    onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                    placeholder="Component Name"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Quantity</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        step="1"
                                        value={newItem.quantity}
                                        onChange={(e) => setNewItem({...newItem, quantity: parseFloat(e.target.value)})}
                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Unit Cost ($)</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        step="0.01"
                                        value={newItem.cost}
                                        onChange={(e) => setNewItem({...newItem, cost: parseFloat(e.target.value)})}
                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="pt-2 flex justify-end gap-3">
                                <button 
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded border border-transparent"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm"
                                >
                                    Add Custom Item
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};