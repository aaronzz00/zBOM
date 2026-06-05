import React from 'react';
import { useAppStore } from '../context/AppContext'; 
import { useAuth } from '../context/AuthContext';
import { Permission } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, Clock, AlertTriangle, CheckCircle, Lock } from 'lucide-react';

const costData = [
  { name: 'Display', value: 45 },
  { name: 'SoC', value: 35 },
  { name: 'Memory', value: 18 },
  { name: 'Housing', value: 15 },
  { name: 'Battery', value: 12.5 },
  { name: 'Others', value: 17 },
];

const COLORS = ['#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#94a3b8'];
const CHART_INITIAL_DIMENSION = { width: 640, height: 256 };

export const Dashboard: React.FC = () => {
  const { project } = useAppStore();
  const { hasPermission } = useAuth();
  
  const canViewCost = hasPermission(Permission.VIEW_COST);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-6 xl:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Dashboard</h1>
        <p className="text-slate-500">Overview for project <span className="font-mono font-medium text-slate-700">{project.code}</span></p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Cost Card - Protected */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between relative overflow-hidden">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Total BOM Cost</p>
            {canViewCost ? (
                <>
                <h3 className="text-2xl font-bold text-slate-800">${project.totalCost.toFixed(2)}</h3>
                <span className="text-xs text-green-600 flex items-center mt-2 font-medium">
                   <TrendingDownIcon className="w-3 h-3 mr-1" /> 2.4% vs prev rev
                </span>
                </>
            ) : (
                <div className="flex items-center gap-2 mt-2 text-slate-400">
                    <Lock className="w-5 h-5" />
                    <span className="text-sm italic">Restricted</span>
                </div>
            )}
          </div>
          <div className={`p-3 rounded-lg ${canViewCost ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Longest Lead Time</p>
            <h3 className="text-2xl font-bold text-slate-800">12 Weeks</h3>
            <span className="text-xs text-slate-500 mt-2 block">Part: OLED Display</span>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Risk Items</p>
            <h3 className="text-2xl font-bold text-slate-800">3</h3>
            <span className="text-xs text-amber-600 mt-2 block font-medium">Single source components</span>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Release Readiness</p>
            <h3 className="text-2xl font-bold text-slate-800">85%</h3>
            <span className="text-xs text-slate-500 mt-2 block">12 parts in 'Draft' state</span>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-green-600">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid min-w-0 grid-cols-1 gap-6 mb-8 lg:grid-cols-2">
        {/* Cost Chart - Protected */}
        <div className="min-w-0 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center relative">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Cost Breakdown (Pareto)</h3>
          {canViewCost ? (
            <div className="h-64 min-w-0">
                <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INITIAL_DIMENSION}>
                <BarChart data={costData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" stroke="#94a3b8" fontSize={12} tickFormatter={(value) => `$${value}`} />
                    <YAxis dataKey="name" type="category" width={80} stroke="#64748b" fontSize={12} />
                    <Tooltip 
                    cursor={{fill: '#f1f5f9'}}
                    contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0'}}
                    />
                    <Bar dataKey="value" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
                </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center bg-slate-50 rounded border border-dashed border-slate-200">
                <Lock className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-slate-400 font-medium text-sm">You do not have permission to view cost analytics.</p>
            </div>
          )}
        </div>

        <div className="min-w-0 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Component Distribution</h3>
            <div className="h-64 min-w-0 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INITIAL_DIMENSION}>
                    <PieChart>
                        <Pie
                            data={costData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {costData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0'}}/>
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>
      
      {/* Recent Activity Table Mockup */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">Recent Engineering Changes (ECOs)</h3>
          </div>
          <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                  <tr>
                      <th className="px-6 py-3">ECO #</th>
                      <th className="px-6 py-3">Description</th>
                      <th className="px-6 py-3">Initiator</th>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Status</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                  <tr>
                      <td className="px-6 py-3 font-mono text-blue-600">ECO-2024-112</td>
                      <td className="px-6 py-3 text-slate-700">Replace M1.2 screws with M1.4 for durability</td>
                      <td className="px-6 py-3 text-slate-600">J. Doe</td>
                      <td className="px-6 py-3 text-slate-500">Oct 12, 2024</td>
                      <td className="px-6 py-3"><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">Approved</span></td>
                  </tr>
                  <tr>
                      <td className="px-6 py-3 font-mono text-blue-600">ECO-2024-115</td>
                      <td className="px-6 py-3 text-slate-700">Update FW Bootloader version to 1.2.0</td>
                      <td className="px-6 py-3 text-slate-600">M. Smith</td>
                      <td className="px-6 py-3 text-slate-500">Oct 14, 2024</td>
                      <td className="px-6 py-3"><span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-bold">Pending</span></td>
                  </tr>
              </tbody>
          </table>
      </div>
    </div>
  );
};

const TrendingDownIcon = ({className}: {className?: string}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
)
