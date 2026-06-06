import React from 'react';
import { Search, Bell, User, ChevronDown, Scale } from 'lucide-react';
import { Project } from '../types';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  project: Project;
  projects: Project[];
  onProjectChange: (projectId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ project, projects, onProjectChange }) => {
  const { currentUser } = useAuth();

  const roleTitles = {
    ADMIN: 'System Administrator',
    ENG_LEAD: 'Engineering Lead',
    SOURCING: 'Procurement Lead',
    VIEWER: 'Read-only Reviewer',
  } as const;

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-4 lg:px-6 flex-shrink-0 z-10">
      {/* Left: Breadcrumbs / Project Selector */}
      <div className="flex min-w-0 items-center gap-3 lg:gap-4">
        <div className="min-w-0 flex flex-col">
          <label htmlFor="active-project-select" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Project</label>
          <div className="flex items-center gap-2">
            <select
              id="active-project-select"
              aria-label="Active Project"
              value={project.id}
              onChange={(event) => onProjectChange(event.target.value)}
              className="max-w-[210px] truncate rounded-md border border-transparent bg-transparent py-0.5 pr-7 text-base font-bold text-slate-800 transition-colors hover:border-slate-200 hover:bg-slate-50 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 lg:max-w-[360px] lg:text-lg"
            >
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code}: {item.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
          </div>
        </div>
        
        <div className="hidden h-8 w-px bg-slate-200 mx-2 md:block"></div>

        <div className="hidden items-center gap-2 md:flex">
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold border border-blue-200">
                {project.phase}
            </span>
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-medium border border-slate-200">
                {project.sku}
            </span>
        </div>
        
        {/* Weight Rollup Display */}
        <div className="hidden md:flex items-center gap-2 ml-4 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full">
             <Scale className="w-4 h-4 text-slate-400" />
             <span className="text-xs font-semibold text-slate-600">
                {project.totalWeight ? `${project.totalWeight.toFixed(1)} g` : '--'}
             </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <div className="relative hidden xl:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search parts, mpn..." 
            className="pl-10 pr-4 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
        
        <button
          type="button"
          aria-label="Notifications"
          title="Notifications"
          className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </button>
        
        <div className="flex items-center gap-3 border-l border-slate-200 pl-3 sm:pl-4">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-slate-900">{currentUser.name}</div>
            <div className="text-xs text-slate-500">{roleTitles[currentUser.role]}</div>
          </div>
          <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold border border-slate-300">
            {currentUser.avatarInitials}
          </div>
        </div>
      </div>
    </header>
  );
};
