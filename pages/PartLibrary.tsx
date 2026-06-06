import React, { useEffect, useState, useMemo } from 'react';
import { Search, Filter, Plus, Package, Cpu, Zap, Activity, Grid, List, MoreHorizontal, X, Edit, Save, Network, ArrowRight, MapPin, Scale, Coins, Trash2, Archive, Hammer, History } from 'lucide-react';
import { LifecycleState, LibraryPart, ComponentType, BOMNode, Permission, PricingTier } from '../types';
import { useAppStore } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { coreRepository } from '../repositories/core/coreRepository';

const CATEGORIES = ['All', 'Semiconductors', 'Passives', 'Mechanical', 'Electromechanical', 'Software'];
const INVENTORY_LOCATIONS = ['WH-A', 'WH-B', 'WH-C'];

export const PartLibrary: React.FC = () => {
  const { libraryParts, suppliers, updateLibraryPart, addLibraryPart, bomData } = useAppStore();
  const { currentUser, hasPermission } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLifecycle, setSelectedLifecycle] = useState<'All' | LifecycleState>('All');
  const [stockFilter, setStockFilter] = useState<'All' | 'Below minimum' | 'In stock'>('All');
  const [sortBy, setSortBy] = useState<'partNumber' | 'description' | 'supplier' | 'stock' | 'state'>('partNumber');
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
	    leadTimeWeeks: '',
	    supplierId: '',
	    moq: '',
	    spq: '',
	    stock: '0',
	    minStock: '0',
	  });
	  const [panelTab, setPanelTab] = useState<'details' | 'usage' | 'tooling' | 'audit'>('details');
	  const [createError, setCreateError] = useState('');
	  const [editError, setEditError] = useState('');
	  const [saveStatus, setSaveStatus] = useState('');
    const [toolingLinkRevision, setToolingLinkRevision] = useState(0);
    const [designMasterLinkId, setDesignMasterLinkId] = useState('');

  const canEditMetadata = hasPermission(Permission.EDIT_BOM_METADATA);
  const canViewCommercial = hasPermission(Permission.VIEW_COMMERCIAL_FIELDS) || hasPermission(Permission.VIEW_COST);
  const canEditCommercial = hasPermission(Permission.EDIT_COMMERCIAL_FIELDS) || hasPermission(Permission.EDIT_COST);
  const canManageTooling = hasPermission(Permission.MANAGE_TOOLING);
  const canSave = canEditMetadata || canEditCommercial;

  useEffect(() => {
    const pendingSearch = window.sessionStorage.getItem('zbom.partLibrary.search');
    if (pendingSearch) {
      setSearchQuery(pendingSearch);
      setSelectedCategory('All');
      setSelectedLifecycle('All');
      setStockFilter('All');
      window.sessionStorage.removeItem('zbom.partLibrary.search');
    }

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

	  const toolingLinks = useMemo(() => {
	    if (!selectedPart) return [];
	    try {
	      return coreRepository.getToolingLinksForPart(selectedPart.id);
	    } catch {
	      return [];
	    }
	  }, [selectedPart, libraryParts, toolingLinkRevision]);

    const toolingLinkWorkspace = useMemo(() => {
      try {
        return coreRepository.loadWorkspace();
      } catch {
        return null;
      }
    }, [selectedPart, libraryParts, toolingLinkRevision]);

    const activeDesignMasters = useMemo(() => {
      if (!toolingLinkWorkspace) return [];
      return toolingLinkWorkspace.designMasterParts.filter((part) => part.projectId === toolingLinkWorkspace.activeProjectId);
    }, [toolingLinkWorkspace]);

    const linkedDesignMasters = useMemo(() => {
      if (!selectedPart || !toolingLinkWorkspace) return [];
      const linkedIds = new Set(toolingLinkWorkspace.concretePartMappings
        .filter((mapping) => mapping.partId === selectedPart.id)
        .map((mapping) => mapping.designMasterPartId));
      return activeDesignMasters.filter((part) => linkedIds.has(part.id));
    }, [activeDesignMasters, selectedPart, toolingLinkWorkspace]);

    const linkableDesignMasters = useMemo(() => {
      const linkedIds = new Set(linkedDesignMasters.map((part) => part.id));
      return activeDesignMasters.filter((part) => !linkedIds.has(part.id));
    }, [activeDesignMasters, linkedDesignMasters]);

    const selectedDesignMasterForLink = designMasterLinkId || linkableDesignMasters[0]?.id || '';

	  const auditEvents = useMemo(() => {
	    if (!selectedPart) return [];
	    try {
	      return coreRepository.getAuditEvents('part', selectedPart.id).slice(0, 8);
	    } catch {
	      return [];
	    }
	  }, [selectedPart, libraryParts]);

	  const selectedPartAvl = useMemo(() => {
	    if (!selectedPart) return [];
	    try {
	      return coreRepository.loadWorkspace().avl.filter((entry) => entry.partId === selectedPart.id);
	    } catch {
	      return [];
	    }
	  }, [selectedPart, libraryParts]);

    const getActor = () => ({
      userId: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
    });

  const getSupplierLabel = (supplierId?: string) => {
    if (!supplierId) return 'Unassigned';
    return suppliers.find((supplier) => supplier.id === supplierId)?.name ?? 'Unknown';
  };

  // Filter Logic
  const filteredParts = useMemo(() => {
    return libraryParts.filter(part => {
      const supplierName = getSupplierLabel(part.supplierId).toLowerCase();
      const matchesSearch =
        part.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        part.mpn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        part.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        part.manufacturer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supplierName.includes(searchQuery.toLowerCase());

      const matchesCategory = selectedCategory === 'All' || part.category === selectedCategory;
      const matchesLifecycle = selectedLifecycle === 'All' || part.state === selectedLifecycle;
      const matchesLocation = part.category === 'Software' || selectedLocations.some(loc => part.location.startsWith(loc));
      const belowMinimum = part.category !== 'Software' && part.stock < part.minStock;
      const matchesStock = stockFilter === 'All' || (stockFilter === 'Below minimum' ? belowMinimum : !belowMinimum);

      return matchesSearch && matchesCategory && matchesLifecycle && matchesLocation && matchesStock;
    }).sort((left, right) => {
      const compareText = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
      switch (sortBy) {
        case 'description':
          return compareText(left.description, right.description);
        case 'supplier':
          return compareText(getSupplierLabel(left.supplierId), getSupplierLabel(right.supplierId));
        case 'stock':
          return left.stock - right.stock;
        case 'state':
          return compareText(left.state, right.state);
        case 'partNumber':
        default:
          return compareText(left.partNumber, right.partNumber);
      }
    });
  }, [searchQuery, selectedCategory, selectedLifecycle, stockFilter, sortBy, libraryParts, selectedLocations, suppliers]);

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
      setEditError('');
      setPanelTab('details');
      setIsEditPanelOpen(true);
  };

	  const validatePricingTiers = (tiers?: PricingTier[]) => {
	      if (!tiers || tiers.length === 0) return '';
	      const seenMinQty = new Set<number>();
	      for (const tier of tiers) {
	          if (!Number.isFinite(tier.minQty) || tier.minQty < 0) return 'Pricing tier minimum quantity must be zero or greater.';
	          if (!Number.isFinite(tier.price) || tier.price < 0) return 'Pricing tier price must be zero or greater.';
	          if (seenMinQty.has(tier.minQty)) return 'Pricing tiers cannot reuse the same minimum quantity.';
	          seenMinQty.add(tier.minQty);
	      }
	      return '';
	  };

	  const handleSave = () => {
	      if (selectedPart && editForm) {
	          const tierError = validatePricingTiers(editForm.pricingTiers);
	          if (tierError) {
	              setEditError(tierError);
	              return;
	          }
	          updateLibraryPart(selectedPart.id, editForm);
	          setSaveStatus(`Saved ${selectedPart.partNumber}. BOM and Tooling links will read the updated master data.`);
	          setIsEditPanelOpen(false);
	      }
	  };

	  const handleArchivePart = () => {
	      if (!selectedPart) return;
	      if (!window.confirm(`Archive ${selectedPart.partNumber}? Existing BOM usage remains traceable.`)) return;
	      updateLibraryPart(selectedPart.id, { state: LifecycleState.Obsolete, stock: 0 });
	      setSaveStatus(`Archived ${selectedPart.partNumber}.`);
	      setIsEditPanelOpen(false);
	  };

    const handleLinkDesignMaster = () => {
      if (!selectedPart || !selectedDesignMasterForLink) return;
      const designMaster = activeDesignMasters.find((part) => part.id === selectedDesignMasterForLink);
      try {
        coreRepository.mapConcretePart(selectedDesignMasterForLink, selectedPart.id, getActor());
        setToolingLinkRevision((value) => value + 1);
        setDesignMasterLinkId('');
        setSaveStatus(`Linked ${selectedPart.partNumber} to ${designMaster?.code ?? 'design master'}.`);
        setEditError('');
      } catch (error) {
        setEditError(error instanceof Error ? error.message : 'Unable to link design master.');
      }
    };

    const handleUnlinkDesignMaster = (designMasterId: string) => {
      if (!selectedPart) return;
      const designMaster = activeDesignMasters.find((part) => part.id === designMasterId);
      try {
        coreRepository.unmapConcretePart(designMasterId, selectedPart.id, getActor());
        setToolingLinkRevision((value) => value + 1);
        setSaveStatus(`Unlinked ${selectedPart.partNumber} from ${designMaster?.code ?? 'design master'}.`);
        setEditError('');
      } catch (error) {
        setEditError(error instanceof Error ? error.message : 'Unable to unlink design master.');
      }
    };

    const openToolingHubForTooling = (toolingId: string) => {
      window.sessionStorage.setItem('zbom.toolingHub.toolingId', toolingId);
      window.sessionStorage.setItem('zbom.toolingHub.tab', 'overview');
      window.dispatchEvent(new CustomEvent('zbom:navigate', { detail: { page: 'tooling' } }));
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
	    if (libraryParts.some((part) => part.partNumber.toLowerCase() === partNumber.toLowerCase())) {
	      setCreateError(`Part number ${partNumber} already exists.`);
	      return;
	    }

	    const cost = Number(createForm.cost);
	    const leadTimeWeeks = Number(createForm.leadTimeWeeks);
	    const moq = Number(createForm.moq);
	    const spq = Number(createForm.spq);
	    const stock = Number(createForm.stock);
	    const minStock = Number(createForm.minStock);
	    addLibraryPart({
	      id: `lib-${partNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      partNumber,
      mpn,
      manufacturer: createForm.manufacturer.trim() || 'Unassigned',
      description,
      category: createForm.category,
	      cost: Number.isFinite(cost) && cost >= 0 ? cost : 0,
	      stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
	      minStock: Number.isFinite(minStock) && minStock >= 0 ? minStock : 0,
	      state: LifecycleState.Draft,
	      location: createForm.category === 'Software' ? 'Git/Repo' : 'WH-A-NEW',
	      type: createForm.category === 'Software' ? ComponentType.Software : ComponentType.Part,
	      supplierId: createForm.supplierId || undefined,
	      leadTimeWeeks: Number.isFinite(leadTimeWeeks) && leadTimeWeeks >= 0 ? leadTimeWeeks : undefined,
	      moq: Number.isFinite(moq) && moq >= 0 ? moq : undefined,
	      spq: Number.isFinite(spq) && spq >= 0 ? spq : undefined,
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
	      leadTimeWeeks: '',
	      supplierId: '',
	      moq: '',
	      spq: '',
	      stock: '0',
	      minStock: '0',
	    });
	    setCreateError('');
	    setSaveStatus(`Created ${partNumber} in Part Library.`);
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
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Lifecycle</h3>
                 <div className="space-y-1">
                    {(['All', ...Object.values(LifecycleState)] as Array<'All' | LifecycleState>).map((state) => (
                         <button
                            key={state}
                            type="button"
                            onClick={() => setSelectedLifecycle(state)}
                            className={`w-full rounded px-3 py-2 text-left text-sm ${
                                selectedLifecycle === state
                                ? 'bg-blue-50 font-medium text-blue-700'
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                         >
                            {state}
                         </button>
                    ))}
                 </div>
            </div>

            <div className="mt-8">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Stock Status</h3>
                 <div className="space-y-1">
                    {(['All', 'Below minimum', 'In stock'] as const).map((status) => (
                         <button
                            key={status}
                            type="button"
                            onClick={() => setStockFilter(status)}
                            className={`w-full rounded px-3 py-2 text-left text-sm ${
                                stockFilter === status
                                ? 'bg-blue-50 font-medium text-blue-700'
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                         >
                            {status}
                         </button>
                    ))}
                 </div>
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
	                {saveStatus && <span className="text-xs font-semibold text-emerald-700">{saveStatus}</span>}
	                <label className="flex items-center gap-2 text-xs font-semibold text-slate-500" htmlFor="part-sort">
	                    Sort
	                    <select
	                        id="part-sort"
	                        aria-label="Sort parts"
	                        value={sortBy}
	                        onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
	                        className="rounded border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"
	                    >
	                        <option value="partNumber">Part No.</option>
	                        <option value="description">Description</option>
	                        <option value="supplier">Supplier</option>
	                        <option value="stock">Stock</option>
	                        <option value="state">Lifecycle</option>
	                    </select>
	                </label>
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
                                            onClick={() => {setSearchQuery(''); setSelectedCategory('All'); setSelectedLifecycle('All'); setStockFilter('All');}}
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
	                      <div className="grid gap-4 md:grid-cols-2">
	                          <label className="block text-sm font-semibold text-slate-700" htmlFor="create-supplier">
	                              Supplier
	                              <select
	                                id="create-supplier"
	                                value={createForm.supplierId}
	                                onChange={(event) => setCreateForm((value) => ({ ...value, supplierId: event.target.value }))}
	                                className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
	                              >
	                                  <option value="">Unassigned</option>
	                                  {suppliers.map((supplier) => (
	                                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
	                                  ))}
	                              </select>
	                          </label>
	                          <label className="block text-sm font-semibold text-slate-700" htmlFor="create-lead-time">
	                              Lead Time (Wks)
	                              <input
	                                id="create-lead-time"
	                                type="number"
	                                value={createForm.leadTimeWeeks}
	                                onChange={(event) => setCreateForm((value) => ({ ...value, leadTimeWeeks: event.target.value }))}
	                                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
	                              />
	                          </label>
	                          <label className="block text-sm font-semibold text-slate-700" htmlFor="create-moq">
	                              MOQ
	                              <input
	                                id="create-moq"
	                                type="number"
	                                value={createForm.moq}
	                                onChange={(event) => setCreateForm((value) => ({ ...value, moq: event.target.value }))}
	                                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
	                              />
	                          </label>
	                          <label className="block text-sm font-semibold text-slate-700" htmlFor="create-spq">
	                              SPQ
	                              <input
	                                id="create-spq"
	                                type="number"
	                                value={createForm.spq}
	                                onChange={(event) => setCreateForm((value) => ({ ...value, spq: event.target.value }))}
	                                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
	                              />
	                          </label>
	                      </div>
	                      {createError && (
	                        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
	                          {createError}
	                        </div>
	                      )}
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
	                  <button
	                      onClick={() => setPanelTab('tooling')}
	                      className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
	                          panelTab === 'tooling'
	                          ? 'text-blue-600 border-blue-600 bg-white'
	                          : 'text-slate-500 border-transparent hover:bg-slate-50'
	                      }`}
	                  >
	                      <Hammer className="w-4 h-4" />
	                      Tooling <span className="text-[10px] bg-slate-200 px-1.5 rounded-full">{toolingLinks.length}</span>
	                  </button>
	                  <button
	                      onClick={() => setPanelTab('audit')}
	                      className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${
	                          panelTab === 'audit'
	                          ? 'text-blue-600 border-blue-600 bg-white'
	                          : 'text-slate-500 border-transparent hover:bg-slate-50'
	                      }`}
	                  >
	                      <History className="w-4 h-4" />
	                      Audit
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

                                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                                    <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">AVL / Supplier Status</div>
                                    {selectedPartAvl.length > 0 ? selectedPartAvl.map((entry) => (
                                        <div key={entry.id} className="flex items-center justify-between rounded bg-white px-3 py-2 text-xs">
                                            <div>
                                                <div className="font-bold text-slate-700">{getSupplierLabel(entry.supplierId)}</div>
                                                <div className="font-mono text-slate-500">{entry.manufacturer} · {entry.mpn}</div>
                                            </div>
                                            <span className="rounded-full bg-emerald-50 px-2 py-1 font-bold text-emerald-700">{entry.status}</span>
                                        </div>
                                    )) : (
                                        <div className="text-xs text-slate-400">No AVL record yet. Assigning a supplier creates the current preferred supplier context.</div>
                                    )}
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
	                        {editError && (
	                            <div className="bg-rose-50 text-rose-700 p-3 rounded text-sm mt-4 border border-rose-200 flex items-center gap-2">
	                                <Activity className="w-4 h-4" />
	                                {editError}
	                            </div>
	                        )}
                      </>
	                  ) : panelTab === 'usage' ? (
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
	                  ) : panelTab === 'tooling' ? (
	                      <div className="space-y-4">
	                          <div className="bg-emerald-50 border border-emerald-100 rounded p-3 text-xs text-emerald-700">
	                              Tooling links are resolved through design-master to concrete part mappings in the durable core repository.
	                          </div>
                            <div className="rounded border border-slate-200 bg-white p-3">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-bold text-slate-800">Tooling Link Editor</div>
                                        <div className="text-xs text-slate-500">Map this concrete part to active-project design masters.</div>
                                    </div>
                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                                        {linkedDesignMasters.length} linked
                                    </span>
                                </div>

                                {linkedDesignMasters.length > 0 && (
                                    <div className="mb-3 space-y-2">
                                        {linkedDesignMasters.map((designMaster) => (
                                            <div key={designMaster.id} className="flex items-center justify-between gap-3 rounded bg-slate-50 px-3 py-2 text-xs">
                                                <div>
                                                    <div className="font-bold text-slate-700">{designMaster.code}</div>
                                                    <div className="text-slate-500">{designMaster.name}</div>
                                                </div>
                                                {canManageTooling && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUnlinkDesignMaster(designMaster.id)}
                                                        className="rounded border border-rose-200 bg-white px-2 py-1 font-bold text-rose-700 hover:bg-rose-50"
                                                    >
                                                        Unlink
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {canManageTooling ? (
                                    <div className="flex gap-2">
                                        <select
                                            aria-label="Design master to link"
                                            value={selectedDesignMasterForLink}
                                            onChange={(event) => setDesignMasterLinkId(event.target.value)}
                                            disabled={linkableDesignMasters.length === 0}
                                            className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                                        >
                                            {linkableDesignMasters.length === 0 ? (
                                                <option value="">No available design masters</option>
                                            ) : linkableDesignMasters.map((designMaster) => (
                                                <option key={designMaster.id} value={designMaster.id}>
                                                    {designMaster.code} - {designMaster.name}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={handleLinkDesignMaster}
                                            disabled={!selectedDesignMasterForLink}
                                            className="rounded bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                        >
                                            Link
                                        </button>
                                    </div>
                                ) : (
                                    <div className="rounded bg-slate-50 px-3 py-2 text-xs text-slate-500">
                                        You can inspect tooling links, but you do not have permission to edit them.
                                    </div>
                                )}
                            </div>
	                          {toolingLinks.length > 0 ? toolingLinks.map((tooling) => (
	                              <div key={tooling.id} className="rounded border border-slate-200 bg-slate-50 p-3">
	                                  <div className="flex items-start justify-between gap-3">
                                        <div>
	                                        <div className="text-sm font-bold text-slate-800">{tooling.name}</div>
	                                        <div className="mt-1 text-xs text-slate-500">
	                                            {tooling.supplier ?? 'Supplier TBD'} · {tooling.cavityCount ? `${tooling.cavityCount} cavities` : 'Cavity TBD'}
	                                        </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => openToolingHubForTooling(tooling.id)}
                                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-50"
                                        >
                                          <Hammer className="h-3.5 w-3.5" />
                                          Open in Tooling Hub
                                        </button>
	                                  </div>
	                              </div>
	                          )) : (
	                              <div className="text-center py-8 text-slate-400 text-sm">
	                                  No tooling links for this part.
	                              </div>
	                          )}
	                      </div>
	                  ) : (
	                      <div className="space-y-4">
	                          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs text-slate-600">
	                              Audit events are written by the durable core repository for create, update, archive, and relationship actions.
	                          </div>
	                          {auditEvents.length > 0 ? auditEvents.map((event) => (
	                              <div key={event.id} className="rounded border border-slate-200 bg-white p-3">
	                                  <div className="text-sm font-bold text-slate-800">{event.summary}</div>
	                                  <div className="mt-1 text-xs text-slate-500">
	                                      {event.sourceModule} · {event.actor.name} · {new Date(event.timestamp).toLocaleString()}
	                                  </div>
	                              </div>
	                          )) : (
	                              <div className="text-center py-8 text-slate-400 text-sm">
	                                  No audit events for this part yet.
	                              </div>
	                          )}
	                      </div>
	                  )}
	              </div>

	              {panelTab === 'details' && canSave && (
	                <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-between gap-3">
	                    {canEditMetadata ? (
	                        <button
	                            type="button"
	                            onClick={handleArchivePart}
	                            className="inline-flex items-center gap-2 rounded border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
	                        >
	                            <Archive className="h-4 w-4" />
	                            Archive
	                        </button>
	                    ) : <span />}
	                    <div className="flex gap-3">
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
	                </div>
	              )}
          </div>
      )}
    </div>
  );
};
