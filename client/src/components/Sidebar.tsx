import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar: React.FC = () => {
  return (
    <nav className="bg-slate-900 dark:bg-[#1E293B] font-['Space_Grotesk'] antialiased h-screen w-64 border-r fixed left-0 top-0 border-slate-800 dark:border-[#334155] flex flex-col py-4 z-50">
      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-on-primary">
          <span className="material-symbols-outlined font-bold text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
        </div>
        <div>
          <div className="text-xl font-bold tracking-tight text-white">Cerberus</div>
          <div className="text-text-secondary font-label-caps text-label-caps">API Guardian</div>
        </div>
      </div>

      <div className="px-4 mb-6">
        <button className="w-full bg-primary text-on-primary hover:bg-primary-fixed transition-colors duration-200 py-2 rounded-DEFAULT font-semibold flex justify-center items-center gap-2">
          <span className="material-symbols-outlined text-sm">add</span>
          <span>New Project</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        <NavLink to="/" end className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-DEFAULT transition-colors duration-200 ease-in-out ${isActive ? 'bg-slate-800 dark:bg-[#334155] text-white border-r-2 border-[#3B82F6] opacity-90' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
          <span className="material-symbols-outlined text-lg">dashboard</span>
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/traffic" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-DEFAULT transition-colors duration-200 ease-in-out ${isActive ? 'bg-slate-800 dark:bg-[#334155] text-white border-r-2 border-[#3B82F6] opacity-90' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
          <span className="material-symbols-outlined text-lg">analytics</span>
          <span>Traffic</span>
        </NavLink>
        <NavLink to="/security" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-DEFAULT transition-colors duration-200 ease-in-out ${isActive ? 'bg-slate-800 dark:bg-[#334155] text-white border-r-2 border-[#3B82F6] opacity-90' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
          <span className="material-symbols-outlined text-lg">security</span>
          <span>Security</span>
        </NavLink>
        <NavLink to="/api-keys" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-DEFAULT transition-colors duration-200 ease-in-out ${isActive ? 'bg-slate-800 dark:bg-[#334155] text-white border-r-2 border-[#3B82F6] opacity-90' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
          <span className="material-symbols-outlined text-lg">vpn_key</span>
          <span>API Keys</span>
        </NavLink>
        <NavLink to="/clients" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-DEFAULT transition-colors duration-200 ease-in-out ${isActive ? 'bg-slate-800 dark:bg-[#334155] text-white border-r-2 border-[#3B82F6] opacity-90' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
          <span className="material-symbols-outlined text-lg">group</span>
          <span>Clients</span>
        </NavLink>
        <NavLink to="/logs" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-DEFAULT transition-colors duration-200 ease-in-out ${isActive ? 'bg-slate-800 dark:bg-[#334155] text-white border-r-2 border-[#3B82F6] opacity-90' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
          <span className="material-symbols-outlined text-lg">list_alt</span>
          <span>Logs</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-DEFAULT transition-colors duration-200 ease-in-out ${isActive ? 'bg-slate-800 dark:bg-[#334155] text-white border-r-2 border-[#3B82F6] opacity-90' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
          <span className="material-symbols-outlined text-lg">settings</span>
          <span>Settings</span>
        </NavLink>
      </div>

      <div className="px-3 pt-4 border-t border-slate-800 dark:border-[#334155] mt-auto">
        <div className="space-y-1">
          <button type="button" className="flex items-center gap-3 px-3 py-2 rounded-DEFAULT text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors duration-200 ease-in-out">
            <span className="material-symbols-outlined text-lg">menu_book</span>
            <span>Documentation</span>
          </button>
          <button type="button" className="flex items-center gap-3 px-3 py-2 rounded-DEFAULT text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors duration-200 ease-in-out">
            <span className="material-symbols-outlined text-lg">contact_support</span>
            <span>Support</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;
