import React, { useState, useRef } from 'react';
import { BOMTable } from '../components/BOMTable';
import { BOMMatrix } from '../components/BOMMatrix';
import { BOMFlatView } from '../components/BOMFlatView';
import { AIAssistant } from '../components/AIAssistant';
import { useAppStore } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { BOMNode, ComponentType, LifecycleState, LibraryPart, AVLEntry, Permission, PricingTier } from '../types';
import { Filter, Download, Upload, Plus, Minus, Bot, History, RotateCcw, Info, X, Search, Database, Box, Camera, FileSpreadsheet, CircuitBoard, Tags, LayoutGrid, ListTree, Trash2, Check, Star, Table2, Target, Lock, ToggleLeft, ToggleRight, Scale, PackageCheck, Coins, Hash, Paperclip, FileText, Settings, FileBox } from 'lucide-react';
import { exportBOMToCSV, parseCSVToBOM } from '../utils/csvHelper';

export const BOMEditor: React.FC = () => {
  const { bomData, setBOMData, libraryParts, updateBOMNode, addBOMNode, createSnapshot, attributeDefs, addAttributeDef, addAttachment, deleteAttachment } = useAppStore();
  const { hasPermission } = useAuth();
  
  const [selectedNode, setSelectedNode] = useState<BOMNode | null>(null);
  const [showAI, setShowAI] = useState(false);
  const [detailsTab, setDetailsTab] = useState<'info' | 'history'>('info');
  const [viewMode, setViewMode] = useState<'tree' | 'matrix' | 'flat'>('tree');
  const [isMBOMView, setIsMBOMView] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Custom Attribute Modal State
  const [isAttrModalOpen, setIsAttrModalOpen] = useState(false);
  const [newAttr, setNewAttr] = useState({ name: '', key: '', type: 'text' as const });

  // Permissions Check
  const canEditStructure = hasPermission(Permission.EDIT_BOM_STRUCTURE);
  const canEditMetadata = hasPermission(Permission.EDIT_BOM_METADATA);
  const canEditCost = hasPermission(Permission.EDIT_COST);
  const canManageAttributes = hasPermission(Permission.MANAGE_ATTRIBUTES) || canEditMetadata; // Default to allow for demo

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

  // Custom Attributes Logic
  const handleUpdateAttribute = (nodeId: string, key: string, value: any) => {
      if (!selectedNode) return;
      const currentAttrs = selectedNode.customAttributes || {};
      const updatedAttrs = { ...currentAttrs, [key]: value };
      handleUpdateField(nodeId, 'customAttributes', updatedAttrs);
  };

  const handleAddAttribute = () => {
      if (!newAttr.name) return;
      // Auto-generate key if empty
      const key = newAttr.key || newAttr.name.toLowerCase().replace(/\s+/g, '_');
      addAttributeDef({
          id: `attr-${Date.now()}`,
          name: newAttr.name,
          key: key,
          type: newAttr.type
      });
      setIsAttrModalOpen(false);
      setNewAttr({ name: '', key: '', type: 'text' });
  };

  // Attachments Logic
  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0] && selectedNode) {
          addAttachment(selectedNode.id, e.target.files[0]);
          // Refetch selected node to update UI is tricky since update is async in context,
          // but we are using optimistic update pattern in a real app.
          // Here context update triggers re-render, but selectedNode needs sync.
          // Since selectedNode is a copy in state, we rely on useEffect or manual sync?
          // For simplicity, we won't manually sync local state deeply here, 
          // the user might need to re-select or we depend on a context-driven selection approach.
          // Actually, let's just assume context updates and we re-find the node.
          // Ideally, selectedId should be state, and selectedNode derived.
          // For now, let's just clear the input.
          e.target.value = '';
          
          // Hack to update local selectedNode view immediately for demo feel
          // Real app would derive selectedNode from bomData + selectedId
          // We will wait for re-render or switch node.
      }
  };

  // ... (Other handlers like Tiered Pricing kept same)
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

  // Derived selected node from BOM Data to ensure fresh data (e.g. attachments)
  const activeNode = selectedNode ? (() => {
      const findNode = (n: BOMNode): BOMNode | null => {
          if (n.id === selectedNode.id) return n;
          if (n.children) {
              for (const c of n.children) {
                  const found = findNode(c);
                  if (found) return found;
              }
          }
          return null;
      }
      return findNode(bomData) || selectedNode;
  })() : null;


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
            {activeNode && !showAI && viewMode !== 'flat' && (
                <div className="w-96 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
                    
                    {/* Header */}
                    <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                        <div className="flex items-start justify-between">
                            <h3 className="text-lg font-bold text-slate-800 break-words w-full mr-2">{activeNode.partNumber}</h3>
                            <span className="flex-shrink-0 px-2 py-1 bg-slate-200 rounded text-xs font-mono text-slate-600 font-bold">
                                {activeNode.revision}
                            </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">{activeNode.name}</p>
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
                                                value={activeNode.quantity}
                                                onChange={(e) => handleUpdateField(activeNode.id, 'quantity', parseFloat(e.target.value))}
                                                className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:border-blue-500"
                                                disabled={!canEditStructure}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Unit</label>
                                            <select 
                                                value={activeNode.unit}
                                                onChange={(e) => handleUpdateField(activeNode.id, 'unit', e.target.value)}
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
                                            value={activeNode.refDes || ''}
                                            onChange={(e) => handleUpdateField(activeNode.id, 'refDes', e.target.value)}
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
                                                    checked={activeNode.isAuxiliary || false} 
                                                    onChange={(e) => handleUpdateField(activeNode.id, 'isAuxiliary', e.target.checked)}
                                                    className="w-3 h-3 text-amber-600 rounded"
                                                />
                                                <span className="text-[10px] font-bold text-amber-700">Auxiliary (MBOM Only)</span>
                                            </label>
                                        )}
                                    </div>
                                </div>

                                <div className="border-t border-slate-200 my-2"></div>

                                {/* SECTION 2: CUSTOM ATTRIBUTES (P1 Feature) */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                            <Settings className="w-3 h-3" /> Custom Attributes
                                        </h4>
                                        {canManageAttributes && (
                                            <button 
                                                onClick={() => setIsAttrModalOpen(true)}
                                                className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded hover:bg-blue-50 hover:text-blue-600 font-bold border border-slate-200"
                                            >
                                                + Add Column
                                            </button>
                                        )}
                                    </div>
                                    
                                    <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                                        {attributeDefs.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic text-center">No custom attributes defined.</p>
                                        ) : (
                                            attributeDefs.map(def => (
                                                <div key={def.id}>
                                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">{def.name}</label>
                                                    {def.type === 'select' ? (
                                                        <select 
                                                            value={activeNode.customAttributes?.[def.key] || ''}
                                                            onChange={(e) => handleUpdateAttribute(activeNode.id, def.key, e.target.value)}
                                                            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded bg-white"
                                                            disabled={!canEditMetadata}
                                                        >
                                                            <option value="">- Select -</option>
                                                            {def.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                        </select>
                                                    ) : (
                                                        <input 
                                                            type={def.type === 'number' ? 'number' : 'text'}
                                                            value={activeNode.customAttributes?.[def.key] || ''}
                                                            onChange={(e) => handleUpdateAttribute(activeNode.id, def.key, e.target.value)}
                                                            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded"
                                                            placeholder={`Enter ${def.name.toLowerCase()}...`}
                                                            disabled={!canEditMetadata}
                                                        />
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="border-t border-slate-200 my-2"></div>

                                {/* SECTION 3: ATTACHMENTS (P1 Feature) */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                            <Paperclip className="w-3 h-3" /> Attachments
                                        </h4>
                                        <input 
                                            type="file" 
                                            ref={attachmentInputRef} 
                                            className="hidden" 
                                            onChange={handleAttachmentUpload}
                                        />
                                        {canEditMetadata && (
                                            <button 
                                                onClick={() => attachmentInputRef.current?.click()}
                                                className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded hover:bg-blue-50 hover:text-blue-600 font-bold border border-slate-200"
                                            >
                                                + Upload
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        {!activeNode.attachments || activeNode.attachments.length === 0 ? (
                                            <div className="text-center py-4 border-2 border-dashed border-slate-200 rounded text-slate-400 text-xs">
                                                No documents attached.
                                            </div>
                                        ) : (
                                            activeNode.attachments.map(att => (
                                                <div key={att.id} className="flex items-center gap-3 p-2 border border-slate-200 rounded bg-white hover:bg-slate-50 group">
                                                    <div className={`w-8 h-8 rounded flex items-center justify-center ${att.type === 'datasheet' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                                        {att.type === 'datasheet' ? <FileText className="w-4 h-4" /> : <FileBox className="w-4 h-4" />}
                                                    </div>
                                                    <div className="flex-1 overflow-hidden">
                                                        <div className="text-xs font-bold text-slate-700 truncate" title={att.name}>{att.name}</div>
                                                        <div className="text-[10px] text-slate-500">{att.size} • {att.uploadDate}</div>
                                                    </div>
                                                    <button 
                                                        onClick={() => window.open(att.url, '_blank')}
                                                        className="p-1 hover:bg-slate-200 rounded text-blue-600"
                                                        title="View"
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                    </button>
                                                    {canEditMetadata && (
                                                        <button 
                                                            onClick={() => deleteAttachment(activeNode.id, att.id)}
                                                            className="p-1 hover:bg-rose-100 rounded text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            title="Remove"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="border-t border-slate-200 my-2"></div>
                                
                                {/* SECTION 4: PART DEFINITION (Global Attributes) */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Base Attributes</h4>
                                    
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Weight (g)</label>
                                            <div className="flex items-center gap-1">
                                                <Scale className="w-3 h-3 text-slate-400" />
                                                <input 
                                                    type="number"
                                                    value={activeNode.weightG || ''}
                                                    onChange={(e) => handleUpdateField(activeNode.id, 'weightG', parseFloat(e.target.value))}
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
                                                <span className="text-sm font-mono">{activeNode.cost.toFixed(2)}</span>
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
                                                    value={activeNode.moq || ''}
                                                    onChange={(e) => handleUpdateField(activeNode.id, 'moq', parseFloat(e.target.value))}
                                                    className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm"
                                                    placeholder="Min Order"
                                                    disabled={!canEditMetadata}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 font-semibold">SPQ</label>
                                                <input 
                                                    type="number"
                                                    value={activeNode.spq || ''}
                                                    onChange={(e) => handleUpdateField(activeNode.id, 'spq', parseFloat(e.target.value))}
                                                    className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm"
                                                    placeholder="Std Pack"
                                                    disabled={!canEditMetadata}
                                                />
                                            </div>
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

      {isAttrModalOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-lg shadow-xl w-80 border border-slate-200 p-5">
                  <h3 className="font-bold text-slate-800 mb-4">Add Custom Column</h3>
                  <div className="space-y-3">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Column Name</label>
                          <input 
                              type="text" 
                              value={newAttr.name}
                              onChange={(e) => setNewAttr({ ...newAttr, name: e.target.value })}
                              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                              placeholder="e.g. Color, Voltage"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Data Type</label>
                          <select 
                              value={newAttr.type}
                              onChange={(e) => setNewAttr({ ...newAttr, type: e.target.value as any })}
                              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
                          >
                              <option value="text">Text</option>
                              <option value="number">Number</option>
                              <option value="select">Select</option>
                          </select>
                      </div>
                      <div className="flex justify-end gap-2 mt-4">
                          <button onClick={() => setIsAttrModalOpen(false)} className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 rounded text-sm">Cancel</button>
                          <button onClick={handleAddAttribute} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Add</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {isAddModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-white rounded-lg shadow-xl w-[550px] border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                 <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-bold text-slate-800">Add Item (Simulated)</h3>
                    <button onClick={() => setIsAddModalOpen(false)}><X className="w-5 h-5"/></button>
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