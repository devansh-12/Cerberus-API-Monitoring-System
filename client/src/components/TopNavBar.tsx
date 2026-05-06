import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  super_admin:    'Super Admin',
  client_admin:   'Client Admin',
  client_viewer:  'Viewer',
};

const TopNavBar: React.FC = () => {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = user
    ? (user.username ?? user.email ?? '?')
        .split(/[\s@._-]/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('')
    : '?';

  const roleLabel = user ? (ROLE_LABELS[user.role] ?? user.role) : '';

  return (
    <header className="bg-slate-900/80 dark:bg-[#0F172A]/80 backdrop-blur-md font-['Space_Grotesk'] text-sm sticky top-0 z-40 border-b border-slate-800 dark:border-[#334155] flex justify-between items-center h-14 pl-8 pr-8 w-full">
      {/* Left: search */}
      <div className="flex items-center gap-6">
        <div className="relative focus-within:ring-1 focus-within:ring-[#3B82F6] rounded-DEFAULT">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input
            className="bg-surface-card border border-surface-border rounded-DEFAULT pl-10 pr-4 py-1.5 text-text-primary placeholder:text-text-secondary focus:outline-none w-64 text-body-sm font-body-sm"
            placeholder="Search resources…"
            type="text"
          />
        </div>
      </div>

      {/* Right: actions + user menu */}
      <div className="flex items-center gap-6">
        <nav className="hidden md:flex items-center gap-4">
          <button type="button" className="text-slate-400 hover:text-white transition-colors duration-200">Docs</button>
          <button type="button" className="text-slate-400 hover:text-white transition-colors duration-200">API Status</button>
        </nav>

        <div className="flex items-center gap-3 border-l border-surface-border pl-6">
          <button className="text-slate-400 hover:text-white transition-colors duration-200 relative">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-0 right-0 w-2 h-2 bg-status-error rounded-full border border-surface-background" />
          </button>

          {/* User avatar + dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              id="user-menu-btn"
              aria-label="Open user menu"
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              {/* Generated initials avatar */}
              <div className="w-8 h-8 rounded-full bg-primary/30 border border-primary/50 flex items-center justify-center text-xs font-bold text-primary select-none">
                {initials}
              </div>
              {user && (
                <div className="hidden md:flex flex-col items-start leading-none">
                  <span className="text-text-primary text-xs font-semibold truncate max-w-[100px]">{user.username ?? user.email}</span>
                  <span className="text-text-secondary text-[10px]">{roleLabel}</span>
                </div>
              )}
              <span className="material-symbols-outlined text-slate-400 text-base">expand_more</span>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-surface-card border border-surface-border rounded-lg shadow-xl z-50 overflow-hidden">
                {/* User info header */}
                <div className="px-4 py-3 border-b border-surface-border">
                  <p className="text-text-primary text-sm font-semibold truncate">{user?.username ?? user?.email}</p>
                  <p className="text-text-secondary text-xs mt-0.5 truncate">{user?.email}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                    {roleLabel}
                  </span>
                </div>

                {/* Actions */}
                <div className="py-1">
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-background transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">person</span> Profile
                  </button>
                  <button
                    type="button"
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-status-error hover:bg-status-error/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">logout</span> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopNavBar;

