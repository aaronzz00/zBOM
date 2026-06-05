import React, { useEffect, useState, useMemo } from 'react';
import { Search, Filter, Plus, Package, Cpu, Zap, Activity, Grid, List, MoreHorizontal, X, Edit, Save, Network, ArrowRight, MapPin, Scale, Coins, Trash2 } from 'lucide-react';
import { LifecycleState, LibraryPart, ComponentType, BOMNode, Permission, PricingTier } from '../types';
import { useAppStore } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['All', 'Semiconductors', 'Passives', 'Mechanical', 'Electromechanical', 'Software'];
const INVENTORY_LOCATIONS = ['WH-A', 'WH-B', 'WH-C']; 

export const PartLibrary: React.FC = () => {
  const { libraryParts, suppliers, updateLibraryPart, addLibraryPart, bomData } = useAppStore();
  const { hasPermission } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedLocations, setSelectedLocations] = useState<string[]>(INVENTORY_LOCATIONS);
  
  // Edit State
  const [selectedPart, setSelectedPart] = useState<LibraryPart | null>(null);
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<LibraryPart>>({});
  const [createForm, setCreateForm] = useState({
    partNumber: '',
    mpn: '',
    manufacturer: '',
    description: '',
    category: 'Mechanical',
    cost: '0',
  });
  const [panelTab, setPanelTab] = useState<'details' | 'usage'>('details');

  const canEditMetadata = hasPermission(Permission.EDIT_BOM_METADATA);
  const canViewCommercial = hasPermission(Permission.VIEW_COMMERCIAL_FIELDS) || hasPermission(Permission.VIEW_COST);
  const canEditCommercial = hasPermission(Permission.EDIT_COMMERCIAL_FIELDS) || hasPermission(Permission.EDIT_COST);
  const canSave = canEditMetadata || canEditCommercial;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCreatePanelOpen(false);
        setIsEditPanelOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Where Used Calculation
  const whereUsedList = useMemo(() => {
    if (!selectedPart) return [];
    
    const results: { path: string[], parent: string, qty: number }[] = [];
    
    // Recursive search in BOM
    const search = (node: BOMNode, path: string[]) => {
        if (node.partNumber === selectedPart.partNumber) {
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
      setEditForm(JSON.parse(JSON.stringify(part))); // Deep copy for tiers
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

  const handleAddTier = () => {
    const currentTiers = editForm.pricingTiers || [];
    setEditForm({ ...editForm, pricingTiers: [...currentTiers, { minQty: 0, price: 0 }] });
  };

  const handleUpdateTier = (index: number, field: keyof PricingTier, value: number) => {
    const currentTiers = [...(editForm.pricingTiers || [])];
    currentTiers[index] = { ...currentTiers[index], [field]: value };
    setEditForm({ ...editForm, pricingTiers: currentTiers });
  };

  const handleRemoveTier = (index: number) => {
    const currentTiers = [...(editForm.pricingTiers || [])];
    currentTiers.splice(index, 1);
    setEditForm({ ...editForm, pricingTiers: currentTiers });
  };

  const handleCreatePart = () => {
    const partNumber = createForm.partNumber.trim();
    const mpn = createForm.mpn.trim();
    const description = createForm.description.trim();
    if (!partNumber || !mpn || !description) return;

    const cost = Number(createForm.cost);
    addLibraryPart({
      id: `lib-${partNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      partNumber,
      mpn,
      manufacturer: createForm.manufacturer.trim() || 'Unassigned',
      description,
      category: createForm.category,
      cost: Number.isFinite(cost) && cost >= 0 ? cost : 0,
      stock: 0,
      minStock: 0,
      state: LifecycleState.Draft,
      location: createForm.category === 'Software' ? 'Git/Repo' : 'WH-A-NEW',
      type: createForm.category === 'Software' ? ComponentType.Software : ComponentType.Part,
    });
    setSelectedCategory('All');
    setSearchQuery(partNumber);
    setCreateForm({
      partNumber: '',
      mpn: '',
      manufacturer: '',
      description: '',
      category: 'Mechanical',
      cost: '0',
    });
    setIsCreatePanelOpen(false);
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
                        type="button"
                        aria-label="Show list view"
                        title="Show list view"
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <List className="w-4 h-4" />
                    </button>
                    <button 
                        type="button"
                        aria-label="Show grid view"
                        title="Show grid view"
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Grid className="w-4 h-4" />
                    </button>
                </div>
                {canEditMetadata && (
                    <button
                        type="button"
                        onClick={() => setIsCreatePanelOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                    >
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
                                    {canViewCommercial ? `$${part.cost.toFixed(3)}` : <span className="text-slate-400 italic">Restricted</span>}
                                </td>
                                <td className="px-6 py-3">
                                    {getStockStatus(part)}
                                </td>
                                <td className="px-6 py-3">
                                    {getLifecycleBadge(part.state)}
                                </td>
                                <td className="px-6 py-3 text-right">
                                    <button 
                                        type="button"
                                        aria-label={`Edit ${part.partNumber}`}
                                        title={`Edit ${part.partNumber}`}
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

      {isCreatePanelOpen && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-library-part-title"
                className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
              >
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-5">
                      <h3 id="create-library-part-title" className="text-lg font-bold text-slate-900">Create Library Part</h3>
                      <button
                        type="button"
                        aria-label="Close create part"
                        onClick={() => setIsCreatePanelOpen(false)}
                        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                          <X className="h-5 w-5" />
                      </button>
                  </div>
                  <div className="grid gap-4 p-5">
                      <div className="grid gap-4 md:grid-cols-2">
                          <label className="block text-sm font-semibold text-slate-700" htmlFor="create-part-number">
                              Part Number
                              <input
                                id="create-part-number"
                                value={createForm.partNumber}
                                onChange={(event) => setCreateForm((value) => ({ ...value, partNumber: event.target.value }))}
                                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              />
                          </label>
                          <label className="block text-sm font-semibold text-slate-700" htmlFor="create-mpn">
                              MPN
                              <input
                                id="create-mpn"
                                value={createForm.mpn}
                                onChange={(event) => setCreateForm((value) => ({ ...value, mpn: event.target.value }))}
                                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              />
                          </label>
                          <label className="block text-sm font-semibold text-slate-700" htmlFor="create-manufacturer">
                              Manufacturer
                              <input
                                id="create-manufacturer"
                                value={createForm.manufacturer}
                                onChange={(event) => setCreateForm((value) => ({ ...value, manufacturer: event.target.value }))}
                                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                              />
                          </label>
                          <label className="block text-sm font-semibold text-slate-700" htmlFor="create-category">
                              Category
                              <select
                                id="create-category"
                                value={createForm.category}
                                onChange={(event) => setCreateForm((value) => ({ ...value, category: event.target.value }))}
                                className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                              >
                                  {CATEGORIES.filter((category) => category !== 'All').map((category) => (
                                      <option key={category} value={category}>{category}</option>
                                  ))}
                              </select>
                          </label>
                      </div>
                      <label className="block text-sm font-semibold text-slate-700" htmlFor="create-description">
                          Description
                          <textarea
                            id="create-description"
                            rows={2}
                            value={createForm.description}
                            onChange={(event) => setCreateForm((value) => ({ ...value, description: event.target.value }))}
                            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                          />
                      </label>
                      <label className="block text-sm font-semibold text-slate-700" htmlFor="create-cost">
                          Initial Unit Cost
                          <input
                            id="create-cost"
                            type="number"
                            value={createForm.cost}
                            onChange={(event) => setCreateForm((value) => ({ ...value, cost: event.target.value }))}
                            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                          />
                      </label>
                      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                          <button
                            type="button"
                            onClick={() => setIsCreatePanelOpen(false)}
                            className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                              Cancel
                          </button>
                          <button
                            type="button"
                            disabled={!createForm.partNumber.trim() || !createForm.mpn.trim() || !createForm.description.trim()}
                            onClick={handleCreatePart}
                            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                              Create Library Part
                          </button>
                      </div>
                  </div>
              </section>
          </div>
      )}

      {/* Edit/Usage Slide-over Panel */}
      {isEditPanelOpen && selectedPart && (
          <div className="absolute right-0 top-0 h-full w-[400px] bg-white border-l border-slate-200 shadow-2xl z-20 flex flex-col animate-in slide-in-from-right duration-300">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                  <div>
                      <h3 className="font-bold text-slate-800 text-lg">Edit Part</h3>
                      <p className="text-xs text-slate-500 font-mono">{selectedPart.partNumber}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close edit panel"
                    onClick={() => setIsEditPanelOpen(false)}
                    className="text-slate-400 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                  >
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
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {panelTab === 'details' ? (
                      <>
                        <div className={!canEditMetadata ? 'opacity-50' : ''}>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">General Info</label>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                    <textarea 
                                        disabled={!canEditMetadata}
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
                                            disabled={!canEditMetadata}
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
                                            disabled={!canEditMetadata}
                                            value={editForm.state}
                                            onChange={(e) => setEditForm({...editForm, state: e.target.value as LifecycleState})}
                                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                                        >
                                            {Object.values(LifecycleState).map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                                     <label className="text-xs font-bold text-slate-500 block mb-2">Physical Attributes</label>
                                     <div className="flex items-center gap-2">
                                         <Scale className="w-4 h-4 text-slate-400" />
                                         <span className="text-sm text-slate-600">Weight</span>
                                         <input 
                                            disabled={!canEditMetadata}
                                            type="number"
                                            value={editForm.weightG || ''}
                                            onChange={(e) => setEditForm({...editForm, weightG: parseFloat(e.target.value)})}
                                            placeholder="grams"
                                            className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded text-right"
                                         />
                                         <span className="text-xs text-slate-400">g</span>
                                     </div>
                                </div>
                            </div>
                        </div>

                        <div className={`pt-4 border-t border-slate-100 ${!canViewCommercial ? 'hidden' : !canEditCommercial ? 'opacity-50' : ''}`}>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Commercial & Supply</label>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label htmlFor="part-unit-cost" className="block text-sm font-medium text-slate-700 mb-1">Unit Cost ($)</label>
                                            <input 
                                                id="part-unit-cost"
                                                type="number"
                                                step="0.001"
                                                value={editForm.cost}
                                                onChange={(e) => setEditForm({...editForm, cost: parseFloat(e.target.value)})}
                                                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                                                disabled={!canEditCommercial}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="part-lead-time" className="block text-sm font-medium text-slate-700 mb-1">Lead Time (Wks)</label>
                                            <input 
                                                id="part-lead-time"
                                                type="number"
                                                value={editForm.leadTimeWeeks || ''}
                                                onChange={(e) => setEditForm({...editForm, leadTimeWeeks: parseFloat(e.target.value)})}
                                                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                                                disabled={!canEditCommercial}
                                            />
                                        </div>
                                </div>
                                <div>
                                        <label htmlFor="part-supplier" className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                                        <select 
                                            id="part-supplier"
                                            value={editForm.supplierId || ''}
                                            onChange={(e) => setEditForm({...editForm, supplierId: e.target.value})}
                                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                                            disabled={!canEditCommercial}
                                        >
                                            <option value="">-- Select Supplier --</option>
                                            {suppliers.map(s => (
                                                <option key={s.id} value={s.id}>{s.name} ({s.country})</option>
                                            ))}
                                        </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label htmlFor="part-moq" className="block text-sm font-medium text-slate-700 mb-1">MOQ</label>
                                        <input 
                                            id="part-moq"
                                            type="number"
                                            value={editForm.moq || ''}
                                            onChange={(e) => setEditForm({...editForm, moq: parseFloat(e.target.value)})}
                                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                                            disabled={!canEditCommercial}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="part-spq" className="block text-sm font-medium text-slate-700 mb-1">SPQ</label>
                                        <input 
                                            id="part-spq"
                                            type="number"
                                            value={editForm.spq || ''}
                                            onChange={(e) => setEditForm({...editForm, spq: parseFloat(e.target.value)})}
                                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                                            disabled={!canEditCommercial}
                                        />
                                    </div>
                                </div>

                                {/* Tiered Pricing Editor */}
                                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                            <Coins className="w-3 h-3" /> Tiered Pricing
                                        </label>
                                        <button onClick={handleAddTier} disabled={!canEditCommercial} className="text-[10px] text-blue-600 font-bold hover:underline disabled:text-slate-400 disabled:no-underline">+ Add Tier</button>
                                    </div>
                                    <div className="space-y-2">
                                        {(!editForm.pricingTiers || editForm.pricingTiers.length === 0) && (
                                            <div className="text-xs text-slate-400 italic text-center py-2">No tiers defined</div>
                                        )}
                                        {editForm.pricingTiers?.map((tier, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500">Qty &ge;</span>
                                                <input 
                                                    type="number" 
                                                    value={tier.minQty}
                                                    onChange={(e) => handleUpdateTier(idx, 'minQty', parseInt(e.target.value))}
                                                    className="w-16 px-1 py-0.5 text-xs border border-slate-300 rounded"
                                                    disabled={!canEditCommercial}
                                                />
                                                <span className="text-xs text-slate-500">@ $</span>
                                                <input 
                                                    type="number" 
                                                    value={tier.price}
                                                    onChange={(e) => handleUpdateTier(idx, 'price', parseFloat(e.target.value))}
                                                    className="flex-1 px-1 py-0.5 text-xs border border-slate-300 rounded"
                                                    disabled={!canEditCommercial}
                                                />
                                                <button onClick={() => handleRemoveTier(idx)} disabled={!canEditCommercial} className="text-slate-400 hover:text-red-500 disabled:hover:text-slate-400">
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={`pt-4 border-t border-slate-100 ${!canEditCommercial ? 'opacity-50' : ''}`}>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Inventory</label>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Current Stock</label>
                                    <input 
                                        disabled={!canEditCommercial}
                                        type="number"
                                        value={editForm.stock}
                                        onChange={(e) => setEditForm({...editForm, stock: parseFloat(e.target.value)})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Min. Stock</label>
                                    <input 
                                        disabled={!canEditCommercial}
                                        type="number"
                                        value={editForm.minStock}
                                        onChange={(e) => setEditForm({...editForm, minStock: parseFloat(e.target.value)})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                        {!canSave && (
                            <div className="bg-amber-50 text-amber-700 p-3 rounded text-sm mt-4 border border-amber-200 flex items-center gap-2">
                                <Activity className="w-4 h-4" />
                                You do not have permission to edit this part.
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
                                      <button
                                        type="button"
                                        aria-label={`Open usage path ${usage.parent}`}
                                        title={`Open usage path ${usage.parent}`}
                                        className="p-1 hover:bg-slate-200 rounded text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                                      >
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

              {panelTab === 'details' && canSave && (
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
