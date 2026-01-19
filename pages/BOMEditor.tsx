import React, { useState, useRef } from 'react';
import { BOMTable } from '../components/BOMTable';
import { BOMMatrix } from '../components/BOMMatrix';
import { BOMFlatView } from '../components/BOMFlatView';
import { AIAssistant } from '../components/AIAssistant';
import { useAppStore } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { BOMNode, ComponentType, LifecycleState, LibraryPart, AVLEntry, Permission, PricingTier } from '../types';
import { Filter, Download, Upload, Plus, Minus, Bot, History, RotateCcw, Info, X, Search, Database, Box, Camera, FileSpreadsheet, CircuitBoard, Tags, LayoutGrid, ListTree, Trash2, Check, Star, Table2, Target, Lock, ToggleLeft, ToggleRight, Scale, PackageCheck, Coins, Hash } from 'lucide-react';
import { exportBOMToCSV, parseCSVToBOM } from '../utils/csvHelper';

export const BOMEditor: React.FC = () => {
  const { bomData, setBOMData, libraryParts, updateBOMNode, addBOMNode, createSnapshot } = useAppStore();
  const { hasPermission } = useAuth();
  
  const [selectedNode, setSelectedNode] = useState<BOMNode | null>(null);
  const [showAI, setShowAI] = useState(false);
  const [detailsTab, setDetailsTab] = useState<'info' | 'history'>('info');
  const [viewMode, setViewMode] = useState<'tree' | 'matrix' | 'flat'>('tree');
  const [isMBOMView, setIsMBOMView] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMethod, setAddMethod] = useState<'custom' | 'library'>('library');
  const [librarySearch, setLibrarySearch] = useState('');
  
  const [newItem, setNewItem] = useState({
    partNumber: '',
    name: '',
    quantity: 1,
    cost: 0,
    type: ComponentType.Part
  });

  // Permissions Check
  const canEditStructure = hasPermission(Permission.EDIT_BOM_STRUCTURE);
  const canEditMetadata = hasPermission(Permission.EDIT_BOM_METADATA);
  const canEditCost = hasPermission(Permission.EDIT_COST);

  const handleNodeSelect = (node: BOMNode) => {
    setSelectedNode(node);
    setDetailsTab('info');
  };

  const handleUpdateField = (nodeId: string, field: keyof BOMNode, value: any) => {
      if (field === 'targetCost' && !canEditCost) return;
      if (['refDes', 'variants', 'description', 'moq', 'spq', 'weightG'].includes(field as string) && !canEditMetadata) return;

      updateBOMNode(nodeId, { [field]: value });
      if (selectedNode && selectedNode.id === nodeId) {
          setSelectedNode({ ...selectedNode, [field]: value });
      }
  };

  const handleAddTier = () => {
      if (!selectedNode || !canEditCost) return;
      const currentTiers = selectedNode.pricingTiers || [];
      const newTier: PricingTier = { minQty: 0, price: 0 };
      const updatedTiers = [...currentTiers, newTier];
      handleUpdateField(selectedNode.id, 'pricingTiers', updatedTiers);
  };

  const handleUpdateTier = (index: number, field: keyof PricingTier, value: number) => {
      if (!selectedNode || !canEditCost) return;
      const currentTiers = [...(selectedNode.pricingTiers || [])];
      currentTiers[index] = { ...currentTiers[index], [field]: value };
      currentTiers.sort((a, b) => a.minQty - b.minQty);
      handleUpdateField(selectedNode.id, 'pricingTiers', currentTiers);
  };

  const handleRemoveTier = (index: number) => {
      if (!selectedNode || !canEditCost) return;
      const currentTiers = [...(selectedNode.pricingTiers || [])];
      currentTiers.splice(index, 1);
      handleUpdateField(selectedNode.id, 'pricingTiers', currentTiers);
  }

  const handleCreateSnapshot = () => {
    const name = prompt("Enter a name for this snapshot:", `Snapshot ${new Date().toLocaleTimeString()}`);
    if (name) createSnapshot(name);
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
                if (window.confirm(`Successfully parsed BOM: ${newBOM.partNumber}. Continue?`)) {
                    setBOMData(newBOM);
                    setSelectedNode(null);
                }
            } else {
                alert("Failed to parse CSV.");
            }
        }
    };
    reader.readAsText(file);
    e.target.value = '';
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

  return (
    <div className="flex flex-1 h-full overflow-hidden bg-slate-50 relative">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />

      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div className="flex items-center gap-4">
                 <div className="flex flex-col">
                    <h2 className="text-lg font-bold text-slate-800">BOM Editor</h2>
                    <span className="text-xs font-medium text-slate-500">{bomData.revision}</span>
                 </div>
                 
                 <div className="flex items-center bg-white border border-slate-200 rounded-full p-1 shadow-sm">
                    <button 
                        onClick={() => setIsMBOMView(false)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${!isMBOMView ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        EBOM
                    </button>
                    <button 
                        onClick={() => setIsMBOMView(true)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${isMBOMView ? 'bg-amber-500 text-white' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        MBOM
                    </button>
                 </div>
            </div>
            
            <div className="flex items-center gap-2">
                 <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 mr-2">
                    <button 
                        onClick={() => setViewMode('tree')}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all ${viewMode === 'tree' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <ListTree className="w-3.5 h-3.5" />
                        Tree
                    </button>
                    <button 
                        onClick={() => setViewMode('matrix')}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all ${viewMode === 'matrix' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        Matrix
                    </button>
                    <button 
                        onClick={() => setViewMode('flat')}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all ${viewMode === 'flat' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Table2 className="w-3.5 h-3.5" />
                        Flat
                    </button>
                </div>
                
                <button onClick={handleCreateSnapshot} className="p-2 bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-50"><Camera className="w-4 h-4" /></button>
                <button onClick={handleImportClick} disabled={!canEditStructure} className="p-2 bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-50"><Upload className="w-4 h-4" /></button>
                <button onClick={handleExportCSV} className="p-2 bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-50"><Download className="w-4 h-4" /></button>
                
                <div className="h-6 w-px bg-slate-300 mx-1"></div>
                 <button 
                    onClick={() => setShowAI(!showAI)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium shadow-sm transition-all ${showAI ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'}`}
                >
                    <Bot className="w-4 h-4" />
                    AI
                </button>
                <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium shadow-sm transition-colors ${!canEditStructure ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    disabled={!canEditStructure}
                >
                    <Plus className="w-4 h-4" />
                    Add
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
                    isMBOMView={isMBOMView}
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
                        <button onClick={() => setDetailsTab('info')} className={`flex-1 py-3 text-sm font-medium ${detailsTab==='info' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>Attributes</button>
                        <button onClick={() => setDetailsTab('history')} className={`flex-1 py-3 text-sm font-medium ${detailsTab==='history' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>History</button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {detailsTab === 'info' ? (
                            <>
                                {/* SECTION 1: BOM SPECIFIC INFO (Instance Data) */}
                                <div className="bg-blue-50/50 p-3 rounded border border-blue-100">
                                    <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-3 flex items-center gap-1">
                                        <Hash className="w-3 h-3" /> BOM Usage Settings
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Quantity</label>
                                            <input 
                                                type="number"
                                                value={selectedNode.quantity}
                                                onChange={(e) => handleUpdateField(selectedNode.id, 'quantity', parseFloat(e.target.value))}
                                                className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:border-blue-500"
                                                disabled={!canEditStructure}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Unit</label>
                                            <select 
                                                value={selectedNode.unit}
                                                onChange={(e) => handleUpdateField(selectedNode.id, 'unit', e.target.value)}
                                                className="w-full px-2 py-1 text-sm border border-slate-300 rounded bg-white"
                                                disabled={!canEditMetadata}
                                            >
                                                <option value="EA">EA</option>
                                                <option value="M">M</option>
                                                <option value="KG">KG</option>
                                                <option value="L">L</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="mb-3">
                                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Ref Designators</label>
                                        <input 
                                            type="text"
                                            value={selectedNode.refDes || ''}
                                            onChange={(e) => handleUpdateField(selectedNode.id, 'refDes', e.target.value)}
                                            className="w-full px-2 py-1 text-sm border border-slate-300 rounded font-mono"
                                            placeholder="U1, R2..."
                                            disabled={!canEditMetadata}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {canEditMetadata && (
                                            <label className="flex items-center gap-2 cursor-pointer bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedNode.isAuxiliary || false} 
                                                    onChange={(e) => handleUpdateField(selectedNode.id, 'isAuxiliary', e.target.checked)}
                                                    className="w-3 h-3 text-amber-600 rounded"
                                                />
                                                <span className="text-[10px] font-bold text-amber-700">Auxiliary (MBOM Only)</span>
                                            </label>
                                        )}
                                    </div>
                                </div>

                                <div className="border-t border-slate-200 my-2"></div>

                                {/* SECTION 2: PART DEFINITION (Global Attributes) */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Part Attributes</h4>
                                    
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Weight (g)</label>
                                            <div className="flex items-center gap-1">
                                                <Scale className="w-3 h-3 text-slate-400" />
                                                <input 
                                                    type="number"
                                                    value={selectedNode.weightG || ''}
                                                    onChange={(e) => handleUpdateField(selectedNode.id, 'weightG', parseFloat(e.target.value))}
                                                    className="w-full bg-transparent text-sm font-mono focus:outline-none"
                                                    placeholder="-"
                                                    disabled={!canEditMetadata}
                                                />
                                            </div>
                                        </div>
                                         <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Unit Cost</label>
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs font-mono text-slate-500">$</span>
                                                <span className="text-sm font-mono">{selectedNode.cost.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Procurement Rules */}
                                    <div className="mb-4">
                                        <h5 className="text-[10px] font-bold text-slate-500 uppercase mb-2">Procurement Rules</h5>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs text-slate-500 font-semibold">MOQ</label>
                                                <input 
                                                    type="number"
                                                    value={selectedNode.moq || ''}
                                                    onChange={(e) => handleUpdateField(selectedNode.id, 'moq', parseFloat(e.target.value))}
                                                    className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm"
                                                    placeholder="Min Order"
                                                    disabled={!canEditMetadata}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 font-semibold">SPQ</label>
                                                <input 
                                                    type="number"
                                                    value={selectedNode.spq || ''}
                                                    onChange={(e) => handleUpdateField(selectedNode.id, 'spq', parseFloat(e.target.value))}
                                                    className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm"
                                                    placeholder="Std Pack"
                                                    disabled={!canEditMetadata}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tiered Pricing */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h5 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                                <Coins className="w-3 h-3" /> Tiered Pricing
                                            </h5>
                                            {canEditCost && (
                                                <button onClick={handleAddTier} className="text-[10px] text-blue-600 font-bold hover:underline">
                                                    + Add Tier
                                                </button>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            {(!selectedNode.pricingTiers || selectedNode.pricingTiers.length === 0) ? (
                                                <p className="text-xs text-slate-400 italic">No price breaks defined.</p>
                                            ) : (
                                                selectedNode.pricingTiers.map((tier, idx) => (
                                                    <div key={idx} className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-500">Qty &ge;</span>
                                                        <input 
                                                            type="number" 
                                                            value={tier.minQty}
                                                            onChange={(e) => handleUpdateTier(idx, 'minQty', parseInt(e.target.value))}
                                                            className="w-16 px-1 py-0.5 text-xs border border-slate-300 rounded"
                                                            disabled={!canEditCost}
                                                        />
                                                        <span className="text-xs text-slate-500">@</span>
                                                        <div className="flex items-center relative flex-1">
                                                            <span className="absolute left-1.5 text-xs text-slate-400">$</span>
                                                            <input 
                                                                type="number" 
                                                                value={tier.price}
                                                                onChange={(e) => handleUpdateTier(idx, 'price', parseFloat(e.target.value))}
                                                                className="w-full pl-4 py-0.5 text-xs border border-slate-300 rounded"
                                                                disabled={!canEditCost}
                                                            />
                                                        </div>
                                                        {canEditCost && (
                                                            <button onClick={() => handleRemoveTier(idx)} className="text-slate-400 hover:text-red-500">
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                             <div className="text-center py-10 text-slate-400">
                                <History className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">History View</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* AI Assistant Overlay */}
            {showAI && <AIAssistant selectedNode={selectedNode} onClose={() => setShowAI(false)} />}
        </div>
      </div>

      {isAddModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-white rounded-lg shadow-xl w-[550px] border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                 <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-bold text-slate-800">Add Item (Simulated)</h3>
                    <button onClick={closeModal}><X className="w-5 h-5"/></button>
                 </div>
                 <div className="p-6">
                     <p className="text-sm text-slate-500">Use existing logic to add items to tree...</p>
                 </div>
             </div>
        </div>
      )}
    </div>
  );
};