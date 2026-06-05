import React from 'react';
import { LayoutDashboard, Layers, Box, Settings, Share2, Database, Cpu, GitCompare, Shield, FileSignature, Grid3X3, GitBranch, PackageSearch, Hammer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, Permission } from '../types';

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate }) => {
  const { currentUser, switchRole, hasPermission } = useAuth();
  const canShowRoleSwitcher = hasPermission(Permission.VIEW_DEMO_ROLE_SWITCHER)
    && import.meta.env.VITE_ENABLE_DEMO_ROLE_SWITCHER === 'true';

  const productionCoreItems = [
    { id: 'bom', icon: Layers, label: 'BOM Editor', requiredPerm: Permission.VIEW_BOM },
    { id: 'parts', icon: Box, label: 'Part Library', requiredPerm: Permission.VIEW_BOM },
    { id: 'tooling', icon: Hammer, label: 'Tooling Hub', requiredPerm: Permission.VIEW_BOM },
  ];

  const developmentPreviewItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', requiredPerm: Permission.VIEW_DASHBOARD },
    { id: 'product-matrix', icon: Grid3X3, label: 'Product Matrix', requiredPerm: Permission.VIEW_BOM },
    { id: 'ebom-architecture', icon: GitBranch, label: 'EBOM Architecture', requiredPerm: Permission.VIEW_BOM },
    { id: 'mbom-delta', icon: PackageSearch, label: 'MBOM Delta', requiredPerm: Permission.VIEW_BOM },
    { id: 'eco', icon: FileSignature, label: 'Change Orders', requiredPerm: Permission.VIEW_ECO },
    { id: 'compare', icon: GitCompare, label: 'Compare Revisions', requiredPerm: Permission.VIEW_BOM },
    { id: 'suppliers', icon: Share2, label: 'Supply Chain', requiredPerm: Permission.VIEW_SUPPLY_CHAIN },
    { id: 'erp', icon: Database, label: 'ERP Connect', requiredPerm: Permission.MANAGE_AVL },
  ];

  // Filter items based on permissions
  const visibleCoreItems = productionCoreItems.filter(item =>
    !item.requiredPerm || hasPermission(item.requiredPerm)
  );
  const visiblePreviewItems = developmentPreviewItems.filter(item =>
    !item.requiredPerm || hasPermission(item.requiredPerm)
  );

  const renderNavItem = (item: typeof productionCoreItems[number], developmentPreview = false) => (
    <button
      key={item.id}
      aria-label={item.label}
      onClick={() => onNavigate(item.id)}
      className={`w-full flex items-center justify-center lg:justify-start gap-3 px-3 lg:px-4 py-3 rounded-md transition-colors text-sm font-medium ${
        activePage === item.id
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
          : 'hover:bg-slate-800 hover:text-white'
      }`}
    >
      <item.icon className="w-5 h-5" />
      <span className="hidden min-w-0 flex-1 truncate text-left lg:inline">{item.label}</span>
      {developmentPreview && (
        <span className="hidden rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-200 lg:inline">
          In dev
        </span>
      )}
    </button>
  );

  return (
    <div className="w-20 lg:w-64 bg-slate-900 h-screen flex flex-col text-slate-300 flex-shrink-0 border-r border-slate-800 transition-all duration-300">
      <div className="p-4 lg:p-6 flex items-center justify-center lg:justify-start gap-3 border-b border-slate-800">
        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
          <Cpu className="text-white w-5 h-5" />
        </div>
        <span className="hidden lg:inline text-xl font-bold text-white tracking-tight">zBOM</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-1">
          <div className="hidden px-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 lg:block">Production Core</div>
          {visibleCoreItems.map((item) => renderNavItem(item))}
        </div>
        <div className="space-y-1">
          <div className="hidden px-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 lg:block">Development Preview</div>
          {visiblePreviewItems.map((item) => renderNavItem(item, true))}
        </div>
      </nav>

      {canShowRoleSwitcher && (
        <div className="px-4 pb-2">
          <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <Shield className="w-3 h-3" />
                  Simulate Role
              </div>
              <select
                  className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  value={currentUser.role}
                  onChange={(e) => switchRole(e.target.value as UserRole)}
              >
                  <option value="ADMIN">Admin (Superuser)</option>
                  <option value="ENG_LEAD">Engineer (Tech Only)</option>
                  <option value="SOURCING">Sourcing (Comm Only)</option>
                  <option value="VIEWER">Viewer (Read Only)</option>
              </select>
          </div>
        </div>
      )}

      <div className="p-4 border-t border-slate-800">
        <button
          aria-label="Settings"
          onClick={() => onNavigate('settings')}
          className="w-full flex items-center justify-center lg:justify-start gap-3 px-3 lg:px-4 py-3 rounded-md hover:bg-slate-800 hover:text-white transition-colors text-sm font-medium text-slate-400"
        >
          <Settings className="w-5 h-5" />
          <span className="hidden lg:inline">Settings</span>
          <span className="hidden rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-200 lg:inline">
            In dev
          </span>
        </button>
        <div className="mt-4 hidden px-4 text-xs text-slate-600 lg:block">
          v2.5.0 (Build 9924)<br/>
          Logged in as: <span className="text-slate-400 font-bold">{currentUser.name}</span>
        </div>
      </div>
    </div>
  );
};
