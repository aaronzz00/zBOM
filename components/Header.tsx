import React from 'react';
import { Search, Bell, User, ChevronDown } from 'lucide-react';
import { Project } from '../types';

interface HeaderProps {
  project: Project;
}

export const Header: React.FC<HeaderProps> = ({ project }) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 z-10">
      {/* Left: Breadcrumbs / Project Selector */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Project</span>
          <div className="flex items-center gap-2 cursor-pointer group">
            <h2 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
              {project.code}: {project.name}
            </h2>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>
        </div>
        
        <div className="h-8 w-px bg-slate-200 mx-2"></div>

        <div className="flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold border border-blue-200">
                {project.phase}
            </span>
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-medium border border-slate-200">
                {project.sku}
            </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search parts, mpn..." 
            className="pl-10 pr-4 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
        
        <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </button>
        
        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-slate-900">Alex Chen</div>
            <div className="text-xs text-slate-500">Sr. Product Engineer</div>
          </div>
          <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold border border-slate-300">
            AC
          </div>
        </div>
      </div>
    </header>
  );
};