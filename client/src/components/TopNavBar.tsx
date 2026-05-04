import React from 'react';

const TopNavBar: React.FC = () => {
  return (
    <header className="bg-slate-900/80 dark:bg-[#0F172A]/80 backdrop-blur-md font-['Space_Grotesk'] text-sm docked full-width top-0 sticky z-40 border-b border-slate-800 dark:border-[#334155] flex justify-between items-center h-14 pl-8 pr-8 w-full">
      <div className="flex items-center gap-6">
        <div className="relative focus-within:ring-1 focus-within:ring-[#3B82F6] rounded-DEFAULT">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input className="bg-surface-card border border-surface-border rounded-DEFAULT pl-10 pr-4 py-1.5 text-text-primary placeholder:text-text-secondary focus:outline-none w-64 text-body-sm font-body-sm" placeholder="Search resources..." type="text"/>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <nav className="hidden md:flex items-center gap-4">
          <a className="text-slate-400 hover:text-white transition-colors duration-200" href="#">Docs</a>
          <a className="text-slate-400 hover:text-white transition-colors duration-200" href="#">API Status</a>
          <a className="text-slate-400 hover:text-white transition-colors duration-200" href="#">Changelog</a>
        </nav>
        <div className="flex items-center gap-4 border-l border-surface-border pl-6">
          <button className="text-slate-400 hover:text-white transition-colors duration-200 relative">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-0 right-0 w-2 h-2 bg-status-error rounded-full border border-surface-background"></span>
          </button>
          <button className="text-slate-400 hover:text-white transition-colors duration-200">
            <span className="material-symbols-outlined">help_outline</span>
          </button>
          <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded-DEFAULT font-semibold transition-colors">
            Deploy
          </button>
          <div className="w-8 h-8 rounded-full bg-surface-bright border border-surface-border overflow-hidden cursor-pointer hover:border-primary-fixed transition-colors duration-200">
            <img alt="User Avatar" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCqYzj8zPYZ0f0J9SGuT8LIewnpTBoSX18u-Fo0HV8AiedisvhAlluJdt4FLXtTAHWPD1Jfi7DBOYc3LRUBIrh4fwbhC1QT2CrA2-315NNSq_y664mkJl32joTiyqhIZlghCnN5c-UHQl7Iigbbb-Ai6LpkHJwWC4HpRu9brL87b9dxIxHjZkQquQWU31T5ZeXsdSmNU6uQLM8X1S4mKh-_p4VhpDy_kGA4frkJYxLzCSDDRass44ngnAC_yXuOFnTdDBvK3nCD2ZXb" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopNavBar;
