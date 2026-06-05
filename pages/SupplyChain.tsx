import React, { useState, useMemo } from 'react';
import { useAppStore } from '../context/AppContext';
import { ShieldCheck, AlertTriangle, Globe, Truck, MapPin, Search, Filter, MoreHorizontal, ArrowUpRight, TrendingUp, ChevronDown, ChevronRight, Package, Box } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { FeatureDialog } from '../components/FeatureDialog';

const riskData = [
  { name: 'Low Risk', value: 5, color: '#10b981' },
  { name: 'Medium Risk', value: 2, color: '#f59e0b' },
  { name: 'High Risk', value: 1, color: '#ef4444' },
];

const regionData = [
  { name: 'APAC', value: 65 },
  { name: 'NAM', value: 25 },
  { name: 'EMEA', value: 10 },
];

const CHART_INITIAL_DIMENSION = { width: 480, height: 192 };
const SUPPLIER_DETAIL_CHART_INITIAL_DIMENSION = { width: 256, height: 160 };

export const SupplyChain: React.FC = () => {
  const { suppliers, libraryParts } = useAppStore();
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);
  const [activePreview, setActivePreview] = useState<'risk' | 'audit' | null>(null);

  // Dynamically calculate parts count and other derived data
  const enrichedSuppliers = useMemo(() => {
    return suppliers.map(supplier => {
        const partsCount = libraryParts.filter(p => p.supplierId === supplier.id).length;
        return { ...supplier, partsCount };
    });
  }, [suppliers, libraryParts]);

  const filteredSuppliers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return enrichedSuppliers.filter((supplier) => {
      const matchesStatus = filterStatus === 'All'
        || supplier.status === filterStatus
        || (filterStatus === 'High Risk' && supplier.riskScore > 50);

      if (!matchesStatus) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchableText = [
        supplier.name,
        supplier.country,
        supplier.region,
        supplier.category,
        supplier.status,
        String(supplier.riskScore),
        String(supplier.leadTimeAvg),
      ].join(' ').toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [enrichedSuppliers, filterStatus, searchQuery]);

  const getRiskBadge = (score: number) => {
    if (score < 30) return <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Low ({score})</span>;
    if (score < 70) return <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">Med ({score})</span>;
    return <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">High ({score})</span>;
  };

  // KPI Calculations
  const avgRiskScore = (suppliers.reduce((acc, s) => acc + s.riskScore, 0) / suppliers.length).toFixed(1);
  const highRiskCount = suppliers.filter(s => s.riskScore > 70).length;
  const avgLeadTime = (suppliers.reduce((acc, s) => acc + s.leadTimeAvg, 0) / suppliers.length).toFixed(1);

  // Helper to get parts data for charts
  const getSupplierPartsData = (supplierId: string) => {
      const parts = libraryParts.filter(p => p.supplierId === supplierId);
      const categoryMap = new Map<string, number>();
      
      parts.forEach(p => {
          categoryMap.set(p.category, (categoryMap.get(p.category) || 0) + 1);
      });

      return Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
  };

  const toggleExpand = (id: string) => {
      setExpandedSupplierId(expandedSupplierId === id ? null : id);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-5 flex-shrink-0 sm:px-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-600" />
                    Supply Chain Intelligence
                </h1>
                <p className="text-sm text-slate-500 mt-1">Monitoring <span className="font-medium text-slate-900">{suppliers.length} active suppliers</span> across 3 regions</p>
            </div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => setActivePreview('risk')}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded text-sm font-medium shadow-sm hover:bg-slate-50 flex items-center gap-2"
                >
                    <TrendingUp className="w-4 h-4" />
                    Risk Report
                </button>
                <button
                    type="button"
                    onClick={() => setActivePreview('audit')}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium shadow-sm hover:bg-blue-700 flex items-center gap-2"
                >
                    <ShieldCheck className="w-4 h-4" />
                    Supplier Audit
                </button>
            </div>
        </div>

        {/* AI Insight Box */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
             <div className="p-2 bg-white rounded-full shadow-sm text-blue-600">
                <AlertTriangle className="w-4 h-4" />
             </div>
             <div>
                 <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-blue-900">AI Detected Potential Disruption</h3>
                    <span className="rounded-full border border-blue-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                        Simulated insight
                    </span>
                    <span className="text-[11px] font-medium text-blue-700/70">Static sample: 2026-06-04 09:00</span>
                 </div>
                 <p className="text-sm text-blue-800/80 leading-relaxed">
                    Based on recent news, there is a potential logistics delay in the <span className="font-semibold">South China Sea</span> region affecting shipments from 
                    <span className="font-semibold"> Shenzhen FastPCB</span>. Recommend increasing buffer stock for PCB assemblies by 2 weeks.
                 </p>
             </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto space-y-6 p-4 sm:p-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Avg Risk Score</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold text-slate-800">{avgRiskScore}</div>
                <div className="text-xs text-slate-400 mt-1">Out of 100 (Lower is better)</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase">High Risk Entities</span>
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-2xl font-bold text-rose-600">{highRiskCount}</div>
                <div className="text-xs text-rose-400 mt-1">Requires immediate attention</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Avg Lead Time</span>
                    <Truck className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-slate-800">{avgLeadTime} <span className="text-sm font-normal text-slate-400">wks</span></div>
                <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3 rotate-45" /> Improved 1.2 wks
                </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Single Source</span>
                    <MapPin className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold text-slate-800">14 <span className="text-sm font-normal text-slate-400">parts</span></div>
                <div className="text-xs text-slate-400 mt-1">5 Suppliers</div>
            </div>
        </div>

        {/* Charts Row */}
        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
             <div className="min-w-0 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 text-sm">Supplier Risk Distribution</h3>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="h-40 min-w-0 flex-1 sm:h-48">
                        <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INITIAL_DIMENSION}>
                            <PieChart>
                                <Pie
                                    data={riskData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={60}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {riskData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:block sm:space-y-2">
                        {riskData.map(d => (
                            <div key={d.name} className="flex items-center gap-2 text-xs">
                                <div className="w-2 h-2 rounded-full" style={{backgroundColor: d.color}}></div>
                                <span className="text-slate-600">{d.name}</span>
                                <span className="font-bold text-slate-800">{d.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
             </div>

             <div className="min-w-0 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 text-sm">Sourcing by Region</h3>
                <div className="h-48 min-w-0">
                    <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INITIAL_DIMENSION}>
                        <BarChart data={regionData} layout="vertical" margin={{top: 5, right: 30, left: 20, bottom: 5}}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={12} width={50} />
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px'}} />
                            <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
             </div>
        </div>

        {/* Suppliers Table */}
        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
                <h3 className="font-bold text-slate-800">Approved Vendor List (AVL)</h3>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative min-w-0">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-auto"
                        />
                    </div>
                    <select 
                        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-600 focus:outline-none"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="All">All Status</option>
                        <option value="Approved">Approved</option>
                        <option value="Watchlist">Watchlist</option>
                        <option value="High Risk">High Risk Only</option>
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                        <th className="w-10 px-4 py-3"></th>
                        <th className="px-6 py-3">Supplier Name</th>
                        <th className="px-6 py-3">Region</th>
                        <th className="px-6 py-3">Category</th>
                        <th className="px-6 py-3">Risk Score</th>
                        <th className="px-6 py-3">Lead Time</th>
                        <th className="px-6 py-3">Active Parts</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3 w-10"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredSuppliers.length > 0 ? filteredSuppliers.map((supplier) => {
                        const isExpanded = expandedSupplierId === supplier.id;
                        const partsData = getSupplierPartsData(supplier.id);

                        return (
                        <React.Fragment key={supplier.id}>
                            <tr 
                                className={`transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
                                onClick={() => toggleExpand(supplier.id)}
                            >
                                <td className="px-4 py-3 text-center">
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-blue-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                </td>
                                <td className="px-6 py-3 font-medium text-slate-800">{supplier.name}</td>
                                <td className="px-6 py-3 text-slate-600">
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="w-3 h-3 text-slate-400" />
                                        {supplier.country}
                                        <span className="text-xs text-slate-400 ml-1">({supplier.region})</span>
                                    </div>
                                </td>
                                <td className="px-6 py-3 text-slate-600">
                                    <span className="inline-block px-2 py-0.5 bg-slate-100 rounded text-xs font-medium text-slate-600">
                                        {supplier.category}
                                    </span>
                                </td>
                                <td className="px-6 py-3">
                                    {getRiskBadge(supplier.riskScore)}
                                </td>
                                <td className="px-6 py-3 font-mono text-slate-600">{supplier.leadTimeAvg} wks</td>
                                <td className="px-6 py-3 font-mono font-bold text-blue-600">{supplier.partsCount}</td>
                                <td className="px-6 py-3">
                                    <span className={`flex items-center gap-1.5 text-xs font-medium ${
                                        supplier.status === 'Approved' ? 'text-emerald-700' :
                                        supplier.status === 'Watchlist' ? 'text-rose-700' : 'text-amber-700'
                                    }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                            supplier.status === 'Approved' ? 'bg-emerald-500' :
                                            supplier.status === 'Watchlist' ? 'bg-rose-500' : 'bg-amber-500'
                                        }`}></span>
                                        {supplier.status}
                                    </span>
                                </td>
                                <td className="px-6 py-3">
                                    <button
                                        type="button"
                                        aria-label={`More actions for ${supplier.name}`}
                                        title={`More actions for ${supplier.name}`}
                                        className="text-slate-400 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                                    >
                                        <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                            {isExpanded && (
                                <tr className="bg-slate-50 border-b border-slate-200 shadow-inner">
                                    <td colSpan={9} className="px-6 py-4">
                                        <div className="flex min-w-[760px] gap-6">
                                            <div className="w-64 flex-shrink-0">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                    <Box className="w-4 h-4" /> Supplied Categories
                                                </h4>
                                                <div className="h-40 min-w-0 bg-white rounded border border-slate-200 p-2">
                                                    {partsData.length > 0 ? (
                                                        <ResponsiveContainer width="100%" height="100%" initialDimension={SUPPLIER_DETAIL_CHART_INITIAL_DIMENSION}>
                                                            <BarChart data={partsData} layout="vertical">
                                                                <XAxis type="number" hide />
                                                                <YAxis dataKey="name" type="category" width={90} tick={{fontSize: 10}} interval={0} />
                                                                <Tooltip cursor={{fill: '#f1f5f9'}} />
                                                                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={15} />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    ) : (
                                                        <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">No active parts linked</div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                    <Package className="w-4 h-4" /> Active Parts List
                                                </h4>
                                                <div className="bg-white rounded border border-slate-200 max-h-40 overflow-y-auto">
                                                    <table className="w-full text-xs text-left">
                                                        <thead className="bg-slate-50 text-slate-500 sticky top-0">
                                                            <tr>
                                                                <th className="px-3 py-2">Part Number</th>
                                                                <th className="px-3 py-2">MPN</th>
                                                                <th className="px-3 py-2">Description</th>
                                                                <th className="px-3 py-2 text-right">Cost</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {libraryParts.filter(p => p.supplierId === supplier.id).map(p => (
                                                                <tr key={p.id} className="hover:bg-blue-50">
                                                                    <td className="px-3 py-2 font-mono text-blue-600">{p.partNumber}</td>
                                                                    <td className="px-3 py-2 text-slate-500">{p.mpn}</td>
                                                                    <td className="px-3 py-2 text-slate-700 truncate max-w-[200px]">{p.description}</td>
                                                                    <td className="px-3 py-2 text-right font-mono">${p.cost.toFixed(2)}</td>
                                                                </tr>
                                                            ))}
                                                            {partsData.length === 0 && (
                                                                <tr>
                                                                    <td colSpan={4} className="px-3 py-4 text-center text-slate-400 italic">
                                                                        No parts found in library for this supplier.
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    )}) : (
                        <tr>
                            <td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-500">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="rounded-full bg-slate-100 p-3">
                                        <Search className="h-5 w-5 text-slate-300" />
                                    </div>
                                    <div className="font-semibold text-slate-700">No suppliers found</div>
                                    <div className="max-w-sm text-xs text-slate-400">
                                        Try a different supplier name, region, category, or status filter.
                                    </div>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
            </div>
        </div>
      </div>
      {activePreview === 'risk' && (
        <FeatureDialog title="Risk Report Preview" closeLabel="Close preview" onClose={() => setActivePreview(null)}>
            <p className="font-semibold text-slate-900">Supplier risk snapshot is generated from mock AVL data.</p>
            <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex justify-between"><span>High risk suppliers</span><span className="font-bold text-rose-600">{highRiskCount}</span></div>
                <div className="flex justify-between"><span>Average risk score</span><span className="font-bold text-slate-900">{avgRiskScore}</span></div>
                <div className="flex justify-between"><span>Average lead time</span><span className="font-bold text-slate-900">{avgLeadTime} wks</span></div>
            </div>
            <p className="text-xs text-slate-500">No live news or external supplier systems are queried in this preview.</p>
        </FeatureDialog>
      )}
      {activePreview === 'audit' && (
        <FeatureDialog title="Supplier Audit Plan" closeLabel="Close preview" onClose={() => setActivePreview(null)}>
            <p className="font-semibold text-slate-900">Next mock audit targets are prioritized by watchlist and risk score.</p>
            <ul className="space-y-2 text-sm">
                <li className="rounded-lg border border-slate-200 bg-slate-50 p-3">Shenzhen FastPCB - watchlist supplier with PCB exposure.</li>
                <li className="rounded-lg border border-slate-200 bg-slate-50 p-3">Local Metals Inc - probation supplier with mechanical parts exposure.</li>
                <li className="rounded-lg border border-slate-200 bg-slate-50 p-3">Confirm corrective action owner before production gate review.</li>
            </ul>
        </FeatureDialog>
      )}
    </div>
  );
};
