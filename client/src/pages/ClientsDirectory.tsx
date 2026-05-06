import React from 'react';
import { useNavigate } from 'react-router-dom';

const ClientsDirectory: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-headline-md text-headline-md text-text-primary mb-1">Clients Directory</h2>
          <p className="font-body-base text-body-base text-text-secondary">Manage external consumer organizations and their API access.</p>
        </div>
        <button className="bg-primary text-on-primary px-4 py-2 rounded-DEFAULT font-body-sm text-body-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity">
          <span className="material-symbols-outlined text-[18px]">add_business</span>
          <span>Onboard New Client</span>
        </button>
      </div>

      <div className="flex items-center justify-between mb-4 bg-surface-card p-4 rounded-DEFAULT border border-surface-border">
        <div className="flex items-center gap-4">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">filter_list</span>
            <select className="appearance-none bg-surface-background border-surface-border text-text-primary rounded-DEFAULT pl-10 pr-8 py-1.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-body-sm font-body-sm cursor-pointer">
              <option>All Statuses</option>
              <option>Active</option>
              <option>Suspended</option>
              <option>Pending</option>
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
          </div>
          <div className="relative">
            <select className="appearance-none bg-surface-background border-surface-border text-text-primary rounded-DEFAULT pl-4 pr-8 py-1.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-body-sm font-body-sm cursor-pointer">
              <option>Sort by: Newest</option>
              <option>Sort by: Name A-Z</option>
              <option>Sort by: User Count</option>
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
          </div>
        </div>
        <div className="text-body-sm font-body-sm text-text-secondary">
          Showing <span className="text-text-primary font-medium">1-10</span> of <span className="text-text-primary font-medium">142</span> clients
        </div>
      </div>

      <div className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-background/50 border-b border-surface-border">
              <th className="font-label-caps text-label-caps text-text-secondary py-3 px-4 w-1/4">Name</th>
              <th className="font-label-caps text-label-caps text-text-secondary py-3 px-4">Slug</th>
              <th className="font-label-caps text-label-caps text-text-secondary py-3 px-4 text-right">User Count</th>
              <th className="font-label-caps text-label-caps text-text-secondary py-3 px-4">Created Date</th>
              <th className="font-label-caps text-label-caps text-text-secondary py-3 px-4">Status</th>
              <th className="font-label-caps text-label-caps text-text-secondary py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            <tr className="hover:bg-surface-background/30 transition-colors group cursor-pointer" onClick={() => navigate('/clients/acme_corp')}>
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-secondary-container/20 text-secondary-container flex items-center justify-center font-bold text-body-sm">
                    AC
                  </div>
                  <span className="font-body-base text-body-base font-medium text-text-primary">Acme Corp</span>
                </div>
              </td>
              <td className="py-3 px-4 font-mono-data text-mono-data text-text-secondary">acme_corp</td>
              <td className="py-3 px-4 font-mono-data text-mono-data text-text-primary text-right">1,245</td>
              <td className="py-3 px-4 font-body-sm text-body-sm text-text-secondary">Oct 12, 2023</td>
              <td className="py-3 px-4">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-status-success/10 text-status-success border border-status-success/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-success" aria-hidden="true" />
                  <span>Active</span>
                </span>
              </td>
              <td className="py-3 px-4 text-right">
                <button className="text-text-secondary hover:text-primary transition-colors opacity-0 group-hover:opacity-100 p-1">
                  <span className="material-symbols-outlined text-[20px]">more_vert</span>
                </button>
              </td>
            </tr>
            <tr className="hover:bg-surface-background/30 transition-colors group cursor-pointer" onClick={() => navigate('/clients/globex_inc')}>
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-primary-container/20 text-primary-container flex items-center justify-center font-bold text-body-sm">
                    GL
                  </div>
                  <span className="font-body-base text-body-base font-medium text-text-primary">Globex Inc</span>
                </div>
              </td>
              <td className="py-3 px-4 font-mono-data text-mono-data text-text-secondary">globex_inc</td>
              <td className="py-3 px-4 font-mono-data text-mono-data text-text-primary text-right">892</td>
              <td className="py-3 px-4 font-body-sm text-body-sm text-text-secondary">Sep 05, 2023</td>
              <td className="py-3 px-4">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-status-success/10 text-status-success border border-status-success/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-success" aria-hidden="true" />
                  <span>Active</span>
                </span>
              </td>
              <td className="py-3 px-4 text-right">
                <button className="text-text-secondary hover:text-primary transition-colors opacity-0 group-hover:opacity-100 p-1">
                  <span className="material-symbols-outlined text-[20px]">more_vert</span>
                </button>
              </td>
            </tr>
            <tr className="hover:bg-surface-background/30 transition-colors group">
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-status-warning/20 text-status-warning flex items-center justify-center font-bold text-body-sm">
                    IN
                  </div>
                  <span className="font-body-base text-body-base font-medium text-text-primary">Initech</span>
                </div>
              </td>
              <td className="py-3 px-4 font-mono-data text-mono-data text-text-secondary">initech</td>
              <td className="py-3 px-4 font-mono-data text-mono-data text-text-primary text-right">0</td>
              <td className="py-3 px-4 font-body-sm text-body-sm text-text-secondary">Nov 20, 2023</td>
              <td className="py-3 px-4">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-status-warning/10 text-status-warning border border-status-warning/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-warning" aria-hidden="true" />
                  <span>Pending</span>
                </span>
              </td>
              <td className="py-3 px-4 text-right">
                <button className="text-text-secondary hover:text-primary transition-colors opacity-0 group-hover:opacity-100 p-1">
                  <span className="material-symbols-outlined text-[20px]">more_vert</span>
                </button>
              </td>
            </tr>
            <tr className="hover:bg-surface-background/30 transition-colors group">
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-status-error/20 text-status-error flex items-center justify-center font-bold text-body-sm">
                    SO
                  </div>
                  <span className="font-body-base text-body-base font-medium text-text-primary">Soylent Corp</span>
                </div>
              </td>
              <td className="py-3 px-4 font-mono-data text-mono-data text-text-secondary">soylent_corp</td>
              <td className="py-3 px-4 font-mono-data text-mono-data text-text-primary text-right">45</td>
              <td className="py-3 px-4 font-body-sm text-body-sm text-text-secondary">Jan 15, 2022</td>
              <td className="py-3 px-4">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-status-error/10 text-status-error border border-status-error/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-error" aria-hidden="true" />
                  <span>Suspended</span>
                </span>
              </td>
              <td className="py-3 px-4 text-right">
                <button className="text-text-secondary hover:text-primary transition-colors opacity-0 group-hover:opacity-100 p-1">
                  <span className="material-symbols-outlined text-[20px]">more_vert</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="px-4 py-3 border-t border-surface-border bg-surface-background/50 flex items-center justify-between">
          <button className="text-text-secondary hover:text-white font-body-sm text-body-sm px-3 py-1 rounded-DEFAULT hover:bg-surface-card transition-colors disabled:opacity-50" disabled>Previous</button>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 flex items-center justify-center rounded-DEFAULT bg-primary/20 text-primary font-body-sm text-body-sm font-medium">1</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-DEFAULT text-text-secondary hover:bg-surface-card hover:text-white font-body-sm text-body-sm transition-colors">2</button>
            <button className="w-8 h-8 flex items-center justify-center rounded-DEFAULT text-text-secondary hover:bg-surface-card hover:text-white font-body-sm text-body-sm transition-colors">3</button>
            <span className="text-text-secondary mx-1">...</span>
            <button className="w-8 h-8 flex items-center justify-center rounded-DEFAULT text-text-secondary hover:bg-surface-card hover:text-white font-body-sm text-body-sm transition-colors">15</button>
          </div>
          <button className="text-text-secondary hover:text-white font-body-sm text-body-sm px-3 py-1 rounded-DEFAULT hover:bg-surface-card transition-colors">Next</button>
        </div>
      </div>
    </div>
  );
};

export default ClientsDirectory;
