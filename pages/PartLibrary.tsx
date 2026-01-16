import React, { useState, useMemo } from 'react';
import { Search, Filter, Plus, Package, Cpu, Zap, Activity, Grid, List, MoreHorizontal, X, Edit, Save, Network, ArrowRight, MapPin } from 'lucide-react';
import { LifecycleState, LibraryPart, ComponentType, BOMNode, Permission } from '../types';
import { useAppStore } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['All', 'Semiconductors', 'Passives', 'Mechanical', 'Electromechanical', 'Software'];
const INVENTORY_LOCATIONS = ['WH-A', 'WH-B', 'WH-C']; // Correct codes to match mock data

export const PartLibrary: React.FC = () => {
  const { libraryParts, suppliers, updateLibraryPart, bomData } = useAppStore();
  const { hasPermission } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedLocations, setSelectedLocations] = useState<string[]>(INVENTORY_LOCATIONS);
  
  // Edit State
  const [selectedPart, setSelectedPart] = useState<LibraryPart | null>(null);
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<LibraryPart>>({});
  const [panelTab, setPanelTab] = useState<'details' | 'usage'>('details');

  const canEdit = hasPermission(Permission.EDIT_BOM_METADATA);

  // Where Used Calculation
  const whereUsedList = useMemo(() => {
    if (!selectedPart) return [];
    
    const results: { path: string[], parent: string, qty: number }[] = [];
    
    // Recursive search in BOM
    const search = (node: BOMNode, path: string[]) => {
        // Check if node matches selected part (by part number)
        if (node.partNumber === selectedPart.partNumber) {
            // Found a usage!
            const parentName = path.length > 0 ? path[path.length - 1] : 'Root';
            results.push({
                path: path,
                parent: parentName,
                qty: node.quantity
            });
        }
        
        if (node.children) {
            node.children.forEach(child => search(child, [...path, node.partNumber]));
        }
    };
    
    search(bomData, []);
    return results;
  }, [selectedPart, bomData]);

  // Filter Logic
  const filteredParts = useMemo(() => {
    return libraryParts.filter(part => {
      const matchesSearch = 
        part.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        part.mpn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        part.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        part.manufacturer.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'All' || part.category === selectedCategory;
      
      // Check if the part's location starts with any of the selected location prefixes
      const matchesLocation = part.category === 'Software' || selectedLocations.some(loc => part.location.startsWith(loc));

      return matchesSearch && matchesCategory && matchesLocation;
    });
  }, [searchQuery, selectedCategory, libraryParts, selectedLocations]);

  // UI Helpers
  const getCategoryIcon = (cat: string) => {
    switch(cat) {
      case 'Semiconductors': return <Cpu className="w-4 h-4 text-purple-600" />;
      case 'Passives': return <Activity className="w-4 h-4 text-amber-600" />;
      case 'Mechanical': return <Package className="w-4 h-4 text-slate-600" />;
      case 'Electromechanical': return <Zap className="w-4 h-4 text-yellow-600" />;
      default: return <Grid className="w-4 h-4 text-blue-600" />;
    }
  };

  const getStockStatus = (part: LibraryPart) => {
    if (part.category === 'Software') return <span className="text-slate-400">-</span>;
    const ratio = part.stock / part.minStock;
    let color = 'bg-emerald-500';
    if (ratio < 0.5) color = 'bg-rose-500';
    else if (ratio < 1) color = 'bg-amber-500';

    return (
      <div className="flex flex-col gap-1 w-28">
        <div className="flex justify-between text-[10px] text-slate-500 font-medium">
            <span>{part.stock.toLocaleString()}</span>
            <span className="text-slate-400">/ {part.minStock}</span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-0.5">
            <div className={`h-full ${color}`} style={{ width: `${Math.min(ratio * 100, 100)}%` }}></div>
        </div>
        <div className="flex items-center gap-1 text-[9px] text-slate-400">
             <MapPin className="w-3 h-3" />
             <span className="font-mono">{part.location}</span>
        </div>
      </div>
    );
  };

  const getLifecycleBadge = (state: LifecycleState) => {
    const styles = {
      [LifecycleState.Released]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      [LifecycleState.Draft]: 'bg-slate-100 text-slate-600 border-slate-200',
      [LifecycleState.InReview]: 'bg-amber-100 text-amber-700 border-amber-200',
      [LifecycleState.Obsolete]: 'bg-rose-100 text-rose-700 border-rose-200',
      [LifecycleState.Prototype]: 'bg-purple-100 text-purple-700 border-purple-200',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${styles[state]}`}>
        {state}
      </span>
    );
  };

  const getSupplierName = (supplierId?: string) => {
    if (!supplierId) return <span className="text-slate-400 italic">Unassigned</span>;
    const s = suppliers.find(sup => sup.id === supplierId);
    return s ? s.name : <span className="text-slate-400 italic">Unknown</span>;
  };

  const handleEditClick = (part: LibraryPart) => {
      setSelectedPart(part);
      setEditForm(part);
      setPanelTab('details');
      setIsEditPanelOpen(true);
  };

  const handleSave = () => {
      if (selectedPart && editForm) {
          updateLibraryPart(selectedPart.id, editForm);
          setIsEditPanelOpen(false);
      }
  };

  const toggleLocation = (loc: string) => {
      if (selectedLocations.includes(loc)) {
          setSelectedLocations(selectedLocations.filter(l => l !== loc));
      } else {
          setSelectedLocations([...selectedLocations, loc]);
      }
  };

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden relative">
      {/* Sidebar Filters */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-200">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                Library Filters
            </h2>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Categories</h3>
            <div className="space-y-1">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded transition-colors ${
                            selectedCategory === cat 
                            ? 'bg-blue-50 text-blue-700 font-medium' 
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            {cat !== 'All' && getCategoryIcon(cat)}
                            {cat}
                        </span>
                        {cat === 'All' && <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{libraryParts.length}</span>}
                    </button>
                ))}
            </div>

            <div className="mt-8">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Inventory Locations</h3>
                 <div className="space-y-2">
                    {INVENTORY_LOCATIONS.map(loc => (
                         <label key={loc} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900">
                            <input 
                                type="checkbox" 
                                checked={selectedLocations.includes(loc)}
                                onChange={() => toggleLocation(loc)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                            />
                            {loc} Zone
                         </label>
                    ))}
                 </div>
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
         {/* Toolbar */}
        <div className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between flex-shrink-0">
             <div className="relative w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Search by Part Number, MPN, Description..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
             </div>
             <div className="flex items-center gap-3">
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button 
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <List className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Grid className="w-4 h-4" />
                    </button>
                </div>
                {canEdit && (
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
                        <Plus className="w-4 h-4" />
                        Create Part
                    </button>
                )}
             </div>
        </div>

        {/* Data View */}
        <div className="flex-1 overflow-auto bg-slate-50/50 p-6">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 w-48">Part Number</th>
                            <th className="px-6 py-3 w-48">MPN</th>
                            <th className="px-6 py-3">Description</th>
                            <th className="px-6 py-3 w-40">Supplier</th>
                            <th className="px-6 py-3 w-32">Category</th>
                            <th className="px-6 py-3 w-32 text-right">Cost</th>
                            <th className="px-6 py-3 w-40">Inventory</th>
                            <th className="px-6 py-3 w-32">State</th>
                            <th className="px-6 py-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredParts.length > 0 ? filteredParts.map((part) => (
                            <tr 
                                key={part.id} 
                                className="hover:bg-blue-50/30 group transition-colors cursor-pointer"
                                onClick={() => handleEditClick(part)}
                            >
                                <td className="px-6 py-3 font-mono font-medium text-slate-700">
                                    <div className="flex items-center gap-2">
                                        {getCategoryIcon(part.category)}
                                        {part.partNumber}
                                    </div>
                                </td>
                                <td className="px-6 py-3 font-mono text-xs text-slate-500 bg-slate-50/50">
                                    <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">{part.mpn}</span>
                                </td>
                                <td className="px-6 py-3 text-slate-700">
                                    <div className="font-medium">{part.description.split(',')[0]}</div>
                                    <div className="text-xs text-slate-500">{part.description.split(',').slice(1).join(',')}</div>
                                </td>
                                <td className="px-6 py-3 text-slate-600">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-700">{getSupplierName(part.supplierId)}</span>
                                        <span className="text-[10px] text-slate-400">{part.manufacturer}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-3 text-slate-500">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                                        {part.category}
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-right font-mono text-slate-700">
                                    ${part.cost.toFixed(3)}
                                </td>
                                <td className="px-6 py-3">
                                    {getStockStatus(part)}
                                </td>
                                <td className="px-6 py-3">
                                    {getLifecycleBadge(part.state)}
                                </td>
                                <td className="px-6 py-3 text-right">
                                    <button 
                                        className="text-slate-400 hover:text-blue-600 transition-colors"
                                        onClick={(e) => { e.stopPropagation(); handleEditClick(part); }}
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="p-3 bg-slate-100 rounded-full">
                                            <Search className="w-6 h-6 text-slate-300" />
                                        </div>
                                        <p>No parts found matching your filters.</p>
                                        <button 
                                            onClick={() => {setSearchQuery(''); setSelectedCategory('All');}}
                                            className="text-blue-600 text-sm font-medium hover:underline"
                                        >
                                            Clear filters
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>

      {/* Edit/Usage Slide-over Panel */}
      {isEditPanelOpen && selectedPart && (
          <div className="absolute right-0 top-0 h-full w-[400px] bg-white border-l border-slate-200 shadow-2xl z-20 flex flex-col animate-in slide-in-from-right duration-300">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                  <div>
                      <h3 className="font-bold text-slate-800 text-lg">Edit Part</h3>
                      <p className="text-xs text-slate-500 font-mono">{selectedPart.partNumber}</p>
                  </div>
                  <button onClick={() => setIsEditPanelOpen(false)} className="text-slate-400 hover:text-slate-700">
                      <X className="w-5 h-5" />
                  </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-200">
                  <button 
                      onClick={() => setPanelTab('details')}
                      className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
                          panelTab === 'details' 
                          ? 'text-blue-600 border-blue-600 bg-white' 
                          : 'text-slate-500 border-transparent hover:bg-slate-50'
                      }`}
                  >
                      <Edit className="w-4 h-4" />
                      Details
                  </button>
                  <button 
                      onClick={() => setPanelTab('usage')}
                      className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
                          panelTab === 'usage' 
                          ? 'text-blue-600 border-blue-600 bg-white' 
                          : 'text-slate-500 border-transparent hover:bg-slate-50'
                      }`}
                  >
                      <Network className="w-4 h-4" />
                      Where Used <span className="text-[10px] bg-slate-200 px-1.5 rounded-full">{whereUsedList.length}</span>
                  </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {panelTab === 'details' ? (
                      <>
                        <div className={!canEdit ? 'opacity-50 pointer-events-none' : ''}>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">General Info</label>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                    <textarea 
                                        rows={2}
                                        value={editForm.description}
                                        onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                                        <select 
                                            value={editForm.category}
                                            onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                                        >
                                            {CATEGORIES.filter(c => c!=='All').map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                                        <select 
                                            value={editForm.state}
                                            onChange={(e) => setEditForm({...editForm, state: e.target.value as LifecycleState})}
                                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                                        >
                                            {Object.values(LifecycleState).map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={`pt-4 border-t border-slate-100 ${!canEdit ? 'opacity-50 pointer-events-none' : ''}`}>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Commercial & Supply</label>
                            <div className="space-y-3">
                                <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                                        <select 
                                            value={editForm.supplierId || ''}
                                            onChange={(e) => setEditForm({...editForm, supplierId: e.target.value})}
                                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                                        >
                                            <option value="">-- Select Supplier --</option>
                                            {suppliers.map(s => (
                                                <option key={s.id} value={s.id}>{s.name} ({s.country})</option>
                                            ))}
                                        </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Cost ($)</label>
                                            <input 
                                                type="number"
                                                step="0.001"
                                                value={editForm.cost}
                                                onChange={(e) => setEditForm({...editForm, cost: parseFloat(e.target.value)})}
                                                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Lead Time (Wks)</label>
                                            <input 
                                                type="number"
                                                value={editForm.leadTimeWeeks || ''}
                                                onChange={(e) => setEditForm({...editForm, leadTimeWeeks: parseFloat(e.target.value)})}
                                                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                                            />
                                        </div>
                                </div>
                                <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Manufacturer Name</label>
                                        <input 
                                            type="text"
                                            value={editForm.manufacturer}
                                            onChange={(e) => setEditForm({...editForm, manufacturer: e.target.value})}
                                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                                        />
                                </div>
                                <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">MPN</label>
                                        <input 
                                            type="text"
                                            value={editForm.mpn}
                                            onChange={(e) => setEditForm({...editForm, mpn: e.target.value})}
                                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono"
                                        />
                                </div>
                            </div>
                        </div>

                        <div className={`pt-4 border-t border-slate-100 ${!canEdit ? 'opacity-50 pointer-events-none' : ''}`}>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Inventory</label>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Current Stock</label>
                                    <input 
                                        type="number"
                                        value={editForm.stock}
                                        onChange={(e) => setEditForm({...editForm, stock: parseFloat(e.target.value)})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Min. Stock</label>
                                    <input 
                                        type="number"
                                        value={editForm.minStock}
                                        onChange={(e) => setEditForm({...editForm, minStock: parseFloat(e.target.value)})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                        {!canEdit && (
                            <div className="bg-amber-50 text-amber-700 p-3 rounded text-sm mt-4 border border-amber-200 flex items-center gap-2">
                                <Activity className="w-4 h-4" />
                                You do not have permission to edit part metadata.
                            </div>
                        )}
                      </>
                  ) : (
                      // Usage Tab Content
                      <div className="space-y-4">
                          <div className="bg-blue-50 border border-blue-100 rounded p-3 text-xs text-blue-700 mb-4">
                              This list shows all assemblies in the active BOM that directly consume this part number.
                          </div>
                          
                          {whereUsedList.length > 0 ? (
                              whereUsedList.map((usage, idx) => (
                                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded flex items-start gap-3">
                                      <div className="mt-1">
                                          <Package className="w-4 h-4 text-slate-500" />
                                      </div>
                                      <div className="flex-1">
                                          <div className="text-sm font-bold text-slate-700">{usage.parent}</div>
                                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                              <span>Qty: {usage.qty}</span>
                                              <span>•</span>
                                              <span className="font-mono">{usage.path.join(' > ')}</span>
                                          </div>
                                      </div>
                                      <button className="p-1 hover:bg-slate-200 rounded text-slate-400">
                                          <ArrowRight className="w-4 h-4" />
                                      </button>
                                  </div>
                              ))
                          ) : (
                              <div className="text-center py-8 text-slate-400 text-sm">
                                  No usages found in current BOM.
                              </div>
                          )}
                      </div>
                  )}
              </div>

              {panelTab === 'details' && canEdit && (
                <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                    <button 
                        onClick={() => setIsEditPanelOpen(false)}
                        className="px-4 py-2 border border-slate-300 rounded text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 shadow-sm flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Save Changes
                    </button>
                </div>
              )}
          </div>
      )}
    </div>
  );
};